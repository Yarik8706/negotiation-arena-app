import { accessibleAttempt } from "@/lib/access";
import { NextResponse } from "next/server";
import { toPublicAttempt, deleteAttempt } from "@/lib/attempts/store";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attempt = await accessibleAttempt(req, id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt), { headers:{ "Cache-Control":"no-store" } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await accessibleAttempt(req, id)) return NextResponse.json({ error: "Попытка не найдена" }, { status:404 });
  await deleteAttempt(id);
  return NextResponse.json({ deleted: true });
}
