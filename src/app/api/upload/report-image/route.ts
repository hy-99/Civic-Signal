import { promises as fs } from "node:fs";
import path from "node:path";

import { DEMO_IMAGE_DIR } from "@/lib/constants";
import { fail, ok } from "@/lib/http";
import { uploadReportImage } from "@/services/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filename = url.searchParams.get("path");
  if (!filename) return fail("Image path is required.", 400);

  try {
    const filePath = path.join(process.cwd(), DEMO_IMAGE_DIR, filename);
    const buffer = await fs.readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return fail("Image not found.", 404);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("File is required.", 400);
    const uploaded = await uploadReportImage(file);
    return ok(uploaded);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed.", 400);
  }
}
