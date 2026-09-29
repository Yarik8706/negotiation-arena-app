import { NextRequest, NextResponse } from "next/server";
import { finishRoom } from "@/lib/group-rooms/store";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""; const { id } = await params; const result = await finishRoom(id, token);
  if ("error" in result) return NextResponse.json({ error: "Комната не найдена или нет доступа" }, { status: result.error === "denied" ? 403 : 404 });
  return NextResponse.json(result.room);
}
