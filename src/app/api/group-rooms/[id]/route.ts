import { NextRequest, NextResponse } from "next/server";
import { getRoom, deleteRoom } from "@/lib/group-rooms/store";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { id } = await params; const room = await getRoom(id, token);
  return room ? NextResponse.json(room, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Комната не найдена или нет доступа" }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!await deleteRoom(id, token)) return NextResponse.json({ error: "Комната не найдена или нет доступа" }, { status:404 });
  return NextResponse.json({ deleted: true });
}
