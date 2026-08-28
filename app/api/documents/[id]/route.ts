import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/server/config";
import { deleteStoredDocument } from "@/lib/server/storage";
import { deleteChunksByDocumentId } from "@/lib/server/vector-store";
import { getCurrentSession } from "@/lib/server/auth";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await getAppConfig();
  const deleted = await deleteStoredDocument(id, session.sub);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteChunksByDocumentId(config, id);
  return NextResponse.json({ ok: true });
}
