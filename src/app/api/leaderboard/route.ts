import { profileCredential } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { leaderboard } from "@/lib/progress/store";
export async function GET(req: NextRequest) {
  const scenarioId = req.nextUrl.searchParams.get("scenarioId") ?? "";
  const scenarioVersion = Number(req.nextUrl.searchParams.get("scenarioVersion") ?? "1");
  const difficulty = req.nextUrl.searchParams.get("difficulty") ?? "Средняя";
  const period = req.nextUrl.searchParams.get("period") ?? "all";
  if (period !== "all" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error:"Некорректный период" }, { status:400 });
  const mode = req.nextUrl.searchParams.get("mode") ?? "independent";
  if (!scenarioId || !Number.isInteger(scenarioVersion) || scenarioVersion < 1 || !["Базовая", "Средняя", "Высокая"].includes(difficulty) || mode !== "independent") return NextResponse.json({ error: "В рейтинг допускаются только самостоятельные завершённые попытки" }, { status: 400 });
  return NextResponse.json({ ...await leaderboard(scenarioId, scenarioVersion, difficulty, mode, period, profileCredential(req) ?? undefined), period, scenarioId, scenarioVersion, difficulty, mode, privacy: "Публикуются только псевдоним, лучший балл и число попыток; переписка не публикуется." }, { headers:{"Cache-Control":"no-store"} });
}
