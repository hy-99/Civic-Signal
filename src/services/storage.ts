import { promises as fs } from "node:fs";
import path from "node:path";

import { ALLOWED_IMAGE_TYPES, DEMO_IMAGE_DIR, MAX_IMAGE_SIZE_BYTES, SUPABASE_STORAGE_BUCKET } from "@/lib/constants";
import { isDemoMode } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createId, getFileExtension } from "@/lib/utils";

export function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Only JPG, PNG, and WEBP images are allowed.");
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image is too large. Please upload a file under 4MB.");
  }
}

export async function compressImage(file: File) {
  return file;
}

export async function uploadReportImage(file: File) {
  validateImage(file);
  const compressed = await compressImage(file);
  const filename = `${createId()}.${getFileExtension(compressed.name || "upload.bin")}`;

  if (isDemoMode()) {
    const dir = path.join(process.cwd(), DEMO_IMAGE_DIR);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    const buffer = Buffer.from(await compressed.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return {
      image_url: `/api/upload/report-image?path=${encodeURIComponent(filename)}`,
      image_storage_path: filename,
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Storage is unavailable.");
  const buffer = Buffer.from(await compressed.arrayBuffer());
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(filename, buffer, {
    contentType: compressed.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(filename);
  return {
    image_url: data.publicUrl,
    image_storage_path: filename,
  };
}

export async function deleteReportImage(pathname: string) {
  if (isDemoMode()) {
    await fs.rm(path.join(process.cwd(), DEMO_IMAGE_DIR, pathname), { force: true });
    return;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([pathname]);
}
