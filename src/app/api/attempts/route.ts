import { NextRequest, NextResponse } from "next/server";
import { createAttempt, getAttempt, toPublicAttempt } from "@/lib/attempts/store";
export async function POST(req: NextRequest) {
  let body: { scenarioId?: string; previousAttemptId?: string; variationId?: string; preview?: boolean; profileId?: string; practiceMode?: "guided" | "independent" | "diagnostic" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  if (!body.scenarioId) return NextResponse.json({ error: "Нужен scenarioId" }, { status: 400 });
  if (body.practiceMode && !["guided", "independent", "diagnostic"].includes(body.practiceMode)) return NextResponse.json({ error: "Неизвестный режим" }, { status: 400 });
  const attempt = await createAttempt(body.scenarioId, body.previousAttemptId, body.variationId, body.preview === true, body.profileId, body.practiceMode);
  if (!attempt) return NextResponse.json({ error: "Сценарий или предыдущая попытка не найдены" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt), { status: 201 });
}
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нужен id попытки" }, { status: 400 });
  const attempt = await getAttempt(id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt));
}
