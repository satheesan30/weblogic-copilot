import { NextResponse } from "next/server";
import { saveUploadPart } from "@/lib/server/upload-processor";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await getCurrentSession(); if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const formData = await request.formData();
    const uploadId = String(formData.get("uploadId") || "");
    const partIndex = Number(formData.get("partIndex"));
    const part = formData.get("part");

    if (!uploadId || !Number.isInteger(partIndex) || !(part instanceof Blob)) {
      return NextResponse.json({ error: "uploadId, partIndex, and part are required." }, { status: 400 });
    }

    const bytes = Buffer.from(await part.arrayBuffer());
    const session = await saveUploadPart(uploadId, partIndex, bytes, auth.sub);
    return NextResponse.json({
      uploadId,
      partIndex,
      receivedParts: session.receivedParts.length,
      totalParts: session.totalParts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save upload part." },
      { status: 400 },
    );
  }
}
