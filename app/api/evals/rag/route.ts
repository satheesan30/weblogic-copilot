import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server/auth";
import { getAppConfig } from "@/lib/server/config";
import { runRagEvaluation } from "@/lib/server/rag-evaluation";

export const runtime = "nodejs";

export async function POST() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runRagEvaluation(await getAppConfig(), session.sub));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RAG evaluation failed." }, { status: 500 });
  }
}
