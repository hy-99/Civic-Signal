import { promises as fs } from "node:fs";
import path from "node:path";

import { CATEGORY_CONFIG, DEMO_IMAGE_DIR } from "@/lib/constants";
import type { ReportCategoryKey } from "@/lib/types";
import { fail, ok } from "@/lib/http";
import { analyzeReportImage, type ReportClaim } from "@/services/ai";
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

    const title = (formData.get("title") || "").toString().trim();
    const description = (formData.get("description") || "").toString().trim();
    const categoryValue = (formData.get("category") || "").toString().trim() as ReportCategoryKey;
    const categoryLabel = CATEGORY_CONFIG[categoryValue]?.label || "";
    const claim: ReportClaim | null =
      title || description || categoryLabel
        ? { title, description, category_label: categoryLabel }
        : null;

    const imageBytes = await file.arrayBuffer();
    const [uploaded, image_analysis] = await Promise.all([
      uploadReportImage(file),
      analyzeReportImage(imageBytes, file.type, claim),
    ]);
    return ok({ ...uploaded, image_analysis });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed.", 400);
  }
}
