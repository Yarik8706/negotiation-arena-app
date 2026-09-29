import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, extractJson } from "@/lib/llm/client";
import { temperatureSystem } from "@/lib/llm/prompts";
import type { ChatMessage, TemperatureReading } from "@/lib/scenarios/types";

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages?: ChatMessage[] };

  const transcript = (messages ?? [])
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "Игрок" : "Оппонент"}: ${m.content}`)
    .join("\n");

  const result = await chatCompletion({
    messages: [
      { role: "system", content: temperatureSystem() },
      {
        role: "user",
        content: transcript || "Переговоры только начались.",
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  const parsed = extractJson<TemperatureReading>(result.content);
  const reading: TemperatureReading = parsed ?? {
    score: 40,
    reason: "Недостаточно данных — оценка по умолчанию.",
  };

  reading.score = Math.max(0, Math.min(100, Number(reading.score) || 0));

  return NextResponse.json({ ...reading, mock: result.mock });
}
