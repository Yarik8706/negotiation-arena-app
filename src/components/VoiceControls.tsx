"use client";

import { useEffect, useRef, useState } from "react";

type RecognitionAlternative = { transcript: string };
type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal?: boolean };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => BrowserRecognition;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export function speakReply(text: string, onError?: () => void): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 1;
  utterance.onerror = () => onError?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopReply(): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  return true;
}

function describeRecognitionError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed": return "Нет доступа к микрофону. Разрешите его в настройках браузера или используйте текстовый ввод.";
    case "no-speech": return "Речь не распознана. Попробуйте ещё раз или введите реплику текстом.";
    case "audio-capture": return "Не найден микрофон. Проверьте подключение или используйте текстовый ввод.";
    case "network": return "Сервис распознавания недоступен. Проверьте соединение или введите реплику текстом.";
    default: return "Не удалось распознать речь. Можно продолжить текстом.";
  }
}

export function VoiceControls({ onTranscript }: { onTranscript: (text: string) => void }) {
  const recognition = useRef<BrowserRecognition | null>(null);
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const browserWindow = window as SpeechWindow;
    setSupported(Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition));
    return () => {
      recognition.current?.abort();
      recognition.current = null;
    };
  }, []);

  function toggleRecording() {
    if (recording) {
      recognition.current?.stop();
      setRecording(false);
      setStatus("Запись остановлена. Проверьте и исправьте расшифровку перед отправкой.");
      return;
    }
    const browserWindow = window as SpeechWindow;
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("Распознавание речи не поддерживается этим браузером. Введите реплику текстом.");
      return;
    }
    try {
      const instance = new Recognition();
      recognition.current = instance;
      let endedWithError = false;
      instance.lang = "ru-RU";
      instance.interimResults = true;
      instance.continuous = true;
      instance.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? "").join("").trim();
        if (transcript) onTranscript(transcript);
      };
      instance.onerror = (event) => {
        endedWithError = true;
        setRecording(false);
        setStatus(describeRecognitionError(event.error));
      };
      instance.onend = () => {
        setRecording(false);
        if (!endedWithError) setStatus("Распознавание завершено. Проверьте и при необходимости исправьте текст перед отправкой.");
      };
      instance.start();
      setRecording(true);
      setStatus("Идёт запись. Нажмите «Остановить запись», когда закончите.");
    } catch {
      setRecording(false);
      setStatus("Не удалось начать запись. Проверьте разрешение микрофона или используйте текстовый ввод.");
    }
  }

  if (!supported) return <p className="text-xs text-[var(--muted)]">Голосовой ввод недоступен в этом браузере. Текстовый ввод работает как обычно.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={toggleRecording} aria-pressed={recording} className={`rounded-xl border px-3 py-2 text-sm font-medium ${recording ? "border-[var(--bad)] text-[var(--bad)]" : "border-[var(--card-border)] hover:bg-[var(--accent-soft)]"}`}>
        {recording ? "Остановить запись" : "Записать реплику"}
      </button>
      <span className="text-xs text-[var(--muted)]">Расшифровку можно исправить в поле сообщения</span>
      {status && <p role="status" aria-live="polite" className="w-full text-xs text-[var(--muted)]">{status}</p>}
    </div>
  );
}
