"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODEL_CATEGORIES, MODEL_GENDERS } from "@/lib/model-constants";

export async function createModel(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a model name";
  const category = formData.get("category") as string;
  const gender = formData.get("gender") as string;
  if (!MODEL_CATEGORIES.includes(category as typeof MODEL_CATEGORIES[number])) return "Please select a category";
  if (!MODEL_GENDERS.includes(gender as typeof MODEL_GENDERS[number])) return "Please select a sex";
  const { error } = await supabase.from("models").insert({ name, category, gender });
  if (error) return error.message;
  revalidatePath("/models");
  redirect("/models");
}

export async function updateModel(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a model name";
  const category = formData.get("category") as string;
  const gender = formData.get("gender") as string;
  const { error } = await supabase.from("models").update({ name, category, gender }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/models");
  redirect("/models");
}
