import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, extractJson } from "@/lib/llm/client";
import { reportSystem } from "@/lib/llm/prompts";
import { getScenario } from "@/lib/scenarios/store";
import type { ChatMessage, FinalReport } from "@/lib/scenarios/types";

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
      { role: "system", content: reportSystem() },
      {
        role: "user",
        content: `Сценарий: ${scenario.title}\nБриф: ${scenario.playerBrief}\n\nДиалог:\n${transcript || "(пусто)"}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 600,
  });

  const parsed = extractJson<FinalReport>(result.content);
  const report: FinalReport = parsed ?? {
    strengths: ["Участие в диалоге"],
    weaknesses: ["Недостаточно данных для детального разбора"],
    recommendation: "На реальной встрече заранее подготовьте BATNA и пакеты условий.",
    summary: "Краткий разбор недоступен — использован запасной шаблон.",
  };

  return NextResponse.json({ report, mock: result.mock });
}
