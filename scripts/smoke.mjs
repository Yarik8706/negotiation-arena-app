import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const testAttemptIds = [];
const profileId = `local-${randomUUID()}`;
const accessHeaders = { "x-profile-id":profileId, ...(process.env.SMOKE_ADMIN_TOKEN ? { authorization:`Bearer ${process.env.SMOKE_ADMIN_TOKEN}` } : {}) };
async function cleanup() {
  for (const id of testAttemptIds) {
    try { await fetch(`${base}/api/attempts/${id}`,{method:"DELETE",headers:accessHeaders}); } catch { /* test server may be unavailable */ }
  }
  for (const id of ["smoke-config-calm", "smoke-config-firm", "smoke-custom-draft"]) {
    try { await fetch(`${base}/api/scenarios?id=${id}`, { method: "DELETE", headers:accessHeaders }); } catch { /* The server may have stopped after a failed run. */ }
  }
}
async function request(path, init) {
  const response = await fetch(`${base}${path}`, { ...init, headers:{...accessHeaders,...init?.headers} });
  const data = await response.json();
  return { response, data };
}
async function start(scenarioId, previousAttemptId, variationId, preview = false) {
  const { response, data } = await request("/api/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId, previousAttemptId, variationId, preview, profileId }) });
  assert.equal(response.status, 201, JSON.stringify(data));
  testAttemptIds.push(data.id);
  return data;
}
async function play(attempt, text) {
  const { response, data } = await request("/api/attempts/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: attempt.id, text }) });
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.attempt.messages.at(-2).content, text);
  assert.ok(data.attempt.messages.at(-1).content.length > 0);
  return data.attempt;
}
async function finish(attemptId) {
  const { response, data } = await request("/api/attempts/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId }) });
  assert.equal(response.status, 200, JSON.stringify(data));
  return data.attempt;
}

try {
const { response: listResponse, data: scenarios } = await request("/api/scenarios");
assert.equal(listResponse.status, 200);
assert.ok(scenarios.some((s) => s.id === "pilot-prospect"));
assert.ok(scenarios.some((s) => s.id === "project-deadline"));
for (const id of ["discount-request", "supplier-price-increase", "team-conflict", "partner-questions", "unclear-partnership"]) assert.ok(scenarios.some((s) => s.id === id), `Missing ${id}`);
assert.ok(scenarios.some((s) => s.id === "salary-review"), "Missing salary review scenario");
const exposed = JSON.stringify(scenarios);
for (const secret of ["systemPrompt", "redLines", "hiddenInterests", "constraints"]) assert.ok(!exposed.includes(secret), `Public scenario exposed ${secret}`);
assert.ok(!exposed.includes("outcomeRules") && !exposed.includes("signals"), "Public catalog must not expose evaluation rules");
const invalid = await request("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "bad" }) });
assert.equal(invalid.response.status, 400);

const configuredReplies = [];
for (const [id, tone] of [["smoke-config-calm", "спокойный аналитичный"], ["smoke-config-firm", "настойчивый деловой"]]) {
  const scenario = {
    id, version: 1, title: "Smoke: configured character", description: "Проверка тональности персонажа",
    playerBrief: "Проверьте критерии перед предложением.", playerGoal: "Выяснить критерии и зафиксировать шаг", difficulty: "Высокая",
    opponent: { name: "Тестовый оппонент", role: "Директор", sphere: "B2B", tone, personality: "Проверяет факты", goals: ["Понять пользу"], redLines: ["Не принимать пустые обещания"], hiddenInterests: ["Срок важен"], constraints: ["Нужно проверить риск"], style: "Краткие ответы", systemPrompt: `Ты — тестовый директор. Сфера — B2B. Тон — ${tone}. Сложность — высокая. Цели — понять пользу. Ограничение — проверить риск.` },
    outcomeRules: [{ id: "next-step", label: "Есть следующий шаг", requiredSignals: ["asks-needs", "sets-next-step"], score: 80 }, { id: "no-agreement", label: "Пока нет договорённости", requiredSignals: [], score: 30 }],
    theory: [{ id: "spin", title: "Вопросы SPIN" }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const saved = await request("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(scenario) });
  assert.equal(saved.response.status, 200);
  const configured = await start(id);
  const turn = await play(configured, "Какие критерии будут важны при оценке этого варианта?");
  configuredReplies.push(turn.messages.at(-1).content);
  const changed = await request("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...saved.data, title: `${scenario.title} (изменён)` }) });
  assert.equal(changed.data.version, 2);
  const snapshotRetry = await start(id, configured.id);
  assert.equal(snapshotRetry.scenario.title, scenario.title, "Retry must preserve the original scenario snapshot");
  assert.equal(snapshotRetry.scenarioVersion, 1);
  await request(`/api/scenarios?id=${id}`, { method: "DELETE", headers:accessHeaders });
}
assert.notEqual(configuredReplies[0], configuredReplies[1], "Changing configured tone should change the deterministic mock reply");

const pilot = await start("pilot-prospect");
const advice = await request("/api/advisor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: "pilot-prospect", messages: [] }) });
assert.equal(advice.response.status, 200);
assert.doesNotMatch(advice.data.advice, /скидк|предоплат/, "Pilot advice must not refer to unrelated pricing terms");
let updated = await play(pilot, "Какая задача для вас важнее и что станет критерием успеха?");
assert.match(updated.messages.at(-1).content, /эффект|квартал|внедрение/, "Pilot opponent should answer the player's question in context");
const temperature = await request("/api/temperature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: updated.messages }) });
assert.equal(temperature.response.status, 200);
assert.match(temperature.data.reason, /уточняет условия/, "A neutral question must not be described as pressure");
updated = await play(updated, "Предлагаю ограниченный пилот с критериями. Давайте назначим встречу и дату проверки результата.");
const report1 = await finish(updated.id);
assert.equal(report1.report.outcome.id, "pilot-agreed");
assert.ok(report1.report.evidence.every((e) => report1.messages.some((m) => m.id === e.messageId && m.content === e.quote)));
const persisted = await request(`/api/attempts?id=${report1.id}`);
assert.equal(persisted.data.status, "completed");
assert.equal(persisted.data.id, report1.id);
assert.equal(persisted.data.messages.length, report1.messages.length, "Attempt history should be available to restore after a page refresh");
const blocked = await request("/api/attempts/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: report1.id, text: "Продолжаю" }) });
assert.equal(blocked.response.status, 409);
const retry = await start("pilot-prospect", report1.id);
const retryTurn = await play(retry, "Покажу презентацию, спасибо за интерес.");
const report2 = await finish(retryTurn.id);
assert.equal(report2.report.comparison.previousOutcome, report1.report.outcome.label);
const variedRetry = await start("pilot-prospect", report2.id, "deadline");
assert.ok(variedRetry.scenario.variation, "Variant must be stored on the attempt snapshot");
assert.notEqual(variedRetry.scenario.variation.from, variedRetry.scenario.variation.to);
const variedFinish = await finish(variedRetry.id);
assert.equal(variedFinish.report.comparison.changedCondition.parameter, "Срок решения");
assert.equal(variedFinish.report.comparison.changedCondition.to, variedRetry.scenario.variation.to);

const scenarioRuns = [
  ["discount-request", ["Что именно ограничивает бюджет и что для вас важнее?", "В обмен на контракт на 24 месяца предлагаю скидку и встречу на следующей неделе."], "d-margin-safe", ["Я даю скидку 10% без условий."], "d-margin-loss"],
  ["supplier-price-increase", ["Что повлияло на повышение цены и какое ограничение мешает срокам?", "Предлагаю частичную отгрузку, резервный план и контрольную дату.", "Зафиксируем прогноз объёма и дату следующей проверки."], "s-resilient-deal", ["Немедленно сменим поставщика."], "s-empty-threat"],
  ["team-conflict", ["Расскажи, что именно нарушилось и какая у тебя сейчас нагрузка?", "Понимаю, что произошло; давай разберём факты.", "Снимем задачу и пересмотрим приоритет. Зафиксируем приоритет и дату проверки."], "t-joint-plan", ["Ты всегда срываешь работу, просто возьми задачу."], "t-escalated"],
  ["partner-questions", ["Что нужно проверить и какой риск для вас главный?", "У нас пока пять интервью, конверсия не подтверждена, это только гипотеза.", "Предлагаю ограниченный тест с измеримым критерием и встречу с аналитиком."], "p-test-agreed", ["Гарантирую конверсию и подтверждённый спрос."], "p-trust-loss"],
  ["unclear-partnership", ["Какой вклад и какие ресурсы партнёр может выделить?", "Предлагаю ограниченный пилот с критерием успеха.", "Назначим ответственного за интеграцию и владельца задачи. Зафиксируем срок пилота и дату проверки."], "j-pilot-plan", ["Вместе всё сделаем, разберёмся по ходу."], "j-vague-deal"],
  ["salary-review", ["За полгода я достиг результата по метрикам и взял ответственность за запуск.", "Какие критерии и результаты нужны для решения?", "Зафиксируем критерии и дату пересмотра через три месяца."], "s-review-plan", ["Коллеги получают больше, иначе ухожу."], "s-unsupported-demand"],
];
for (const [id, goodLines, goodOutcome, badLines, badOutcome] of scenarioRuns) {
  let attempt = await start(id);
  for (const line of goodLines) attempt = await play(attempt, line);
  const goodReport = await finish(attempt.id);
  assert.equal(goodReport.report.outcome.id, goodOutcome, `${id} should reach its deliberate outcome; signals: ${goodReport.report.outcome.signals.join(", ")}`);
  assert.ok(goodReport.report.evidence.length > 0, `${id} should cite real messages`);
  attempt = await start(id);
  for (const line of badLines) attempt = await play(attempt, line);
  const badReport = await finish(attempt.id);
  assert.equal(badReport.report.outcome.id, badOutcome, `${id} should distinguish a harmful or incomplete choice`);
}

const draft = {
  id: "smoke-custom-draft", version: 1, status: "draft", title: "Smoke: private draft", category: "Авторские", mainSkill: "Проверка интересов", description: "Черновой кейс", playerBrief: "Условия черновика.", playerRole: "Менеджер", playerGoal: "Согласовать шаг", difficulty: "Средняя",
  opponent: { name: "Тестовый оппонент", role: "Партнёр", sphere: "B2B", tone: "деловой", personality: "Осторожный", goals: ["Проверить план"], redLines: ["Не обещать без данных"], hiddenInterests: ["Срок важен"], constraints: ["Нет бюджета"], style: "Задаёт вопросы", systemPrompt: "Реагируй на условия." },
  signals: [{ id: "custom-1", patterns: ["критерий"] }], outcomeRules: [{ id: "good", label: "Есть проверяемый критерий", requiredSignals: ["custom-1"], score: 80 }, { id: "other", label: "Пока нет договорённости", requiredSignals: [], score: 30 }], theory: [{ id: "spin", title: "Вопросы SPIN" }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const savedDraft = await request("/api/scenarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
assert.equal(savedDraft.response.status, 200);
const playerCatalog = await request("/api/scenarios");
assert.ok(!playerCatalog.data.some((s) => s.id === draft.id), "Draft must not appear in the player catalog");
const hiddenDraft = await request(`/api/scenarios?id=${draft.id}`);
assert.equal(hiddenDraft.response.status, 404);
const preview = await start(draft.id, undefined, undefined, true);
assert.ok(!Object.hasOwn(preview, "baseScenario"), "Public attempt response must not expose the private base snapshot");
assert.ok(!JSON.stringify(preview).includes("hiddenInterests"), "Preview attempt DTO must not expose hidden interests");
await request(`/api/scenarios?id=${draft.id}`, { method: "DELETE", headers:accessHeaders });

const deadline = await start("project-deadline");
const unsafe = await play(deadline, "Обещаю: точно успеем к пятнице, гарантирую эту дату без проверки зависимостей.");
assert.match(unsafe.messages.at(-1).content, /срок|план|интеграц/, "Deadline opponent should react to an unchecked promise");
const unsafeReport = await finish(unsafe.id);
assert.equal(unsafeReport.report.outcome.id, "overpromise");
const responsible = await start("project-deadline");
const refusal = await play(responsible, "Без проверки зависимостей не могу обещать точный срок. Сначала проверю риски и предложу план.");
const refusalReport = await finish(refusal.id);
assert.equal(refusalReport.report.outcome.id, "responsible-decline");
console.log("Smoke passed: public DTO, draft isolation, validation, admin behavior, scenario versioning and snapshots, all eight available scenarios, twelve distinct authored outcomes, report citations, persistence, deterministic one-condition retry comparison, and completed-round guard.");
await cleanup();
} catch (error) {
  await cleanup();
  throw error;
}
