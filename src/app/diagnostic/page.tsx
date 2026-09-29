"use client";
import { useEffect, useState } from "react";
import { PlayArena } from "@/components/PlayArena";
import type { PublicScenario } from "@/lib/scenarios/types";
export default function DiagnosticPage(){
  const [scenario,setScenario]=useState<PublicScenario|null>(null);
  useEffect(()=>{void fetch("/api/scenarios").then(r=>r.json()).then((items:PublicScenario[])=>setScenario(items.find(s=>s.id==="pilot-prospect")??items[0]??null));},[]);
  if(scenario)return <><div className="mb-5 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="font-semibold">Стартовая диагностика · 3–5 ходов</p><p className="mt-1 text-sm text-[var(--muted)]">Короткая учебная попытка без оценки «сдал/не сдал». По завершении вы увидите наблюдаемые навыки и сможете выбрать, что тренировать дальше.</p></div><PlayArena scenario={scenario} practiceMode="diagnostic" onExit={()=>{window.location.href="/"}}/></>;
  return <div className="rounded-2xl border border-[var(--card-border)] p-6"><h1 className="text-3xl font-semibold">Стартовая диагностика</h1><p className="mt-3 text-[var(--muted)]">Загружаем короткий учебный сценарий…</p></div>;
}
