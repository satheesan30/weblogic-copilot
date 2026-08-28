import { NextResponse } from "next/server";
import { createFdeUseCase, listFdeUseCases } from "@/lib/server/fde/store";
import { getCurrentSession } from "@/lib/server/auth";
import type { FdeUseCaseInput } from "@/types/fde";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const useCases = await listFdeUseCases();
    return NextResponse.json({ useCases });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list use cases." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as FdeUseCaseInput;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    const useCase = await createFdeUseCase(body);
    return NextResponse.json({ useCase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create use case." },
      { status: 500 },
    );
  }
}
