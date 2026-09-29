import { accessibleAttempt, profileCredential, isAdmin } from "@/lib/access";
import { isDbConfigured } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createAttempt, toPublicAttempt } from "@/lib/attempts/store";
export async function POST(req: NextRequest) {
  let body: { scenarioId?: string; previousAttemptId?: string; variationId?: string; preview?: boolean; profileId?: string; practiceMode?: "guided" | "independent" | "diagnostic" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  if (!body.scenarioId) return NextResponse.json({ error: "Нужен scenarioId" }, { status: 400 });
  if (body.practiceMode && !["guided", "independent", "diagnostic"].includes(body.practiceMode)) return NextResponse.json({ error: "Неизвестный режим" }, { status: 400 });
  const credential = profileCredential(req);
  if ((isDbConfigured() || process.env.NODE_ENV === "production") && (!credential || credential !== body.profileId)) return NextResponse.json({ error: "Нужен доступ профиля" }, { status:401 });
  if (body.preview && !isAdmin(req)) return NextResponse.json({ error: "Нужен доступ администратора" }, { status:403 });
  if (body.previousAttemptId && !await accessibleAttempt(req, body.previousAttemptId)) return NextResponse.json({ error: "Попытка не найдена" }, { status:404 });
  const attempt = await createAttempt(body.scenarioId, body.previousAttemptId, body.variationId, body.preview === true, body.profileId, body.practiceMode);
  if (!attempt) return NextResponse.json({ error: "Сценарий или предыдущая попытка не найдены" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt), { status: 201 });
}
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нужен id попытки" }, { status: 400 });
  const attempt = await accessibleAttempt(req, id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json(toPublicAttempt(attempt));
}
