"use client";

import { Icon } from "@/components/Icon";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdvisorSidebar } from "@/components/AdvisorSidebar";
import { FinalReportView } from "@/components/FinalReport";
import { TemperatureMeter } from "@/components/TemperatureMeter";
import { VoiceControls, speakReply, stopReply } from "@/components/VoiceControls";
import type {
  ChatMessage,
  FinalReport,
  PublicScenario,
} from "@/lib/scenarios/types";
import { getLocalProfileId } from "@/lib/progress/client";

type Props = {
  scenario: PublicScenario;
  onExit: () => void;
  practiceMode?: "guided" | "independent" | "diagnostic";
};

export function PlayArena({ scenario, onExit, practiceMode = "independent" }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [tempScore, setTempScore] = useState<number | null>(null);
  const [tempReason, setTempReason] = useState<string | null>(null);
  const [tempLoading, setTempLoading] = useState(false);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [ending, setEnding] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [roundError, setRoundError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const userTurns = messages.filter((message) => message.role === "user").length;
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (messages.length > 0 && transcriptRef.current) {
      transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const fetchTemperature = useCallback(async (msgs: ChatMessage[]) => {
    setTempLoading(true);
    try {
      const res = await fetch("/api/temperature", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-profile-id": getLocalProfileId() },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await res.json();
      setTempScore(data.score);
      setTempReason(data.reason);
    } catch {
      setTempReason("Не удалось оценить температуру.");
    } finally {
      setTempLoading(false);
    }
  }, []);

  const attemptKey = `arena-attempt:${scenario.id}:${practiceMode}`;
  const attemptInitRef = useRef<{
    key: string;
    promise: Promise<{ id: string; messages: ChatMessage[]; report: FinalReport | null }>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let initialization = attemptInitRef.current;
    if (!initialization || initialization.key !== attemptKey) {
      const promise = (async () => {
        const savedId = localStorage.getItem(attemptKey);
        if (savedId) {
          const res = await fetch(`/api/attempts?id=${encodeURIComponent(savedId)}`, { headers: { "x-profile-id": getLocalProfileId() } });
          if (res.ok) {
            const data = await res.json();
            const savedAttempt = data.attempt ?? data;
            if (savedAttempt?.scenarioId === scenario.id && (savedAttempt.status === "active" || (savedAttempt.status === "completed" && savedAttempt.report))) {
              return {
                id: savedAttempt.id as string,
                messages: (savedAttempt.messages ?? []) as ChatMessage[],
                report: (savedAttempt.report ?? null) as FinalReport | null,
              };
            }
          }
        }
        const res = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json", "x-profile-id": getLocalProfileId() }, body: JSON.stringify({ scenarioId: scenario.id, preview: scenario.status === "draft", profileId: getLocalProfileId(), practiceMode }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Не удалось начать раунд");
        localStorage.setItem(attemptKey, data.id);
        return { id: data.id as string, messages: [] as ChatMessage[], report: null };
      })();
      initialization = { key: attemptKey, promise };
      attemptInitRef.current = initialization;
    }
    void initialization.promise.then((savedAttempt) => {
      if (cancelled) return;
      setAttemptId(savedAttempt.id);
      setMessages(savedAttempt.messages);
      if (savedAttempt.messages.length) void fetchTemperature(savedAttempt.messages);
      setReport(savedAttempt.report);
      setReady(true);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setRoundError(error instanceof Error ? error.message : "Не удалось восстановить раунд");
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [attemptKey, fetchTemperature, scenario.id, scenario.status, practiceMode]);

  const fetchAdvice = useCallback(async (msgs: ChatMessage[]) => {
    setAdviceLoading(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-profile-id": getLocalProfileId() },
        body: JSON.stringify({ scenarioId: scenario.id, messages: msgs }),
      });
      const data = await res.json();
      setAdvice(data.advice ?? data.error);
    } catch {
      setAdvice("Ошибка запроса советника.");
    } finally {
      setAdviceLoading(false);
    }
  }, [scenario.id]);

  useEffect(() => {
    if (practiceMode === "guided") void fetchAdvice([]);
  }, [fetchAdvice, practiceMode]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !attemptId || !ready) return;
    if (practiceMode === "diagnostic" && userTurns >= 5) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/attempts/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-profile-id": getLocalProfileId() },
        body: JSON.stringify({ attemptId, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка чата");
      const withReply = data.attempt.messages as ChatMessage[];
      setMessages(withReply);
      const reply = withReply.at(-1);
      if (reply?.role === "assistant" && speakReplies) {
        const started = speakReply(reply.content, () => setSpeechError("Не удалось воспроизвести ответ. Прочитайте его в чате или нажмите «Озвучить» ещё раз."));
        setSpeechError(started ? null : "Озвучивание недоступно в этом браузере. Ответ доступен текстом.");
      }
      void fetchTemperature(withReply);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `⚠ ${err instanceof Error ? err.message : "Ошибка"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function endNegotiation() {
    setEnding(true);
    try {
      if (!attemptId) throw new Error("Попытка ещё не готова");
      const res = await fetch("/api/attempts/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-profile-id": getLocalProfileId() },
        body: JSON.stringify({ attemptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось завершить раунд");
      setReport(data.attempt.report);
    } catch (error) {
      setRoundError(error instanceof Error ? error.message : "Ошибка формирования отчёта");
      setReport({
        strengths: [],
        weaknesses: ["Не удалось сформировать отчёт"],
        recommendation: "Попробуйте ещё раз.",
        summary: "Ошибка генерации отчёта.",
      });
    } finally {
      setEnding(false);
    }
  }

  async function restart(variationId?: string) {
    if (!attemptId) return;
    setReady(false); setRoundError(null);
    try {
    const res = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json", "x-profile-id": getLocalProfileId() }, body: JSON.stringify({ scenarioId: scenario.id, previousAttemptId: attemptId, variationId, preview: scenario.status === "draft", profileId: getLocalProfileId(), practiceMode }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Не удалось начать повтор");
      setAttemptId(data.id); localStorage.setItem(attemptKey, data.id);
      setMessages([]); setReport(null); setTempScore(null); setTempReason(null); setAdvice(null); setReady(true); if (practiceMode === "guided") void fetchAdvice([]);
    } catch (error) { setRoundError(error instanceof Error ? error.message : "Не удалось начать повтор"); setReady(true); }
  }

  return (
    <div className="round-page">
      <div className="round-context">
      <div className="round-heading flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{scenario.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Оппонент: {scenario.opponent.name} · {scenario.opponent.role}
          </p>

          {scenario.variation && <p className="mt-2 border-l-2 border-[var(--warn)] pl-2 text-xs text-[var(--muted)]">Повтор: изменено только «{scenario.variation.parameter}» — {scenario.variation.to}</p>}
          <span className="round-mode-tag">{practiceMode === "guided" ? "С подсказками" : practiceMode === "diagnostic" ? "Стартовая диагностика · 3–5 ходов" : "Самостоятельно"}</span>
        </div>
        <div className="round-actions">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-[var(--card-border)] px-3 text-sm hover:bg-white/5"
          >
            К сценариям
          </button>
          <button
            type="button"
            onClick={() => void endNegotiation()}
            disabled={ending || (practiceMode === "diagnostic" && userTurns < 3)}
            className="rounded-xl bg-[var(--warn)]/90 px-3 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50"
          >
            {ending ? "Формирую…" : "Завершить переговоры"}
          </button>
        </div>
      </div>

      {roundError && <p role="alert" className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 p-3 text-sm text-[var(--bad)]">{roundError}</p>}

      </div>

      <div className="round-layout">
        <aside className="round-dossier" aria-label="Ваша задача в переговорах">
          <p className="dossier-label">Ваша сторона</p>
          <h2>{scenario.playerRole ?? "Участник переговоров"}</h2>
          {scenario.playerGoal && <div className="dossier-goal"><span>К чему стремиться</span><p>{scenario.playerGoal}</p></div>}
          <div className="dossier-brief"><h3>Что известно перед встречей</h3><p>{scenario.playerBrief}</p></div>
          <a href="/learn" target="_blank" rel="noreferrer">Справочник приёмов <Icon name="arrow-up-right" size={14} /></a>
        </aside>
        <section className="round-chat flex min-h-[420px] flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card)]" aria-label="Диалог переговоров">
          <header className="round-chat-header">
            <span className="round-avatar" aria-hidden="true">{scenario.opponent.name.slice(0, 1)}</span>
            <span className="round-person"><strong>{scenario.opponent.name}</strong><small>{scenario.opponent.role}</small></span>
            <span className="round-presence"><i /> {busy ? "Печатает" : "В диалоге"}</span>
          </header>
          <div ref={transcriptRef} className="round-transcript flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions text">
            {!ready && <p className="text-sm text-[var(--muted)]">Восстанавливаю раунд…</p>}
            {ready && messages.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                Напишите первое сообщение оппоненту, чтобы начать переговоры.
              </p>
            )}
            {messages.map((m, i) => (
              <article
                key={i}
                className={"round-message " + (m.role === "user" ? "is-player ml-auto" : "is-opponent")}
              >
                <div className="round-message-author">
                  {m.role === "user" ? "Вы" : scenario.opponent.name}
                </div>
                {m.content}
                {m.role === "assistant" && (
                  <span className="round-message-tools">
                    <button type="button" className="rounded-md px-2 py-1 text-xs underline underline-offset-2 hover:bg-[var(--accent-soft)]" onClick={() => {
                      const started = speakReply(m.content, () => setSpeechError("Не удалось воспроизвести ответ. Прочитайте его в чате."));
                      setSpeechError(started ? null : "Озвучивание недоступно в этом браузере. Ответ доступен текстом.");
                    }}>Озвучить</button>
                    <button type="button" className="rounded-md px-2 py-1 text-xs underline underline-offset-2 hover:bg-[var(--accent-soft)]" onClick={() => {
                      setSpeechError(stopReply() ? "Озвучивание остановлено." : "Управление воспроизведением недоступно в этом браузере.");
                    }}>Остановить</button>
                  </span>
                )}
              </article>
            ))}
            {busy && <div className="round-typing" aria-label="Собеседник готовит ответ"><i /><i /><i /></div>}
          </div>
          <div className="round-chat-tools border-t border-[var(--card-border)] px-3 pt-3">
            <VoiceControls onTranscript={(text) => { setInput(text); setSpeechError(null); }} />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} className="accent-[var(--accent)]" />
              Озвучивать ответы собеседника
            </label>
            {speechError && <p role="status" aria-live="polite" className="mt-2 text-xs text-[var(--warn)]">{speechError}</p>}
          </div>
          <form
            onSubmit={sendMessage}
            className="round-composer flex"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ваша реплика…"
              disabled={busy || !ready || !attemptId}
              aria-label="Ваша реплика"
              className="flex-1 rounded-xl border border-[var(--card-border)] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={busy || !ready || !attemptId || !input.trim() || (practiceMode === "diagnostic" && userTurns >= 5)}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "…" : "Отправить"}
            </button>
          </form>
        </section>

        <aside className="round-rail" aria-label="Состояние раунда">
          <TemperatureMeter
            score={tempScore}
            reason={tempReason}
            loading={tempLoading}
          />
          {practiceMode === "guided" ? <div className="min-h-[220px] flex-1"><AdvisorSidebar
              advice={advice}
              loading={adviceLoading}
              onRefresh={() => void fetchAdvice(messages)}
            /></div> : <p className="round-mode-note">{practiceMode === "diagnostic" ? "В диагностике вы наблюдаете за ходом беседы без тактических подсказок." : "Самостоятельный режим: оценка состояния доступна, тактические подсказки отключены."}</p>}
        </aside>
      </div>

      {report && (
        <FinalReportView
          report={report}
          practiceMode={practiceMode}
          variationOptions={scenario.variationOptions}
          currentVariation={scenario.variation}
          onClose={() => setReport(null)}
          onRestart={restart}
        />
      )}
    </div>
  );
}
