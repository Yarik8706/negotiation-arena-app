import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm/client";
import { getScenario } from "@/lib/scenarios/store";
import type { ChatMessage } from "@/lib/scenarios/types";

export async function POST(req: NextRequest) {
  const { scenarioId, messages } = (await req.json()) as {
    scenarioId?: string;
    messages?: ChatMessage[];
  };

  if (!scenarioId || !messages) {
    return NextResponse.json(
      { error: "Нужны scenarioId и messages" },
      { status: 400 }
    );
  }

  const scenario = await getScenario(scenarioId);
  if (!scenario) {
    return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
  }

  const history = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const result = await chatCompletion({
    messages: [
      { role: "system", content: scenario.opponent.systemPrompt },
      ...history,
    ],
    temperature: 0.7,
  });

  return NextResponse.json({
    message: { role: "assistant", content: result.content },
    mock: result.mock,
  });
}
