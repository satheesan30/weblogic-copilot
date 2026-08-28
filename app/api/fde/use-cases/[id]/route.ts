import { NextResponse } from "next/server";
import { deleteFdeUseCase, getFdeUseCase, updateFdeUseCase } from "@/lib/server/fde/store";
import { getCurrentSession } from "@/lib/server/auth";
import type { FdeUseCaseInput } from "@/types/fde";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const useCase = await getFdeUseCase(id);
    if (!useCase) return NextResponse.json({ error: "Use case not found." }, { status: 404 });
    return NextResponse.json({ useCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load use case." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<FdeUseCaseInput>;
    const useCase = await updateFdeUseCase(id, body);
    return NextResponse.json({ useCase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update use case.";
    return NextResponse.json({ error: message }, { status: message === "Use case not found." ? 404 : 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await getFdeUseCase(id);
    if (!existing) return NextResponse.json({ error: "Use case not found." }, { status: 404 });
    await deleteFdeUseCase(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete use case." },
      { status: 500 },
    );
  }
}
