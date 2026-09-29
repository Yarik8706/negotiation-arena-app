import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm/client";
import { advisorSystem } from "@/lib/llm/prompts";
import { getScenario } from "@/lib/scenarios/store";
import type { ChatMessage } from "@/lib/scenarios/types";

export async function POST(req: NextRequest) {
  const { scenarioId, messages } = (await req.json()) as {
    scenarioId?: string;
    messages?: ChatMessage[];
  };

  if (!scenarioId) {
    return NextResponse.json({ error: "Нужен scenarioId" }, { status: 400 });
  }

  const scenario = await getScenario(scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
  }

  const transcript = (messages ?? [])
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "Игрок" : "Оппонент"}: ${m.content}`)
    .join("\n");

  const result = await chatCompletion({
    messages: [
      {
        role: "system",
        content: advisorSystem(scenario.title, scenario.playerBrief),
      },
      {
        role: "user",
        content: transcript
          ? `Диалог:\n${transcript}\n\nДай совет на следующий ход.`
          : "Диалог ещё не начат. Дай стартовый совет.",
      },
    ],
    temperature: 0.6,
    max_tokens: 300,
  });

  return NextResponse.json({ advice: result.content, mock: result.mock });
}
