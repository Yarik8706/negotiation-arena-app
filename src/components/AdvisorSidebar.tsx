"use client";

type Props = {
  advice: string | null;
  loading?: boolean;
  onRefresh: () => void;
};

export function AdvisorSidebar({ advice, loading, onRefresh }: Props) {
  return (
    <aside className="flex h-full flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">🧠 Внутренний советник</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)] hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Думаю…" : "Совет"}
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Отдельный поток: подсказки по тактике, не голос оппонента.
      </p>
      <div className="flex-1 overflow-y-auto rounded-lg bg-black/20 p-3 text-sm leading-relaxed">
        {advice ?? "Нажмите «Совет», чтобы получить подсказку."}
      </div>
    </aside>
  );
}
