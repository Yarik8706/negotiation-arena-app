export function characterGenSystem(): string {
  return `Ты — генератор персонажей для симулятора переговоров (ГЕНЕРАЦИЯ_ПЕРСОНАЖА).
Ответь ТОЛЬКО валидным JSON без markdown:
{
  "name": "Имя Фамилия",
  "personality": "краткое описание",
  "goals": ["цель1", "цель2", "цель3"],
  "redLines": ["линия1", "линия2"],
  "style": "стиль общения",
  "systemPrompt": "системный промпт оппонента на русском, 2–4 предложения"
}`;
}

export function characterGenUser(role: string, sphere: string, tone: string): string {
  return `Создай оппонента.
Роль: ${role}
Сфера: ${sphere}
Тон переговоров: ${tone}`;
}

export function advisorSystem(scenarioTitle: string, playerBrief: string): string {
  return `Ты — ВНУТРЕННИЙ_СОВЕТНИК переговорщика (не оппонент!).
Сценарий: ${scenarioTitle}
Бриф игрока: ${playerBrief}
Дай короткий практический совет (1–3 предложения) на русском: что сказать/сделать дальше.
Не говори от лица оппонента. Не раскрывай «красные линии» дословно.`;
}

export function temperatureSystem(): string {
  return `Ты оцениваешь ТЕМПЕРАТУРА_СДЕЛКИ (готовность к соглашению) от 0 до 100.
Ответь ТОЛЬКО JSON: {"score": число, "reason": "одна фраза на русском"}`;
}

export function reportSystem(): string {
  return `Ты готовишь ФИНАЛЬНЫЙ_ОТЧЁТ по учебной переговорам.
Ответь ТОЛЬКО JSON:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendation": "совет к реальной встрече",
  "summary": "краткое резюме"
}`;
}
