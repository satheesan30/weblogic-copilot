import { NextResponse } from "next/server";
import { getFdeSummary } from "@/lib/server/fde/summary";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getFdeSummary());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load FDE summary." },
      { status: 500 },
    );
  }
}
