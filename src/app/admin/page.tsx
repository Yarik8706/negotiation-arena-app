"use client";

import { useEffect, useState } from "react";
import type { OpponentCharacter, Scenario } from "@/lib/scenarios/types";
import { PlayArena } from "@/components/PlayArena";
import type { PublicScenario } from "@/lib/scenarios/types";

export default function AdminPage() {
  const [role, setRole] = useState("Директор по закупкам");
  const [sphere, setSphere] = useState("IT / SaaS");
  const [tone, setTone] = useState("жёсткий, деловой");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [playerBrief, setPlayerBrief] = useState("");
  const [playerGoal, setPlayerGoal] = useState("");
  const [playerRole, setPlayerRole] = useState("Представитель компании");
  const [category, setCategory] = useState("Авторские");
  const [mainSkill, setMainSkill] = useState("Выявление интересов");
  const [estimatedDuration, setEstimatedDuration] = useState("8–10 мин");
  const [difficulty, setDifficulty] = useState<"Базовая" | "Средняя" | "Высокая">("Базовая");
  const [opponentGoals, setOpponentGoals] = useState("");
  const [opponentLimits, setOpponentLimits] = useState("");
  const [hiddenInterests, setHiddenInterests] = useState("");
  const [outcomesText, setOutcomesText] = useState("Проверяемое соглашение | следующий шаг, критерий успеха | 85\nЧастичный результат | уточнили интересы | 60\nУсловия не согласованы |  | 35");
  const [theoryText, setTheoryText] = useState("interests-options | Интересы и варианты (Гарвардский метод)\nbatna | BATNA и границы соглашения\nspin | Вопросы SPIN\ncommitments | Фиксация договорённостей");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [previewScenario, setPreviewScenario] = useState<PublicScenario | null>(null);
  const [opponent, setOpponent] = useState<OpponentCharacter | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [list, setList] = useState<Scenario[]>([]);
  const [mockFlag, setMockFlag] = useState<boolean | null>(null);

  async function refreshList() {
    const res = await fetch("/api/scenarios?admin=1");
    setList(await res.json());
  }

  useEffect(() => {
    void refreshList();
  }, []);

  function editScenario(s: Scenario) {
    setScenarioId(s.id); setStatus(s.status === "draft" ? "draft" : "published");
    setTitle(s.title); setDescription(s.description); setPlayerBrief(s.playerBrief); setPlayerRole(s.playerRole ?? "Представитель компании"); setPlayerGoal(s.playerGoal ?? ""); setDifficulty(s.difficulty ?? "Базовая"); setCategory(s.category ?? "Авторские"); setMainSkill(s.mainSkill ?? "Выявление интересов"); setEstimatedDuration(s.estimatedDuration ?? "");
    setRole(s.opponent.role); setSphere(s.opponent.sphere); setTone(s.opponent.tone); setOpponent(s.opponent); setOpponentGoals(s.opponent.goals.join("\n")); setOpponentLimits((s.opponent.constraints ?? s.opponent.redLines).join("\n")); setHiddenInterests((s.opponent.hiddenInterests ?? []).join("\n"));
    setTheoryText((s.theory ?? []).map((item) => `${item.id} | ${item.title}`).join("\n"));
    setOutcomesText((s.outcomeRules ?? []).map((rule) => `${rule.label} | ${(rule.requiredSignals ?? []).map((id) => s.signals?.find((signal) => signal.id === id)?.patterns[0] ?? id).join(", ")} | ${rule.score}`).join("\n"));
    setMessage(`Открыта версия ${s.version ?? 1}. Сохранение создаст следующую версию.`);
  }

  async function generateCharacter() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, sphere, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");
      setOpponent(data.opponent);
      setMockFlag(!!data.mock);
      if (!title) {
        setTitle(`Переговоры с ${data.opponent.name}`);
      }
      if (!description) {
        setDescription(
          `Учебный сценарий: ${role} в сфере «${sphere}», тон — ${tone}.`
        );
      }
      if (!playerBrief) {
        setPlayerBrief(
          "Вы — продавец/переговорщик. Цель — договориться о приемлемых условиях, не нарушая маржу и сроки."
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setGenerating(false);
    }
  }

  async function saveScenario() {
    if (!opponent) {
      setMessage("Сначала сгенерируйте персонажа");
      return;
    }
    if (!role.trim() || !sphere.trim() || !tone.trim() || !title.trim() || !playerRole.trim() || !playerGoal.trim() || !playerBrief.trim()) {
      setMessage("Заполните название, роль и цель игрока, роль и сферу оппонента, тон и бриф");
      return;
    }
    const parsedOutcomes = outcomesText.split("\n").map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts.some(Boolean));
    const invalidOutcome = parsedOutcomes.find((parts) => parts.length !== 3 || !parts[0] || !/^\d+$/.test(parts[2] ?? "") || Number(parts[2]) < 0 || Number(parts[2]) > 100 || (parts[0] !== "Условия не согласованы" && !parts[1]));
    const duplicateLabels = new Set(parsedOutcomes.map((parts) => parts[0].toLocaleLowerCase("ru"))).size !== parsedOutcomes.length;
    const triggerSets = parsedOutcomes.filter((parts) => parts[1]).map((parts) => parts[1].split(",").map((x) => x.trim().toLocaleLowerCase("ru")).sort().join("|"));
    const indistinguishable = new Set(triggerSets).size !== triggerSets.length;
    const conditions = parsedOutcomes.map((parts) => (parts[1] ?? "").split(",").map((part) => part.trim().toLocaleLowerCase("ru")).filter(Boolean));
    const overlappingOutcomes = conditions.some((left, i) => left.length > 0 && conditions.some((right, j) => i !== j && right.some((condition) => left.includes(condition))));
    const parsedTheory = theoryText.split("\n").map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts.some(Boolean));
    const invalidTheory = parsedTheory.some((parts) => parts.length !== 2 || !parts[0] || !parts[1]);
    if (parsedOutcomes.length < 2 || invalidOutcome || duplicateLabels || indistinguishable || overlappingOutcomes || invalidTheory) {
      setMessage(!parsedTheory.length || invalidTheory ? "Укажите теорию в формате «id | название», по одной строке." : parsedOutcomes.length < 2 ? "Добавьте минимум два исхода в формате «название | условие 1, условие 2 | балл»." : invalidOutcome ? "Проверьте исходы: название, условия и балл от 0 до 100." : duplicateLabels ? "Названия исходов должны различаться." : indistinguishable || overlappingOutcomes ? "Условия двух исходов пересекаются. Укажите для них разные наблюдаемые фразы." : "Проверьте исходы сценария.");
      return;
    }
    const usedTriggerLabels = new Set<string>();
    const signals = parsedOutcomes.flatMap((parts, outcomeIndex) => (parts[1] ? parts[1].split(",").map((pattern, patternIndex) => ({ id: `custom-${outcomeIndex + 1}-${patternIndex + 1}`, patterns: [pattern.trim().toLocaleLowerCase("ru")] })) : []));
    const outcomeRules = parsedOutcomes.map((parts, outcomeIndex) => ({
      id: `outcome-${outcomeIndex + 1}`,
      label: parts[0],
      requiredSignals: parts[1] ? parts[1].split(",").map((_pattern, patternIndex) => `custom-${outcomeIndex + 1}-${patternIndex + 1}`) : [],
      score: Number(parts[2]),
    }));
    for (const parts of parsedOutcomes) for (const pattern of (parts[1] ?? "").split(",").map((part) => part.trim().toLocaleLowerCase("ru"))) if (pattern) usedTriggerLabels.add(pattern);
    if (usedTriggerLabels.size < 2) { setMessage("Добавьте хотя бы два разных наблюдаемых условия для оценки исхода."); return; }
    setSaving(true);
    setMessage(null);
    try {
      const scenario: Scenario = {
        id: scenarioId ?? `sc-${Date.now()}`,
        title: title || `Сценарий: ${opponent.name}`,
        description: description || "Без описания",
        playerBrief: playerBrief || "Бриф не задан",
        playerRole: playerRole.trim(), playerGoal: playerGoal.trim(), difficulty, version: 1, status,
        category: category.trim() || "Авторские", mainSkill: mainSkill.trim() || "Переговорная практика", estimatedDuration: estimatedDuration.trim() || undefined, theory: parsedTheory.map(([id, theoryTitle]) => ({ id, title: theoryTitle })),
        signals, outcomeRules, variationOptions: [{ id: "priority", parameter: "Главный приоритет оппонента", label: "изменить главный приоритет оппонента", values: ["Главный интерес оппонента — срок принятия решения", "Главный интерес оппонента — снижение рисков внедрения"] }],
        opponent: {
          ...opponent,
          role: role.trim(), sphere: sphere.trim(), tone: tone.trim(),
          hiddenInterests: hiddenInterests.split("\n").map((line) => line.trim()).filter(Boolean),
          goals: opponentGoals.split("\n").map((line) => line.trim()).filter(Boolean).length ? opponentGoals.split("\n").map((line) => line.trim()).filter(Boolean) : opponent.goals,
          constraints: opponentLimits.split("\n").map((line) => line.trim()).filter(Boolean),
          systemPrompt: `${opponent.systemPrompt}\nКонфигурация сценария: роль — ${role.trim()}; сфера — ${sphere.trim()}; тон — ${tone.trim()}; сложность — ${difficulty}; цели — ${(opponentGoals.split("\n").map((line) => line.trim()).filter(Boolean).join("; ") || opponent.goals.join("; "))}; ограничения — ${opponentLimits.split("\n").map((line) => line.trim()).filter(Boolean).join("; ") || "соблюдай реалистичные ограничения своей роли"}; скрытые интересы — ${hiddenInterests.split("\n").map((line) => line.trim()).filter(Boolean).join("; ") || "раскрывай новые интересы только в ответ на подходящие вопросы"}. Учитывай их в реакциях и не соглашайся безусловно. Условия оценки и возможные исходы: ${parsedOutcomes.map((parts) => `${parts[0]} (${parts[1] || "без условий"})`).join("; ")}.`,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario),
      });
      if (!res.ok) throw new Error("Не удалось сохранить сценарий");
      const saved = await res.json() as Scenario;
      setScenarioId(saved.id);
      setMessage(status === "draft" ? "Черновик сохранён. Игроки не увидят его в каталоге." : "Сценарий опубликован и доступен в каталоге локального демо.");
      setPreviewScenario(saved as PublicScenario);
      await refreshList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  function downloadScenario() {
    if (!opponent) return;
    const scenario: Scenario = {
      id: scenarioId ?? `sc-export-${Date.now()}`,
      title: title || `Сценарий: ${opponent.name}`,
      description,
      playerBrief,
      playerGoal, playerRole, category, mainSkill, estimatedDuration, difficulty, version: 1, status,
      opponent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(scenario, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    await fetch(`/api/scenarios?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await refreshList();
  }

  if (previewScenario) return <div className="space-y-4"><p className="border-l-2 border-[var(--accent)] pl-3 text-sm text-[var(--muted)]">Пробный раунд черновика · попытка не публикует сценарий в каталоге.</p><PlayArena scenario={previewScenario} onExit={() => { setPreviewScenario(null); void refreshList(); }} /></div>;

  return (
      <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Админ-контур</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Соберите кейс из публичного брифа, скрытых интересов, сигналов и исходов. Сначала сохраните черновик, проверьте его в пробном раунде и только потом опубликуйте.
        </p>
        <p className="mt-2 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-3 text-xs text-[var(--muted)]">Локальный демо-режим: админ-операции не защищены авторизацией. Не публикуйте этот сервер в открытом доступе; используйте только для доверенной локальной демонстрации.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <h2 className="font-medium">Параметры персонажа</h2>
          <label className="block text-xs text-[var(--muted)]">
            Роль
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">Роль игрока<input value={playerRole} onChange={(e) => setPlayerRole(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Категория<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Например: Команда" className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Навык для карточки<input value={mainSkill} onChange={(e) => setMainSkill(e.target.value)} placeholder="Например: Обмен уступками" className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Длительность · ориентир<input value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} placeholder="Например: 8–10 мин" className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">
            Сфера
            <input
              value={sphere}
              onChange={(e) => setSphere(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Тон
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void generateCharacter()}
            disabled={generating}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {generating ? "Генерация…" : "Сгенерировать оппонента"}
          </button>
          {mockFlag !== null && (
            <p className="text-xs text-[var(--muted)]">
              Режим LLM: {mockFlag ? "Groq (mock)" : "Groq"}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <h2 className="font-medium">Сценарий</h2>
          <label className="block text-xs text-[var(--muted)]">
            Название
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Описание
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Бриф игрока
            <textarea
              value={playerBrief}
              onChange={(e) => setPlayerBrief(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">Цель игрока<input value={playerGoal} onChange={(e) => setPlayerGoal(e.target.value)} placeholder="Например: согласовать проверяемый следующий шаг" className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Сложность<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"><option>Базовая</option><option>Средняя</option><option>Высокая</option></select></label>
          <label className="block text-xs text-[var(--muted)]">Цели оппонента<textarea value={opponentGoals} onChange={(e) => setOpponentGoals(e.target.value)} placeholder="По одной цели на строку" rows={2} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Ограничения оппонента<textarea value={opponentLimits} onChange={(e) => setOpponentLimits(e.target.value)} placeholder="По одному ограничению на строку" rows={2} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Скрытые интересы оппонента<textarea value={hiddenInterests} onChange={(e) => setHiddenInterests(e.target.value)} placeholder="По одному интересу на строку; игрок увидит их только через диалог" rows={2} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="block text-xs text-[var(--muted)]">Исходы и наблюдаемые условия<textarea value={outcomesText} onChange={(e) => setOutcomesText(e.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 font-mono text-xs leading-5" /><span className="mt-1 block">Формат: название | фразы для проверки через запятую | балл 0–100. Последний общий исход можно оставить без условий.</span></label>
          <label className="block text-xs text-[var(--muted)]">Теория для отчёта<textarea value={theoryText} onChange={(e) => setTheoryText(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 font-mono text-xs leading-5" /><span className="mt-1 block">Формат: якорь ссылки | название раздела, по одной строке.</span></label>
          <label className="block text-xs text-[var(--muted)]">Состояние сценария<select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="mt-1 w-full rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm"><option value="draft">Черновик — скрыт в каталоге</option><option value="published">Опубликовать в локальном каталоге</option></select></label>

          {opponent && (
            <div className="rounded-xl bg-black/25 p-3 text-xs leading-relaxed">
              <p className="font-medium text-sm">{opponent.name}</p>
              <p className="text-[var(--muted)]">{opponent.personality}</p>
              <p className="mt-2">
                <span className="text-[var(--accent)]">Цели:</span>{" "}
                {opponent.goals.join("; ")}
              </p>
              <p>
                <span className="text-[var(--warn)]">Красные линии:</span>{" "}
                {opponent.redLines.join("; ")}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveScenario()}
              disabled={saving || !opponent}
              className="rounded-xl bg-[var(--good)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {saving ? "Сохраняю…" : status === "draft" ? "Сохранить черновик" : "Сохранить и опубликовать"}
            </button>
            <button
              type="button"
              onClick={downloadScenario}
              disabled={!opponent}
              className="rounded-xl border border-[var(--card-border)] px-4 py-2 text-sm disabled:opacity-50"
            >
              Скачать JSON
            </button>
          </div>
          {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-medium">Сохранённые сценарии</h2>
        <ul className="space-y-2">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-[var(--muted)]">{s.id} · версия {s.version ?? 1} · {s.status === "draft" ? "черновик" : "опубликован"}</div>
              </div>
              <div className="flex gap-2"><button type="button" onClick={() => editScenario(s)} className="min-h-10 rounded-lg border border-[var(--card-border)] px-3 text-xs hover:border-[var(--accent)]">Редактировать</button><button
                type="button"
                onClick={() => void remove(s.id)}
                disabled={s.id === "seed-b2b-saas"}
                className="text-xs text-[var(--bad)] disabled:opacity-30"
              >
                Удалить
              </button></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
