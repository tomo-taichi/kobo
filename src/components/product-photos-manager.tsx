"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProductImage, deleteProductImage, setProductImagePrimary } from "@/app/actions/product-images";

const MAIN_MAX = 2;
const COLOR_MAX = 10;
const MAX_UPLOAD_MB = 30; // must stay below next.config serverActions.bodySizeLimit

export type ProductImage = {
  id: string;
  product_color_id: string | null;
  web_url: string;
  thumb_url: string;
  sort_order: number;
};

type Colour = { id: string; color: string };

type Props = {
  productId: string;
  colors: Colour[];
  images: ProductImage[];
};

// ─── A single photo tile (thumbnail + hover actions) ──────────────────
function PhotoTile({
  img,
  productId,
  isPrimary,
  onChanged,
}: {
  img: ProductImage;
  productId: string;
  isPrimary: boolean;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteProductImage(img.id, productId);
      onChanged();
    });
  }
  function handlePrimary() {
    startTransition(async () => {
      await setProductImagePrimary(img.id, productId);
      onChanged();
    });
  }

  return (
    <div className={`relative group w-28 h-28 rounded-lg overflow-hidden border ${isPrimary ? "border-gray-900" : "border-gray-200"} bg-gray-50 ${pending ? "opacity-40" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href={img.web_url} target="_blank" rel="noreferrer">
        <img src={img.thumb_url} alt="" className="w-full h-full object-cover" />
      </a>
      {isPrimary && (
        <span className="absolute top-1 left-1 text-[9px] font-medium bg-gray-900 text-white px-1.5 py-0.5 rounded">PRIMARY</span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between items-center px-1 py-1 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        {!isPrimary ? (
          <button type="button" onClick={handlePrimary} disabled={pending}
            title="Make primary" className="text-[10px] text-white/90 hover:text-white bg-black/30 rounded px-1.5 py-0.5">
            ★ Primary
          </button>
        ) : <span />}
        <button type="button" onClick={handleDelete} disabled={pending}
          title="Delete photo" className="text-white/90 hover:text-red-300 text-sm leading-none px-1">
          ×
        </button>
      </div>
    </div>
  );
}

// ─── Upload control (auto-uploads on file pick) ───────────────────────
function UploadTile({
  productId,
  productColorId,
  disabled,
  onChanged,
}: {
  productId: string;
  productColorId: string | null;
  disabled: boolean;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Image too large (max ${MAX_UPLOAD_MB} MB)`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const err = await uploadProductImage(productId, productColorId, fd);
      if (inputRef.current) inputRef.current.value = "";
      if (err) { setError(err); return; }
      setError(null);
      onChanged();
    });
  }

  if (disabled) {
    return (
      <div className="w-28 h-28 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-[11px] text-gray-300 text-center px-2">
        Max reached
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={pending}
        className="w-28 h-28 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-500 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors">
        <span className="text-2xl leading-none">＋</span>
        <span className="text-[11px] mt-1">{pending ? "Processing…" : "Add photo"}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />
      {error && <p className="text-[11px] text-red-600 mt-1 w-28">{error}</p>}
    </div>
  );
}

// ─── A labelled gallery row (main set or one colour) ──────────────────
function Gallery({
  title,
  subtitle,
  productId,
  productColorId,
  images,
  max,
  warn,
  onChanged,
}: {
  title: React.ReactNode;
  subtitle?: string;
  productId: string;
  productColorId: string | null;
  images: ProductImage[];
  max: number;
  warn?: string | null;
  onChanged: () => void;
}) {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400">{sorted.length}/{max}</span>
      </div>
      {subtitle && <p className="text-xs text-gray-400 -mt-1 mb-2">{subtitle}</p>}
      {warn && <p className="text-[11px] text-amber-600 mb-2">{warn}</p>}
      <div className="flex flex-wrap gap-2">
        {sorted.map((img, i) => (
          <PhotoTile key={img.id} img={img} productId={productId} isPrimary={i === 0} onChanged={onChanged} />
        ))}
        <UploadTile productId={productId} productColorId={productColorId} disabled={sorted.length >= max} onChanged={onChanged} />
      </div>
    </div>
  );
}

export function ProductPhotosManager({ productId, colors, images }: Props) {
  const router = useRouter();
  const onChanged = () => router.refresh();

  const mainImages = images.filter((i) => i.product_color_id == null);
  const byColour = (colourId: string) => images.filter((i) => i.product_color_id === colourId);

  return (
    <div className="space-y-8">
      <Gallery
        title="Main Photos"
        subtitle="The 2 hero photos shown on the products list. The first is the primary."
        productId={productId}
        productColorId={null}
        images={mainImages}
        max={MAIN_MAX}
        warn={mainImages.length < MAIN_MAX ? `${MAIN_MAX - mainImages.length} more main photo${MAIN_MAX - mainImages.length === 1 ? "" : "s"} recommended.` : null}
        onChanged={onChanged}
      />

      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Colour Galleries</h2>
        {colors.length === 0 ? (
          <p className="text-sm text-gray-400">No colours enabled for this product yet — enable colours on the Basic Info tab to add per-colour photos.</p>
        ) : (
          <div className="space-y-8">
            {colors.map((c) => (
              <Gallery
                key={c.id}
                title={c.color}
                productId={productId}
                productColorId={c.id}
                images={byColour(c.id)}
                max={COLOR_MAX}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
