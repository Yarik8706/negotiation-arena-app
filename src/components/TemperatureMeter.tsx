"use client";

type Props = {
  score: number | null;
  reason: string | null;
  loading?: boolean;
};

function stateFor(score: number | null): { label: string; color: string } {
  if (score === null) return { label: "Ожидает данных", color: "var(--muted)" };
  if (score >= 70) return { label: "Высокая готовность", color: "var(--good)" };
  if (score >= 40) return { label: "Есть напряжение", color: "var(--warn)" };
  return { label: "Низкая готовность", color: "var(--bad)" };
}

export function TemperatureMeter({ score, reason, loading }: Props) {
  const state = stateFor(score);
  return (
    <section className="temperature-card rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4" aria-labelledby="temperature-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="temperature-title" className="text-sm font-semibold">Температура сделки</h2>
          <p className="text-[11px] text-[var(--muted)]">Готовность к соглашению</p>
        </div>
        <span className="temperature-state" style={{ color: state.color, borderColor: state.color }}>
          {loading && score === null ? "Оцениваем…" : state.label}
        </span>
      </div>
      <div className="temperature-number" aria-hidden={score === null}>{score ?? "—"}{score !== null && <span className="ml-1 text-xs font-medium text-[var(--muted)]">/100</span>}</div>
      <div
        className="temperature-track w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Готовность сделки"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score ?? undefined}
        aria-valuetext={score === null ? "Оценка появится после первой реплики" : state.label + ", " + score + " из 100"}
      >
        <div className="h-full transition-all duration-500" style={{ width: (score ?? 0) + "%", background: state.color }} />
      </div>
      <p className="temperature-cause" aria-live="polite">
        {reason ?? (loading ? "Сверяем текущий диалог." : "Оценка появится после первой реплики.")}
      </p>
      <div className="temperature-legend" aria-label="Шкала готовности">
        <span style={{ color: "var(--bad)" }}><i />Низкая</span>
        <span style={{ color: "var(--warn)" }}><i />С напряжением</span>
        <span style={{ color: "var(--good)" }}><i />Высокая</span>
      </div>
    </section>
  );
}
