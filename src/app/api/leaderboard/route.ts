import { NextRequest, NextResponse } from "next/server";
import { leaderboard } from "@/lib/progress/store";
export async function GET(req: NextRequest) {
  const scenarioId = req.nextUrl.searchParams.get("scenarioId") ?? "";
  const scenarioVersion = Number(req.nextUrl.searchParams.get("scenarioVersion") ?? "1");
  const difficulty = req.nextUrl.searchParams.get("difficulty") ?? "Средняя";
  const mode = req.nextUrl.searchParams.get("mode") ?? "independent";
  if (!scenarioId || !Number.isInteger(scenarioVersion) || scenarioVersion < 1 || !["Базовая", "Средняя", "Высокая"].includes(difficulty) || mode !== "independent") return NextResponse.json({ error: "В рейтинг допускаются только самостоятельные завершённые попытки" }, { status: 400 });
  return NextResponse.json({ rows: await leaderboard(scenarioId, scenarioVersion, difficulty, mode), scenarioId, scenarioVersion, difficulty, mode, privacy: "Публикуются только псевдоним, лучший балл и число попыток; переписка не публикуется." });
}
