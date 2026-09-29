"use client";

import { useEffect, useRef, useState } from "react";
import { PlayArena } from "@/components/PlayArena";
import type { Scenario } from "@/lib/scenarios/types";
import { getLocalProfileId } from "@/lib/progress/client";

const skillEntrances = [
  { label: "Задавать вопросы", scenarioId: "pilot-prospect" },
  { label: "Не уступать сразу", scenarioId: "discount-request" },
  { label: "Договориться о следующем шаге", scenarioId: "salary-review" },
];

export default function HomePage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Все направления");
  const [practiceMode, setPracticeMode] = useState<"guided" | "independent">("independent");
  const [profileId, setProfileId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadScenarios() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scenarios");
      if (!res.ok) throw new Error("Не удалось загрузить каталог");
      setScenarios(await res.json());
    } catch {
      setError("Каталог временно недоступен. Обновите страницу или попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadScenarios(); }, []);
  useEffect(() => { setProfileId(getLocalProfileId()); }, []);

  async function onUpload(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Scenario | Scenario[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch("/api/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items.length === 1 ? items[0] : items) });
      if (!res.ok) throw new Error("upload failed");
      await loadScenarios();
    } catch {
      setError("Файл не удалось загрузить. Проверьте, что это корректный JSON сценария.");
    }
  }

  if (selected) return <PlayArena scenario={selected} onExit={() => setSelected(null)} practiceMode={practiceMode} />;

  const categories = ["Все направления", ...Array.from(new Set(scenarios.map((s) => s.category).filter(Boolean) as string[]))];
  const filtered = filter === "Все направления" ? scenarios : scenarios.filter((s) => s.category === filter);
  const featuredOrder = ["pilot-prospect", "project-deadline", "salary-review"];
  const featuredIds = new Set(featuredOrder);
  const featuredTitles: Record<string, string> = {
    "pilot-prospect": "Клиент сомневается в пилоте",
    "project-deadline": "Невозможный дедлайн",
    "salary-review": "Повышение зарплаты",
  };
  const catalogScenarios = [...filtered].sort((a, b) => {
    const aIndex = featuredOrder.indexOf(a.id);
    const bIndex = featuredOrder.indexOf(b.id);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });

  return (
    <div className="space-y-10 pb-8">
      <header className="border-b border-[var(--card-border)] pb-8 pt-3">
        <p className="mb-4 text-xs font-medium uppercase tracking-[.12em] text-[var(--accent)]">Тренажёр · индивидуальная практика</p>
        <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-end">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">Подготовьтесь к переговорам</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">Потренируйтесь выяснять интересы, предлагать варианты и фиксировать договорённости. После раунда разберём конкретные реплики.</p>
          </div>
          <div className="border-l-2 border-[var(--accent)] pl-4 text-sm leading-6 text-[var(--muted)]">
            <strong className="font-medium text-[var(--foreground)]">Для тренировки</strong><br/>Ситуации учебные. Реальные данные о зарплате или компаниях не нужны.
          </div>
        </div>
      </header>

      <section aria-labelledby="quick-start-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-medium uppercase tracking-[.1em] text-[var(--muted)]">Быстрый старт</p><h2 id="quick-start-title" className="mt-1 text-xl font-semibold">Выберите навык</h2></div>
          <div className="flex flex-wrap gap-2">
            {skillEntrances.map((item) => <button key={item.scenarioId} type="button" onClick={() => { const target = scenarios.find((s) => s.id === item.scenarioId); if (target) setSelected(target); }} disabled={!scenarios.some((s) => s.id === item.scenarioId)} className="min-h-11 rounded-full border border-[var(--card-border)] px-4 text-sm transition hover:border-[var(--accent)] disabled:opacity-40">{item.label} ↗</button>)}
          </div>
        </div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <div><p className="font-medium">Режим попытки</p><p className="text-sm text-[var(--muted)]">Сравнение учитывает режим отдельно.</p></div>
          <div className="flex gap-2" role="group" aria-label="Режим практики">
            <button type="button" aria-pressed={practiceMode === "independent"} onClick={() => setPracticeMode("independent")} className={`min-h-11 rounded-lg border px-4 text-sm ${practiceMode === "independent" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--card-border)]"}`}>Самостоятельно</button>
            <button type="button" aria-pressed={practiceMode === "guided"} onClick={() => setPracticeMode("guided")} className={`min-h-11 rounded-lg border px-4 text-sm ${practiceMode === "guided" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--card-border)]"}`}>С подсказками</button>
          </div>
        </div>
      </section>

      <section aria-labelledby="catalog-title" id="scenario-catalog">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--card-border)] pb-4">
          <div><p className="text-xs font-medium uppercase tracking-[.1em] text-[var(--muted)]">Каталог · {scenarios.length} сценариев</p><h2 id="catalog-title" className="mt-1 text-2xl font-semibold">Практика переговоров</h2></div>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Направление
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-11 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 text-[var(--foreground)]">
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg border border-[var(--bad)]/40 p-3 text-sm text-[var(--bad)]">{error}</p>}
        {loading ? <p className="py-8 text-sm text-[var(--muted)]">Загружаем сценарии…</p> : filtered.length === 0 ? <p className="py-8 text-sm text-[var(--muted)]">В этом направлении пока нет опубликованных сценариев.</p> :
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalogScenarios.map((s, index) => (
              <button key={s.id} type="button" onClick={() => setSelected(s)} className={`group flex min-h-[250px] flex-col border bg-[var(--card)] p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] ${featuredIds.has(s.id) ? "border-[var(--accent)]/45" : "border-[var(--card-border)]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[var(--muted)]">{index + 1} · {s.category ?? "Сценарий"}</span>
                  <span className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[11px]">{s.difficulty ?? "Средняя"}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold leading-snug">{featuredTitles[s.id] ?? s.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{s.description}</p>
                <div className="mt-auto border-t border-[var(--card-border)] pt-4">
                  <p className="text-xs text-[var(--muted)]">{s.playerRole ?? s.opponent.role}</p>
                  <p className="mt-1 text-sm">{s.mainSkill ?? "Переговорная практика"}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]"><span>{s.estimatedDuration ?? "Длительность уточняется"} · ориентир</span><span className="font-medium text-[var(--accent)] group-hover:translate-x-1">Начать →</span></div>
                </div>
              </button>
            ))}
          </div>}
        <p className="mt-3 text-xs text-[var(--muted)]">Время прохождения указано как ориентир. Реальная длительность зависит от темпа диалога.</p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--card-border)] pt-5">
        <p className="max-w-xl text-xs leading-5 text-[var(--muted)]">Оценки — учебные сигналы по тексту реплик. Они помогают заметить приёмы, но не заменяют экспертную оценку переговоров.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-lg border border-[var(--card-border)] px-3 text-sm hover:bg-white/5">Загрузить сценарий JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUpload(file); e.target.value = ""; }} />
          <a href="/admin" className="flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110">Администратору</a>
        </div>
        {profileId && <a href="/progress" className="min-h-11 flex items-center rounded-lg border border-[var(--card-border)] px-4 text-sm">Мой прогресс ↗</a>}
      </footer>
    </div>
  );
}
