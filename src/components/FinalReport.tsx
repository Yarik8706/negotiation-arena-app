"use client";

import { useState } from "react";
import type { FinalReport as Report, ScenarioVariation, VariationOption } from "@/lib/scenarios/types";

type Props = {
  report: Report;
  practiceMode?: "guided" | "independent" | "diagnostic";
  variationOptions?: VariationOption[];
  currentVariation?: ScenarioVariation;
  onClose: () => void;
  onRestart: (variationId?: string) => void;
};

export function FinalReportView({ report, practiceMode = "independent", variationOptions = [], currentVariation, onClose, onRestart }: Props) {
  const [variationId, setVariationId] = useState(variationOptions[0]?.id ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[.1em] text-[var(--accent)]">Разбор · попытка</p>
        <h2 className="mb-2 mt-1 text-xl font-semibold">Итоговый отчёт</h2>
        <p className="mb-3 text-xs text-[var(--muted)]">Режим: {practiceMode === "guided" ? "тренировка с подсказками" : practiceMode === "diagnostic" ? "стартовая диагностика" : "самостоятельная попытка"}</p>
        <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{report.summary}</p>
        {report.outcome && <section className="mb-4 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3"><h3 className="font-medium">Исход переговоров</h3><p className="mt-1 text-sm">{report.outcome.label} · учебная оценка {report.outcome.score}/100</p><p className="mt-1 text-xs text-[var(--muted)]">Сигналы: {report.outcome.signals.length ? report.outcome.signals.join(", ") : "пока не выявлены"}</p></section>}
        {report.comparison && <section className="mb-4 rounded-lg border border-[var(--good)]/40 p-3"><h3 className="font-medium">Сравнение с прошлой попыткой</h3><p className="mt-1 text-sm">Прежний исход: {report.comparison.previousOutcome}. Изменение оценки исхода: {report.comparison.scoreDelta > 0 ? "+" : ""}{report.comparison.scoreDelta}.</p>{report.comparison.changedCondition && <p className="mt-2 text-xs text-[var(--muted)]">Изменилось одно условие — {report.comparison.changedCondition.parameter}: «{report.comparison.changedCondition.from}» → «{report.comparison.changedCondition.to}».</p>}<ul className="mt-2 space-y-1 text-xs">{Object.entries(report.comparison.skillDeltas).map(([skill, delta]) => <li key={skill}>{skill}: {delta > 0 ? "+" : ""}{delta} баллов</li>)}</ul></section>}
        {currentVariation && <p className="mb-4 rounded-lg border border-[var(--card-border)] p-3 text-xs leading-5 text-[var(--muted)]">Эта попытка проводилась с условием: {currentVariation.parameter} — {currentVariation.to}.</p>}
        {report.skillScores && <section className="mb-4"><h3 className="mb-2 text-sm font-medium">Навыки</h3><div className="grid grid-cols-2 gap-2 text-sm">{Object.entries(report.skillScores).map(([skill, score]) => <div key={skill} className="rounded-lg bg-black/20 p-2">{skill}<strong className="float-right">{score}/100</strong></div>)}</div></section>}
        <section className="mb-4"><h3 className="mb-1 text-sm font-medium text-[var(--good)]">Сильные стороны</h3><ul className="list-inside list-disc space-y-1 text-sm">{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
        {!!report.evidence?.length && <section className="mb-4"><h3 className="mb-2 text-sm font-medium">Эпизоды из ваших реплик</h3><div className="space-y-3">{report.evidence.map((item) => <article key={item.messageId} className="rounded-lg border border-[var(--card-border)] p-3 text-sm"><blockquote className="border-l-2 border-[var(--accent)] pl-3">«{item.quote}»</blockquote><p className="mt-2 text-xs text-[var(--muted)]">{item.explanation}</p><p className="mt-1 text-xs">Вариант: {item.rewrite}</p><a className="mt-2 inline-block text-xs text-[var(--accent)] underline" href={`/learn#${item.theoryId}`} target="_blank" rel="noreferrer">Открыть теорию</a></article>)}</div></section>}
        <section className="mb-4"><h3 className="mb-1 text-sm font-medium text-[var(--warn)]">Зоны роста</h3><ul className="list-inside list-disc space-y-1 text-sm">{report.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
        <section className="mb-5 rounded-lg bg-[var(--accent-soft)] p-3 text-sm"><h3 className="mb-1 font-medium">Рекомендация к реальной встрече</h3><p>{report.recommendation}</p></section>
        {report.nextExercise && <p className="mb-4 rounded-lg border border-[var(--card-border)] p-3 text-sm"><strong>Следующая тренировка:</strong> {report.nextExercise}</p>}
        <div className="space-y-2">
          {variationOptions.length > 0 && <label className="block text-xs text-[var(--muted)]">Изменить одно условие для повтора<select value={variationId} onChange={(e) => setVariationId(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 text-sm text-[var(--foreground)]">{variationOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
          <div className="flex gap-2"><button type="button" onClick={() => onRestart(variationId || undefined)} className="min-h-11 flex-1 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110">{variationOptions.length ? "Повторить с новым условием" : "Новая попытка"}</button><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-[var(--card-border)] px-4 text-sm hover:bg-white/5">Закрыть</button></div>
        </div>
      </div>
    </div>
  );
}
