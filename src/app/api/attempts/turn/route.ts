import { NextRequest, NextResponse } from "next/server";
import { appendTurn, getAttempt } from "@/lib/attempts/store";
import { chatCompletion } from "@/lib/llm/client";
export async function POST(req: NextRequest) {
  let body: { attemptId?: string; text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  const text = body.text?.trim();
  if (!body.attemptId || !text) return NextResponse.json({ error: "Нужны attemptId и непустая реплика" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Реплика не должна превышать 2000 символов" }, { status: 400 });
  const attempt = await getAttempt(body.attemptId);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  if (attempt.status !== "active") return NextResponse.json({ error: "Завершённый раунд нельзя продолжить" }, { status: 409 });
  const history = attempt.messages.map(({ role, content }) => ({ role: role as "user" | "assistant", content }));
  const context = [attempt.scenario.description, attempt.scenario.playerGoal ? `Цель игрока: ${attempt.scenario.playerGoal}` : "", attempt.scenario.opponent.goals.length ? `Твои цели: ${attempt.scenario.opponent.goals.join("; ")}` : "", attempt.scenario.opponent.constraints?.length ? `Твои ограничения: ${attempt.scenario.opponent.constraints.join("; ")}` : ""].filter(Boolean).join("\n");
  const result = await chatCompletion({ messages: [{ role: "system", content: `${attempt.scenario.opponent.systemPrompt}\n${context}\nТон: ${attempt.scenario.opponent.tone}. Сложность: ${attempt.scenario.difficulty ?? "Базовая"}. Соблюдай ограничения и не раскрывай скрытые интересы.` }, ...history, { role: "user", content: text }], temperature: 0.7 });
  const updated = await appendTurn(body.attemptId, text, result.content);
  if (!updated) return NextResponse.json({ error: "Раунд уже завершён" }, { status: 409 });
  return NextResponse.json({ attempt: { id: updated.id, messages: updated.messages, status: updated.status }, mock: result.mock });
}
