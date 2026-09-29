import { NextResponse } from "next/server";
import { getScenario, toPublicScenario } from "@/lib/scenarios/store";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = await getScenario(id);
  if (!scenario) return NextResponse.json({ error: "Сценарий не найден" }, { status: 404 });
  return NextResponse.json(toPublicScenario(scenario));
}
