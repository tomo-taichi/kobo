"use server";

import { randomUUID } from "crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "product-images";
const MAX_MAIN_PHOTOS = 2;
const MAX_COLOR_PHOTOS = 10;

// Resize (longest side, never upscale), strip metadata, re-encode as WebP.
async function toWebp(input: ArrayBuffer, maxSide: number, quality: number): Promise<Buffer> {
  return sharp(Buffer.from(input))
    .rotate() // bake in EXIF orientation, then drop metadata
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

// Count existing photos in a product's main set (colorId null) or a colour gallery.
async function countInGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  productColorId: string | null
): Promise<number> {
  let q = supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  q = productColorId ? q.eq("product_color_id", productColorId) : q.is("product_color_id", null);
  const { count } = await q;
  return count ?? 0;
}

export async function uploadProductImage(
  productId: string,
  productColorId: string | null,
  formData: FormData
): Promise<string | null> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return "Please select an image";
  if (!file.type.startsWith("image/")) return "File must be an image";

  const supabase = await createClient();

  const limit = productColorId ? MAX_COLOR_PHOTOS : MAX_MAIN_PHOTOS;
  const existing = await countInGroup(supabase, productId, productColorId);
  if (existing >= limit) {
    return productColorId
      ? `This colour already has the maximum of ${limit} photos`
      : `A product can have at most ${limit} main photos`;
  }

  const bytes = await file.arrayBuffer();
  let web: Buffer;
  let thumb: Buffer;
  try {
    web = await toWebp(bytes, 2048, 82);
    thumb = await toWebp(bytes, 600, 80);
  } catch {
    return "Could not process this image — it may be corrupt or an unsupported format";
  }

  const base = `${productId}/${productColorId ?? "main"}/${randomUUID()}`;
  const webPath = `${base}-web.webp`;
  const thumbPath = `${base}-thumb.webp`;

  const up1 = await supabase.storage.from(BUCKET).upload(webPath, web, { contentType: "image/webp", upsert: true });
  if (up1.error) return up1.error.message;
  const up2 = await supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: "image/webp", upsert: true });
  if (up2.error) {
    await supabase.storage.from(BUCKET).remove([webPath]);
    return up2.error.message;
  }

  const webUrl = supabase.storage.from(BUCKET).getPublicUrl(webPath).data.publicUrl;
  const thumbUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;

  // Append after the current last photo in this group.
  let lastQ = supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  lastQ = productColorId ? lastQ.eq("product_color_id", productColorId) : lastQ.is("product_color_id", null);
  const { data: lastRows } = await lastQ;
  const nextSort = (lastRows?.[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    product_color_id: productColorId,
    web_path: webPath,
    thumb_path: thumbPath,
    web_url: webUrl,
    thumb_url: thumbUrl,
    sort_order: nextSort,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([webPath, thumbPath]);
    return error.message;
  }

  revalidatePath(`/products/${productId}/photos`);
  revalidatePath("/products");
  return null;
}

export async function deleteProductImage(imageId: string, productId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("web_path, thumb_path")
    .eq("id", imageId)
    .single();
  if (img) await supabase.storage.from(BUCKET).remove([img.web_path, img.thumb_path]);

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return error.message;

  revalidatePath(`/products/${productId}/photos`);
  revalidatePath("/products");
  return null;
}

// Move an image to the front of its group (main set or a colour gallery) — i.e. make it
// the primary photo. Sets its sort_order just below the current minimum.
export async function setProductImagePrimary(imageId: string, productId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("product_color_id")
    .eq("id", imageId)
    .single();
  if (!img) return "Image not found";

  let minQ = supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .limit(1);
  minQ = img.product_color_id ? minQ.eq("product_color_id", img.product_color_id) : minQ.is("product_color_id", null);
  const { data: minRows } = await minQ;
  const minSort = minRows?.[0]?.sort_order ?? 0;

  const { error } = await supabase.from("product_images").update({ sort_order: minSort - 1 }).eq("id", imageId);
  if (error) return error.message;

  revalidatePath(`/products/${productId}/photos`);
  revalidatePath("/products");
  return null;
}
