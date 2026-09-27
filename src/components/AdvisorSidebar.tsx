"use client";

type Props = {
  advice: string | null;
  loading?: boolean;
  onRefresh: () => void;
};

export function AdvisorSidebar({ advice, loading, onRefresh }: Props) {
  return (
    <aside className="advisor-card flex h-full flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4" aria-labelledby="advisor-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="advisor-title" className="text-sm font-semibold">Внутренний советник</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="min-h-11 rounded-lg bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)] hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Думаю…" : "Совет"}
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Отдельный приватный поток: тактические подсказки, не голос оппонента.
      </p>
      <div className="advisor-copy flex-1 overflow-y-auto rounded-lg bg-black/20 p-3 text-sm leading-relaxed" aria-live="polite">
        {advice ?? "Нажмите «Совет», чтобы получить подсказку."}
      </div>
    </aside>
  );
}
