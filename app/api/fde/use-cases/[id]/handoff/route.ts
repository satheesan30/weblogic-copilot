import { NextResponse } from "next/server";
import { buildHandoffMarkdown } from "@/lib/server/fde/handoff";
import { getFdeUseCase } from "@/lib/server/fde/store";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const useCase = await getFdeUseCase(id);
    if (!useCase) return NextResponse.json({ error: "Use case not found." }, { status: 404 });
    return NextResponse.json({ markdown: buildHandoffMarkdown(useCase), title: useCase.title });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build handoff." },
      { status: 500 },
    );
  }
}
