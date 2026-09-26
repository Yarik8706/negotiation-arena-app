"use client";

import { useEffect, useRef, useState } from "react";
import { PlayArena } from "@/components/PlayArena";
import type { Scenario } from "@/lib/scenarios/types";
import { getLocalProfileId } from "@/lib/progress/client";
import { Icon } from "@/components/Icon";

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
    <div className="catalog-page dossier-catalog pb-8">
      <header className="desk-opening">
        <div className="desk-title"><p>Личная практика переговоров</p><h1>Какой разговор<br />вам предстоит?</h1></div>
        <div className="desk-orientation"><p>Выберите знакомую ситуацию. Здесь можно проверить свой ход, услышать ответ и вернуться к разговору с другим решением.</p><div className="desk-cycle"><span>Ситуация</span><span aria-hidden="true">→</span><span>Диалог</span><span aria-hidden="true">→</span><span>Разбор реплик</span></div><a href="/diagnostic">Не знаете, с чего начать? Пройдите диагностику <Icon name="arrow-up-right" size={15} /></a></div>
      </header>

      <section className="catalog-practice" aria-labelledby="quick-start-title">
        <div className="quick-start">
          <div className="quick-start-heading">
            <div><h2 id="quick-start-title">Что хочется отработать?</h2></div>
          </div>
          <div className="quick-start-links">
            {skillEntrances.map((item) => <button key={item.scenarioId} type="button" onClick={() => { const target = scenarios.find((s) => s.id === item.scenarioId); if (target) setSelected(target); }} disabled={!scenarios.some((s) => s.id === item.scenarioId)}>{item.label} <Icon name="arrow-up-right" size={15} /></button>)}
          </div>
        </div>
        <div className="practice-mode">
          <div><p className="practice-mode-title">Режим попытки</p><p className="practice-mode-hint">Сравнение учитывает режим отдельно.</p></div>
          <div className="practice-mode-options" role="group" aria-label="Режим практики">
            <button type="button" aria-pressed={practiceMode === "independent"} onClick={() => setPracticeMode("independent")} className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 text-sm">Самостоятельно</button>
            <button type="button" aria-pressed={practiceMode === "guided"} onClick={() => setPracticeMode("guided")} className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 text-sm">С подсказками</button>
          </div>
        </div>
      </section>

      <section aria-labelledby="catalog-title" id="scenario-catalog">
        <div className="section-heading-row">
          <div><h2 id="catalog-title">Ситуации для практики <small>{filtered.length}</small></h2></div>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Направление
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-11 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 text-[var(--foreground)]">
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg border border-[var(--bad)]/40 p-3 text-sm text-[var(--bad)]">{error}</p>}
        {loading ? <p className="py-8 text-sm text-[var(--muted)]">Загружаем сценарии…</p> : filtered.length === 0 ? <p className="py-8 text-sm text-[var(--muted)]">В этом направлении пока нет опубликованных сценариев.</p> :
          <div className="case-list">
            {catalogScenarios.map((s) => (
              <button key={s.id} type="button" onClick={() => setSelected(s)} className="case-entry">
                <div className="case-context"><span>{s.category || "Авторский сценарий"}</span><small>{s.difficulty || "Сложность не задана"}</small></div>
                <div className="case-story"><h3>{featuredTitles[s.id] ?? s.title}</h3><p>{s.description}</p><span className="case-role">Ваша роль · {s.playerRole ?? s.opponent.role}</span></div>
                <div className="case-practice"><strong>{s.mainSkill ?? "Переговорная практика"}</strong><small>{s.estimatedDuration ? s.estimatedDuration + " · ориентир" : "В своём темпе"}</small><span>Начать разговор <Icon name="arrow-up-right" size={17} /></span></div>
              </button>
            ))}
          </div>}

        <p className="mt-3 text-xs text-[var(--muted)]">Время прохождения указано как ориентир. Реальная длительность зависит от темпа диалога.</p>
      </section>

      <footer className="catalog-tools flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-[var(--muted)]">Оценки — учебные сигналы по тексту реплик. Они помогают заметить приёмы, но не заменяют экспертную оценку переговоров.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-lg border border-[var(--card-border)] px-3 text-sm hover:bg-white/5">Загрузить сценарий JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUpload(file); e.target.value = ""; }} />
          <a href="/learn" className="flex min-h-11 items-center px-3 text-sm underline underline-offset-4">Справочник приёмов</a>
          <a href="/admin" className="flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110">Администратору</a>
        </div>
        {profileId && <a href="/progress" className="min-h-11 flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-4 text-sm">Мой прогресс <Icon name="arrow-up-right" size={15} /></a>}
      </footer>
    </div>
  );
}
