import { NextRequest, NextResponse } from "next/server";
import { postLine } from "@/lib/group-rooms/store";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  let body: { text?: string }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  const text = body.text?.trim(); if (!text || text.length > 2000) return NextResponse.json({ error: "Введите реплику длиной до 2000 символов" }, { status: 400 });
  const { id } = await params; const result = await postLine(id, token, text);
  if ("error" in result) return NextResponse.json({ error: result.error === "turn" ? "Сейчас очередь другого участника" : result.error === "denied" ? "Нет доступа к комнате" : "Раунд завершён" }, { status: result.error === "turn" || result.error === "inactive" ? 409 : result.error === "denied" ? 403 : 404 });
  return NextResponse.json(result.room);
}
