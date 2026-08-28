import { NextResponse } from "next/server";
import { assembleAndIndexUpload } from "@/lib/server/upload-processor";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 3600;

export async function POST(request: Request) {
  try {
    const auth = await getCurrentSession(); if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as { uploadId?: string };
    if (!body.uploadId) {
      return NextResponse.json({ error: "uploadId is required." }, { status: 400 });
    }
    const document = await assembleAndIndexUpload(body.uploadId, auth.sub);
    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not complete upload indexing." },
      { status: 500 },
    );
  }
}
