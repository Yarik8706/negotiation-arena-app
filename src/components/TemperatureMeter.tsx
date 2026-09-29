"use client";

type Props = {
  score: number | null;
  reason: string | null;
  loading?: boolean;
};

function colorFor(score: number): string {
  if (score >= 70) return "var(--good)";
  if (score >= 40) return "var(--warn)";
  return "var(--bad)";
}

export function TemperatureMeter({ score, reason, loading }: Props) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Температура сделки</span>
        <span className="text-[var(--muted)]">
          {loading ? "…" : score === null ? "—" : `${score}/100`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--accent-soft)]">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${score ?? 0}%`,
            background: score === null ? "transparent" : colorFor(score),
          }}
        />
      </div>
      {reason && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          {reason}
        </p>
      )}
    </div>
  );
}
