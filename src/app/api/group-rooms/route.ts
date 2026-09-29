import { NextRequest, NextResponse } from "next/server";
import { createRoom, enterMatchmaking, joinRoom } from "@/lib/group-rooms/store";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let body: { action?: string; template?: string; name?: string; invite?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  const name = body.name?.trim().slice(0, 40); if (!name) return NextResponse.json({ error: "Укажите имя участника" }, { status: 400 });
  if (body.action === "matchmake") return NextResponse.json(await enterMatchmaking(name), { status: 201 });
  if (body.action === "join") { const joined = await joinRoom(body.invite?.trim() ?? "", name); return joined ? NextResponse.json(joined, { status: 201 }) : NextResponse.json({ error: "Приглашение недействительно или место уже занято" }, { status: 404 }); }
  if (body.action !== "create" || !["client-seller", "project-team", "solo-board"].includes(body.template ?? "")) return NextResponse.json({ error: "Неизвестный шаблон комнаты" }, { status: 400 });
  return NextResponse.json(await createRoom(body.template as "client-seller" | "project-team" | "solo-board", name), { status: 201 });
}
