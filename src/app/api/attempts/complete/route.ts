import { NextRequest, NextResponse } from "next/server";
import { completeAttempt } from "@/lib/attempts/store";
import { toPublicScenario } from "@/lib/scenarios/store";
export async function POST(req: NextRequest) {
  let body: { attemptId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  if (!body.attemptId) return NextResponse.json({ error: "Нужен attemptId" }, { status: 400 });
  const attempt = await completeAttempt(body.attemptId);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  return NextResponse.json({ attempt: { ...attempt, scenario: toPublicScenario(attempt.scenario) } });
}
