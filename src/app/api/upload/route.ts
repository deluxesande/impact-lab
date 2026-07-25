import { NextResponse } from "next/server";
import { requireFarmer, AuthError } from "@/lib/auth/require-farmer";
import type { UploadResponse, ApiError } from "@/lib/ai/types";

/**
 * POST /api/upload  — multipart produce image upload.
 *
 * Contract (see docs/api-contract.md and docs/android-app-plan.md):
 *   Request:  multipart/form-data { file: <image>, sessionId: string }
 *   Response: { objectKey: string }   // stable MinIO key, never a public URL
 *
 * PHASE 1 STATUS: STUBBED. Validates the multipart shape and returns a mock
 * objectKey. Real MinIO storage (private bucket) lands in Phase 2.5.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request): Promise<NextResponse<UploadResponse | ApiError>> {
  try {
    await requireFarmer();

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: { code: "invalid_content_type", message: "Expected multipart/form-data." } },
        { status: 415 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const sessionId = form.get("sessionId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "missing_file", message: "A 'file' field is required." } },
        { status: 400 },
      );
    }
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      return NextResponse.json(
        { error: { code: "missing_session", message: "A 'sessionId' field is required." } },
        { status: 400 },
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { code: "unsupported_media", message: `Unsupported image type: ${file.type}.` } },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: { code: "file_too_large", message: "Image exceeds the 10 MB limit." } },
        { status: 413 },
      );
    }

    // TODO(Phase 2.5): stream the file to the private MinIO bucket and use the
    // returned key. For now, mint a deterministic-looking mock key.
    const ext = file.type.split("/")[1] ?? "bin";
    const objectKey = `produce/${sessionId}/${Date.now()}-mock.${ext}`;

    return NextResponse.json({ objectKey }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "unauthorized" ? 401 : 403;
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to process upload." } },
      { status: 500 },
    );
  }
}
