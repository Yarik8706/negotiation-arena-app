"use client";

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const attemptKey = `arena-attempt:${scenario.id}:${practiceMode}`;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const savedId = localStorage.getItem(attemptKey);
        if (savedId) {
          const res = await fetch(`/api/attempts?id=${encodeURIComponent(savedId)}`);
          if (res.ok) {
            const data = await res.json();
            const savedAttempt = data.attempt ?? data;
            if (!cancelled && savedAttempt?.scenarioId === scenario.id && savedAttempt.status === "active") {
              setAttemptId(savedAttempt.id); setMessages(savedAttempt.messages); setReady(true); return;
            }
            if (!cancelled && savedAttempt?.scenarioId === scenario.id && savedAttempt.status === "completed" && savedAttempt.report) {
              setAttemptId(savedAttempt.id); setMessages(savedAttempt.messages); setReport(savedAttempt.report); setReady(true); return;
            }
          }
        }
        const res = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId: scenario.id, preview: scenario.status === "draft", profileId: getLocalProfileId(), practiceMode }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Не удалось начать раунд");
        if (!cancelled) { setAttemptId(data.id); localStorage.setItem(attemptKey, data.id); setReady(true); }
      } catch (error) { if (!cancelled) { setRoundError(error instanceof Error ? error.message : "Не удалось восстановить раунд"); setReady(true); } }
    })();
    return () => { cancelled = true; };
  }, [attemptKey, scenario.id, scenario.status, practiceMode]);

  const fetchTemperature = useCallback(async (msgs: ChatMessage[]) => {
    setTempLoading(true);
    try {
      const res = await fetch("/api/temperature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const fetchAdvice = useCallback(async (msgs: ChatMessage[]) => {
    setAdviceLoading(true);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
    const res = await fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId: scenario.id, previousAttemptId: attemptId, variationId, preview: scenario.status === "draft", profileId: getLocalProfileId(), practiceMode }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Не удалось начать повтор");
      setAttemptId(data.id); localStorage.setItem(attemptKey, data.id);
      setMessages([]); setReport(null); setTempScore(null); setTempReason(null); setAdvice(null); setReady(true); if (practiceMode === "guided") void fetchAdvice([]);
    } catch (error) { setRoundError(error instanceof Error ? error.message : "Не удалось начать повтор"); setReady(true); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{scenario.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Оппонент: {scenario.opponent.name} · {scenario.opponent.role}
          </p>
          {scenario.playerGoal && <p className="mt-1 text-sm">Цель раунда: {scenario.playerGoal}</p>}
          {scenario.variation && <p className="mt-2 border-l-2 border-[var(--warn)] pl-2 text-xs text-[var(--muted)]">Повтор: изменено только «{scenario.variation.parameter}» — {scenario.variation.to}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-[var(--card-border)] px-3 py-2 text-sm hover:bg-white/5"
          >
            К сценариям
          </button>
          <button
            type="button"
            onClick={() => void endNegotiation()}
            disabled={ending || (practiceMode === "diagnostic" && userTurns < 3)}
            className="rounded-xl bg-[var(--warn)]/90 px-3 py-2 text-sm font-medium text-black hover:brightness-110 disabled:opacity-50"
          >
            {ending ? "Формирую…" : "Завершить переговоры"}
          </button>
        </div>
      </div>

      {roundError && <p role="alert" className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 p-3 text-sm text-[var(--bad)]">{roundError}</p>}

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--accent-soft)]/40 p-3 text-sm">
        <strong className="text-[var(--accent)]">Ваш бриф:</strong>{" "}
        {scenario.playerBrief}
      </div>

      <div className={`grid gap-4 ${practiceMode === "independent" ? "grid-cols-1" : "lg:grid-cols-[1fr_280px]"}`}>
        <div className="flex min-h-[420px] flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card)]">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!ready && <p className="text-sm text-[var(--muted)]">Восстанавливаю раунд…</p>}
            {ready && messages.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                Напишите первое сообщение оппоненту, чтобы начать переговоры.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-[var(--accent)] text-white"
                    : "bg-black/30 text-[var(--foreground)]"
                }`}
              >
                <div className="mb-0.5 text-xs font-medium opacity-80">
                  {m.role === "user" ? "Вы" : scenario.opponent.name}
                </div>
                {m.content}
                {m.role === "assistant" && (
                  <span className="ml-2 inline-flex gap-1">
                    <button type="button" className="rounded-md px-2 py-1 text-xs underline underline-offset-2 hover:bg-[var(--accent-soft)]" onClick={() => {
                      const started = speakReply(m.content, () => setSpeechError("Не удалось воспроизвести ответ. Прочитайте его в чате."));
                      setSpeechError(started ? null : "Озвучивание недоступно в этом браузере. Ответ доступен текстом.");
                    }}>Озвучить</button>
                    <button type="button" className="rounded-md px-2 py-1 text-xs underline underline-offset-2 hover:bg-[var(--accent-soft)]" onClick={() => {
                      setSpeechError(stopReply() ? "Озвучивание остановлено." : "Управление воспроизведением недоступно в этом браузере.");
                    }}>Остановить</button>
                  </span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-[var(--card-border)] px-3 pt-3">
            <VoiceControls onTranscript={(text) => { setInput(text); setSpeechError(null); }} />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} className="accent-[var(--accent)]" />
              Озвучивать ответы собеседника
            </label>
            {speechError && <p role="status" aria-live="polite" className="mt-2 text-xs text-[var(--warn)]">{speechError}</p>}
          </div>
          <form
            onSubmit={sendMessage}
            className="flex gap-2 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ваша реплика…"
              disabled={busy || !ready || !attemptId}
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
        </div>

        {practiceMode === "guided" && <div className="flex flex-col gap-4">
          <TemperatureMeter
            score={tempScore}
            reason={tempReason}
            loading={tempLoading}
          />
          {practiceMode === "guided" && <div className="min-h-[220px] flex-1"><AdvisorSidebar
              advice={advice}
              loading={adviceLoading}
              onRefresh={() => void fetchAdvice(messages)}
            /></div>}
        </div>}
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
