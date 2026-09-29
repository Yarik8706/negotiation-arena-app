import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getScenario, toPublicScenario } from "@/lib/scenarios/store";
import type { Attempt, ChatMessage, FinalReport, Scenario, ScenarioVariation } from "@/lib/scenarios/types";

const FILE = path.join(process.cwd(), "data", "attempts.json");
async function readAll(): Promise<Attempt[]> {
  try { const data = JSON.parse(await fs.readFile(FILE, "utf8")); return Array.isArray(data) ? data : []; }
  catch { return []; }
}
async function writeAll(items: Attempt[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(items, null, 2), "utf8");
  await fs.rename(temp, FILE);
}
export async function getAttempt(id: string) { return (await readAll()).find((a) => a.id === id) ?? null; }
export function toPublicAttempt(attempt: Attempt) {
  const publicFields = { ...attempt };
  delete publicFields.baseScenario;
  return { ...publicFields, scenario: toPublicScenario(attempt.scenario) };
}
function variantSeed(id: string): number {
  return Array.from(id).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
}
export async function createAttempt(scenarioId: string, previousAttemptId?: string, variationId?: string, previewDraft = false, profileId?: string, practiceMode: Attempt["practiceMode"] = "independent"): Promise<Attempt | null> {
  let scenario: Scenario | null;
  let baseScenario: Scenario;
  let variation: ScenarioVariation | undefined;
  if (previousAttemptId) {
    const previous = await getAttempt(previousAttemptId);
    if (!previous || previous.scenarioId !== scenarioId) return null;
    baseScenario = previous.baseScenario ?? { ...previous.scenario, variation: undefined };
    scenario = baseScenario;
  } else {
    scenario = await getScenario(scenarioId, previewDraft);
    if (!scenario) return null;
    baseScenario = scenario;
  }
  if (!scenario) return null;
  if (variationId) {
    const option = baseScenario.variationOptions?.find((item) => item.id === variationId);
    if (!option) return null;
    const seed = variantSeed(previousAttemptId ?? scenarioId);
    const old = previousAttemptId ? (await getAttempt(previousAttemptId))?.scenario.variation : undefined;
    const from = old?.to ?? option.values[seed % option.values.length];
    const choices = option.values.filter((value) => value !== from);
    const to = choices[seed % choices.length];
    if (!to) return null;
    variation = { optionId: option.id, parameter: option.parameter, label: option.label, from, to, seed };
    scenario = { ...baseScenario, variation };
  }
  const now = new Date().toISOString();
  const attempt: Attempt = { id: randomUUID(), scenarioId, scenarioVersion: scenario.version ?? 1, scenario, baseScenario, status: "active", messages: [], signals: [], report: null, createdAt: now, updatedAt: now, previousAttemptId, profileId, practiceMode };
  const items = await readAll(); items.push(attempt); await writeAll(items); return attempt;
}
export async function appendTurn(id: string, userText: string, reply: string): Promise<Attempt | null> {
  const items = await readAll(); const index = items.findIndex((a) => a.id === id);
  if (index < 0 || items[index].status !== "active") return null;
  const attempt = items[index];
  const player: ChatMessage = { id: randomUUID(), role: "user", content: userText };
  const assistant: ChatMessage = { id: randomUUID(), role: "assistant", content: reply };
  attempt.messages.push(player, assistant);
  const text = userText.toLocaleLowerCase("ru");
  const include = (id: string, patterns: RegExp[]) => patterns.some((re) => re.test(text)) && !attempt.signals.includes(id) && attempt.signals.push(id);
  include("asks-needs", [/\bпотребност/, /приоритет/, /задач/, /важно для вас/, /критери/]);
  include("offers-pilot", [/пилот/, /тестов(?:ый|ого|ую) запуск/, /ограниченн(?:ый|ого) этап/]);
  include("sets-next-step", [/следующ(?:ий|его) шаг/, /встреч/, /созвон/, /зафиксируем/, /дата проверки/, /ответственн/]);
  include("asks-priorities", [/приоритет/, /что важнее/, /перв(?:ым|ым делом)/, /объём/]);
  include("offers-staged-plan", [/этапн/, /поэтап/, /контрольн(?:ая|ую) точк/, /разобьём на этапы/]);
  include("overpromises", [/гарантирую.*(?:завтра|недел|дату|срок)/, /точно успеем/, /обещаю.*(?:срок|дату)/]);
  include("declines-unrealistic", [/не могу обещать/, /не буду обещать/, /без проверки.{0,30}(?:срок|дату)/, /не назову.{0,30}(?:срок|дату)/, /срок.{0,30}не подтверждён/]);
  for (const signal of attempt.scenario.signals ?? []) {
    if (signal.patterns.some((pattern) => text.includes(pattern.toLocaleLowerCase("ru"))) && !attempt.signals.includes(signal.id)) attempt.signals.push(signal.id);
  }
  attempt.updatedAt = new Date().toISOString(); items[index] = attempt; await writeAll(items); return attempt;
}
export function evaluate(attempt: Attempt): { id: string; label: string; score: number; signals: string[] } {
  const rules = attempt.scenario.outcomeRules ?? [];
  const unsafeRule = rules.find((rule) => rule.requiredSignals.includes("overpromises") && attempt.signals.includes("overpromises"));
  const responsibleRefusal = rules.find((rule) => rule.id === "responsible-decline" && attempt.signals.includes("declines-unrealistic"));
  const match = unsafeRule ?? responsibleRefusal ?? rules.find((rule) => rule.requiredSignals.every((signal) => attempt.signals.includes(signal)) && (rule.forbiddenSignals ?? []).every((signal) => !attempt.signals.includes(signal)));
  const fallback = rules.at(-1);
  const result = match ?? fallback ?? { id: "incomplete", label: "Данных для оценки пока мало", score: 0, requiredSignals: [] };
  return { id: result.id, label: result.label, score: result.score, signals: [...attempt.signals] };
}
export function buildReport(attempt: Attempt): FinalReport {
  const outcome = evaluate(attempt);
  const users = attempt.messages.filter((m) => m.role === "user");
  const evidence = users.slice(-3).map((message, index) => {
    const text = message.content.toLocaleLowerCase("ru");
    const question = /\?/.test(message.content) || /потребност|приоритет|важно для вас/.test(text);
    const theoryId = question ? "spin" : /пилот|этап|услов|обмен|вариант/.test(text) ? "interests-options" : "commitments";
    return { messageId: message.id ?? `user-${index + 1}`, quote: message.content, theoryId,
      explanation: question ? "Вопрос помогает выяснить интересы до предложения решения." : "Конкретное условие делает предложение проверяемым." ,
      rewrite: question ? "Что для вас будет главным критерием успешного результата?" : "Предлагаю зафиксировать условие, ответственного и дату следующей проверки." };
  });
  const score = (signal: string) => attempt.signals.includes(signal) ? 80 : 35;
  const few = users.length < 2;
  const strengths = few ? [] : [attempt.signals.includes("asks-needs") ? "Вы выясняли интересы и приоритеты собеседника." : "Вы обозначили свою позицию в диалоге.", attempt.signals.includes("sets-next-step") ? "Вы предложили зафиксировать следующий шаг." : "Вы поддерживали предметный разговор."];
  return {
    outcome, skillScores: attempt.scenario.mainSkill
      ? { [attempt.scenario.mainSkill]: score(attempt.scenario.signals?.[0]?.id ?? "asks-needs"), "Конкретный следующий шаг": score(attempt.scenario.signals?.at(-2)?.id ?? "sets-next-step") }
      : { "Выявление интересов": score("asks-needs"), "Работа с вариантами": attempt.signals.includes("offers-pilot") || attempt.signals.includes("offers-staged-plan") ? 80 : 35, "Фиксация шага": score("sets-next-step") }, evidence,
    nextExercise: `В следующей попытке примените навык «${attempt.scenario.mainSkill ?? "выявление приоритетов"}» до первого предложения и зафиксируйте проверяемый следующий шаг.`,
    strengths, weaknesses: few ? ["В диалоге мало данных для оценки навыков."] : [attempt.signals.includes("overpromises") ? "Вы обещали срок без проверки ограничений." : "Попробуйте раньше проверить интересы и ограничения собеседника."],
    recommendation: "Перед уступкой уточните интерес другой стороны, предложите проверяемый вариант и назовите следующий шаг.",
    summary: `Исход: ${outcome.label}. Учебная оценка основана на сообщениях и правилах сценария.`,
  };
}
export async function completeAttempt(id: string): Promise<Attempt | null> {
  const items = await readAll(); const index = items.findIndex((a) => a.id === id);
  if (index < 0) return null;
  const attempt = items[index]; if (attempt.status === "completed") return attempt;
  attempt.report = buildReport(attempt);
  if (attempt.previousAttemptId) {
    const previous = items.find((item) => item.id === attempt.previousAttemptId);
    if (previous?.report?.outcome && attempt.report.outcome && (previous.practiceMode ?? "independent") === (attempt.practiceMode ?? "independent") && previous.scenarioVersion === attempt.scenarioVersion
      && JSON.stringify(previous.scenario.outcomeRules ?? []) === JSON.stringify(attempt.scenario.outcomeRules ?? [])) {
      const previousSkills = previous.report.skillScores ?? {};
      const currentSkills = attempt.report.skillScores ?? {};
      attempt.report.comparison = {
        previousOutcome: previous.report.outcome.label,
        scoreDelta: attempt.report.outcome.score - previous.report.outcome.score,
        skillDeltas: Object.fromEntries(Object.keys(currentSkills).map((skill) => [skill, (currentSkills[skill] ?? 0) - (previousSkills[skill] ?? 0)])),
        changedCondition: attempt.scenario.variation,
      };
    }
  }
  attempt.status = "completed"; attempt.updatedAt = new Date().toISOString();
  items[index] = attempt; await writeAll(items); return attempt;
}
