import { NextRequest, NextResponse } from "next/server";
import {
  deleteScenario,
  getScenario,
  listScenarios,
  replaceAll,
  saveScenario,
  toPublicScenario,
  validateScenario,
} from "@/lib/scenarios/store";
import type { Scenario } from "@/lib/scenarios/types";

export async function GET(req: NextRequest) {
  const includeDrafts = req.nextUrl.searchParams.get("admin") === "1";
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const s = await getScenario(id, includeDrafts);
    if (!s) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    return NextResponse.json(includeDrafts ? s : toPublicScenario(s));
  }
  const scenarios = await listScenarios(includeDrafts);
  return NextResponse.json(includeDrafts ? scenarios : scenarios.map(toPublicScenario));
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ожидается корректный JSON" }, { status: 400 }); }
  if (Array.isArray(body)) {
    if (!body.every(validateScenario)) return NextResponse.json({ error: "Сценарий должен содержать название, бриф и полные данные оппонента" }, { status: 400 });
    const all = await replaceAll(body);
    return NextResponse.json(all);
  }
  if (!validateScenario(body)) return NextResponse.json({ error: "Сценарий должен содержать название, бриф и полные данные оппонента" }, { status: 400 });
  const scenario = body as Scenario;
  const old = await getScenario(scenario.id, true);
  const saved = await saveScenario({
    ...scenario,
    version: old ? (JSON.stringify({ ...old, updatedAt: "" }) === JSON.stringify({ ...scenario, updatedAt: "" }) ? old.version ?? 1 : (old.version ?? 1) + 1) : scenario.version ?? 1,
    createdAt: scenario.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json(saved);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteScenario(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Нельзя удалить или не найдено" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
