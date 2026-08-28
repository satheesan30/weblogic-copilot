import { NextRequest, NextResponse } from "next/server";
import { listStoredDocuments } from "@/lib/server/storage";
import { getCurrentSession } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.toLowerCase() || "";
  const type = request.nextUrl.searchParams.get("type") || "all";
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documents = await listStoredDocuments(session.sub);

  const filteredDocuments = documents.filter((document) => {
    const matchesQuery = document.filename.toLowerCase().includes(query);
    const matchesType = type === "all" || document.type === type;
    return matchesQuery && matchesType;
  });

  return NextResponse.json({ documents: filteredDocuments });
}
