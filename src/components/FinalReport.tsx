"use client";

import { useEffect, useRef, useState } from "react";
import type { FinalReport as Report, ScenarioVariation, VariationOption } from "@/lib/scenarios/types";
import { Icon } from "@/components/Icon";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="report-dialog"
      aria-labelledby="report-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="report-content space-y-5">
        <header className="report-heading">
          <div>

            <h2 id="report-title">Что изменил этот разговор</h2>
            <p className="mt-2 text-xs text-[var(--muted)]">Режим: {practiceMode === "guided" ? "тренировка с подсказками" : practiceMode === "diagnostic" ? "стартовая диагностика" : "самостоятельная попытка"}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="report-close" aria-label="Закрыть итоговый отчёт">×</button>
        </header>

        <p className="report-summary">{report.summary}</p>

        {!!report.evidence?.length && <section aria-labelledby="report-evidence-title">
          <h3 id="report-evidence-title" className="mb-3 text-sm font-semibold">Эпизоды из ваших реплик</h3>
          <div className="space-y-3">{report.evidence.map((item) => <article key={item.messageId} className="report-evidence text-sm">
            <blockquote className="border-l-2 border-[var(--accent)] pl-3">«{item.quote}»</blockquote>
            <p className="mt-2 text-xs text-[var(--muted)]">{item.explanation}</p>
            <p className="evidence-rewrite"><span>Попробуйте в следующем разговоре</span>{item.rewrite}</p>
            <a className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-[var(--accent)] underline" href={"/learn#" + item.theoryId} target="_blank" rel="noreferrer">Открыть теорию <Icon name="arrow-up-right" size={14} /></a>
          </article>)}</div>
        </section>}

        <div className="report-score-grid">
          <section className="report-outcome rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3" aria-labelledby="report-outcome-title">
            <h3 id="report-outcome-title" className="text-sm font-semibold">Исход переговоров</h3>
            {report.outcome ? <>
              <p className="mt-2 text-sm font-medium">{report.outcome.label}</p>
              <span className="report-score">{report.outcome.score}<span className="ml-1 text-xs font-medium text-[var(--muted)]">/100</span></span>
              <p className="mt-2 text-xs text-[var(--muted)]">Сигналы: {report.outcome.signals.length ? report.outcome.signals.join(", ") : "пока не выявлены"}</p>
            </> : <p className="mt-2 text-sm text-[var(--muted)]">Оценка исхода недоступна для этой попытки.</p>}
          </section>

          {report.skillScores && <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4" aria-labelledby="report-skills-title">
            <h3 id="report-skills-title" className="mb-3 text-sm font-semibold">Навыки</h3>
            <div className="report-skills">
              {Object.entries(report.skillScores).map(([skill, score]) => <div key={skill} className="report-skill-row">
                <span>{skill}</span><strong>{score}/100</strong>
                <div className="report-skill-track" role="progressbar" aria-label={skill} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
                  <div className="report-skill-fill" style={{ width: score + "%" }} />
                </div>
              </div>)}
            </div>
          </section>}
        </div>

        {report.comparison && <section className="report-comparison rounded-lg border border-[var(--good)]/40 p-3" aria-labelledby="report-comparison-title">
          <h3 id="report-comparison-title" className="text-sm font-semibold">Сравнение с прошлой попыткой</h3>
          <p className="mt-1 text-sm">Прежний исход: {report.comparison.previousOutcome}. Изменение оценки исхода: {report.comparison.scoreDelta > 0 ? "+" : ""}{report.comparison.scoreDelta}.</p>
          {report.comparison.changedCondition && <p className="mt-2 text-xs text-[var(--muted)]">Изменилось одно условие — {report.comparison.changedCondition.parameter}: «{report.comparison.changedCondition.from}» → «{report.comparison.changedCondition.to}».</p>}
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">{Object.entries(report.comparison.skillDeltas).map(([skill, delta]) => <li key={skill}>{skill}: {delta > 0 ? "+" : ""}{delta} баллов</li>)}</ul>
        </section>}

        {currentVariation && <p className="rounded-lg border border-[var(--card-border)] p-3 text-xs leading-5 text-[var(--muted)]">Эта попытка проводилась с условием: {currentVariation.parameter} — {currentVariation.to}.</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <section aria-labelledby="report-strengths-title">
            <h3 id="report-strengths-title" className="mb-2 text-sm font-semibold text-[var(--good)]">Сильные стороны</h3>
            <ul className="list-inside list-disc space-y-1 text-sm">{report.strengths.length ? report.strengths.map((item, index) => <li key={index}>{item}</li>) : <li className="list-none text-[var(--muted)]">В этой попытке пока недостаточно реплик для оценки сильных сторон.</li>}</ul>
          </section>
          <section aria-labelledby="report-growth-title">
            <h3 id="report-growth-title" className="mb-2 text-sm font-semibold text-[var(--warn)]">Зоны роста</h3>
            <ul className="list-inside list-disc space-y-1 text-sm">{report.weaknesses.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </section>
        </div>

        <section className="rounded-lg bg-[var(--accent-soft)] p-4 text-sm" aria-labelledby="report-recommendation-title">
          <h3 id="report-recommendation-title" className="mb-1 font-semibold">Рекомендация к реальной встрече</h3>
          <p>{report.recommendation}</p>
        </section>
        {report.nextExercise && <p className="rounded-lg border border-[var(--card-border)] p-3 text-sm"><strong>Следующая тренировка:</strong> {report.nextExercise}</p>}

        <div className="report-actions">
          {variationOptions.length > 0 && <label className="min-w-0 flex-1 text-xs text-[var(--muted)]">Изменить одно условие для повтора
            <select value={variationId} onChange={(event) => setVariationId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--card-border)] bg-black/30 px-3 text-sm text-[var(--foreground)]">
              {variationOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>}
          <button type="button" onClick={() => { onClose(); onRestart(variationId || undefined); }} className="min-h-11 flex-1 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110">
            {variationOptions.length ? "Повторить с новым условием" : "Новая попытка"}
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-[var(--card-border)] px-4 text-sm hover:bg-white/5">Закрыть</button>
        </div>
      </div>
    </dialog>
  );
}
