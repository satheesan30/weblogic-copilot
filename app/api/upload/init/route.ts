import { NextResponse } from "next/server";
import { CLIENT_UPLOAD_PART_BYTES, MAX_UPLOAD_FILE_BYTES } from "@/lib/server/upload-limits";
import { createUploadSession } from "@/lib/server/upload-processor";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await getCurrentSession(); if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as {
      filename?: string;
      size?: number;
      totalParts?: number;
    };
    const session = await createUploadSession({
      ownerUsername: auth.sub,
      filename: body.filename || "",
      size: Number(body.size || 0),
      totalParts: Number(body.totalParts || 0),
    });
    return NextResponse.json({
      uploadId: session.uploadId,
      filename: session.filename,
      totalParts: session.totalParts,
      partSize: CLIENT_UPLOAD_PART_BYTES,
      maxFileBytes: MAX_UPLOAD_FILE_BYTES,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start upload." },
      { status: 400 },
    );
  }
}
