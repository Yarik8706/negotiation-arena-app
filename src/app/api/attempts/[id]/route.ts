import { NextResponse } from "next/server";
import { getAttempt, toPublicAttempt } from "@/lib/attempts/store";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt));
}
