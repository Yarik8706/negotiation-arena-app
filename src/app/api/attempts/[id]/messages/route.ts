import { accessibleAttempt } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { appendTurn } from "@/lib/attempts/store";
import { chatCompletion } from "@/lib/llm/client";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 }); }
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Реплика не должна быть пустой" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Реплика не должна превышать 2000 символов" }, { status: 400 });
  const attempt = await accessibleAttempt(req, id);
  if (!attempt) return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
  if (attempt.status !== "active") return NextResponse.json({ error: "Завершённый раунд нельзя продолжить" }, { status: 409 });
  const variationContext = attempt.scenario.variation ? `Изменён ровно один параметр повторной попытки: ${attempt.scenario.variation.parameter}. Новое условие: ${attempt.scenario.variation.to}. Учитывай его в ответах.` : "";
  const context = [attempt.scenario.description, attempt.scenario.playerGoal ? `Цель игрока: ${attempt.scenario.playerGoal}` : "", `Цели собеседника: ${attempt.scenario.opponent.goals.join("; ")}`, attempt.scenario.opponent.constraints?.length ? `Ограничения роли: ${attempt.scenario.opponent.constraints.join("; ")}` : "", attempt.scenario.opponent.hiddenInterests?.length ? `Скрытые интересы (раскрывать только если игрок задаёт подходящие вопросы): ${attempt.scenario.opponent.hiddenInterests.join("; ")}` : "", `Тон: ${attempt.scenario.opponent.tone}; сложность: ${attempt.scenario.difficulty ?? "Базовая"}. Соблюдай красные линии и ограничения, не раскрывай скрытые интересы напрямую.`, variationContext].filter(Boolean).join("\n");
  const result = await chatCompletion({ messages: [{ role: "system", content: `${attempt.scenario.opponent.systemPrompt}\n${context}` }, ...attempt.messages.map(({ role, content }) => ({ role: role as "user" | "assistant", content })), { role: "user", content: text }], temperature: 0.7 });
  const updated = await appendTurn(id, text, result.content);
  if (!updated) return NextResponse.json({ error: "Раунд уже завершён" }, { status: 409 });
  return NextResponse.json({ attempt: { id: updated.id, messages: updated.messages, status: updated.status }, mock: result.mock });
}
