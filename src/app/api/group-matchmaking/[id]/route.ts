import { NextRequest, NextResponse } from "next/server";
import { cancelMatchmaking, pollMatchmaking } from "@/lib/group-rooms/store";
export const runtime = "nodejs";
function token(req: NextRequest) { return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""; }
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const result = await pollMatchmaking(id, token(req));
  if ("error" in result) return NextResponse.json({ error: "Поиск завершён или результат уже получен" }, { status: 404 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const result = await cancelMatchmaking(id, token(req));
  if ("error" in result) return NextResponse.json({ error: result.error === "matched" ? "Соперник уже найден" : "Поиск не найден" }, { status: result.error === "matched" ? 409 : 404 });
  return NextResponse.json(result);
}
