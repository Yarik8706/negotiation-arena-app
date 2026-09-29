import { accessibleAttempt } from "@/lib/access";
import { NextResponse } from "next/server";
import { completeAttempt, toPublicAttempt } from "@/lib/attempts/store";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await accessibleAttempt(req, id)) return NextResponse.json({ error: "Попытка не найдена" }, { status:404 });
  const attempt = await completeAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt));
}
