import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, extractJson } from "@/lib/llm/client";
import { characterGenSystem, characterGenUser } from "@/lib/llm/prompts";
import type { OpponentCharacter } from "@/lib/scenarios/types";

export async function POST(req: NextRequest) {
  const { role, sphere, tone } = (await req.json()) as {
    role?: string;
    sphere?: string;
    tone?: string;
  };

  if (!role || !sphere || !tone) {
    return NextResponse.json(
      { error: "Нужны role, sphere, tone" },
      { status: 400 }
    );
  }

  const result = await chatCompletion({
    messages: [
      { role: "system", content: characterGenSystem() },
      { role: "user", content: characterGenUser(role, sphere, tone) },
    ],
    temperature: 0.8,
  });

  const parsed = extractJson<{
    name: string;
    personality: string;
    goals: string[];
    redLines: string[];
    style: string;
    systemPrompt: string;
  }>(result.content);

  if (!parsed) {
    return NextResponse.json(
      { error: "Не удалось разобрать ответ LLM", raw: result.content },
      { status: 502 }
    );
  }

  const opponent: OpponentCharacter = {
    name: parsed.name,
    role,
    sphere,
    tone,
    personality: parsed.personality,
    goals: parsed.goals ?? [],
    redLines: parsed.redLines ?? [],
    style: parsed.style,
    systemPrompt:
      parsed.systemPrompt ||
      `Ты — ${parsed.name}, ${role}. Веди переговоры по-русски.`,
  };

  return NextResponse.json({ opponent, mock: result.mock });
}
