import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // Strict 1 MB max (1,048,576 bytes)
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No image file provided." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Image file exceeds the strict 1 MB limit (Uploaded size: ${(file.size / 1024).toFixed(1)} KB / 1,024 KB max). Please compress or resize the image before uploading.`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize extension and filename
    const ext = path.extname(file.name || ".png") || ".png";
    const sanitizedBase = (file.name || "image")
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    const uniqueFileName = `${sanitizedBase}_${Date.now()}${ext.toLowerCase()}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, uniqueFileName);
    await fs.writeFile(filePath, buffer);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const relativeUrl = `/uploads/${uniqueFileName}`;
    const absoluteUrl = `${appUrl}${relativeUrl}`;
    const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      fileName: uniqueFileName,
      url: relativeUrl,
      absoluteUrl,
      base64: base64Data,
      sizeBytes: file.size,
      sizeKb: Math.round(file.size / 1024),
      mimeType: file.type,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process image upload." },
      { status: 500 }
    );
  }
}
