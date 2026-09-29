import { NextResponse } from "next/server";
import { completeAttempt, toPublicAttempt } from "@/lib/attempts/store";
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await completeAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt));
}
