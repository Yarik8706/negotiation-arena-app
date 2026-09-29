import type { ChatCompletionRequest, ChatCompletionResponse, LlmMessage } from "./types";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

function isMockMode(): boolean {
  if (process.env.LLM_MOCK === "1") return true;
  return !process.env.GROQ_API_KEY;
}

function hashSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function mockReply(messages: LlmMessage[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const playerText = lastUser.toLocaleLowerCase("ru");
  const seed = hashSeed(system + "|" + lastUser);

  if (system.includes("ГЕНЕРАЦИЯ_ПЕРСОНАЖА") || system.includes("генерации персонажа")) {
    const roles = ["директор по закупкам", "коммерческий директор", "владелец сети"];
    const names = ["Ирина Волкова", "Алексей Смирнов", "Марина Козлова"];
    const name = names[seed % names.length];
    const role = roles[seed % roles.length];
    return JSON.stringify({
      name,
      personality: "Опытный переговорщик, ценит факты и сроки, не любит давление.",
      goals: ["Снизить цену на 8–12%", "Получить гибкий график поставок", "Минимизировать риски контракта"],
      redLines: ["Не соглашаться на предоплату свыше 30%", "Не принимать условия без KPI"],
      style: "Сдержанный, задаёт уточняющие вопросы, иногда делает паузы.",
      systemPrompt: `Ты — ${name}, ${role}. Ведёшь жёсткие, но деловые переговоры. Говори по-русски, коротко (2–4 предложения). Не сдавайся сразу; торгуйся. Не раскрывай свои «красные линии» прямо.`,
    });
  }

  if (system.includes("ТЕМПЕРАТУРА_СДЕЛКИ") || system.includes("температуру сделки")) {
    const score = 35 + (seed % 50);
    const reasons = [
      "Собеседник услышал ценностное предложение, но ещё сомневается в цифрах.",
      "Есть прогресс по срокам, цена остаётся камнем преткновения.",
      "Тон стал конструктивнее после уточнения условий.",
      "Игрок давит слишком жёстко — доверие чуть просело.",
    ];
    return JSON.stringify({ score, reason: reasons[seed % reasons.length] });
  }

  if (system.includes("ВНУТРЕННИЙ_СОВЕТНИК") || system.includes("внутренний советник")) {
    const tips = [
      "Сначала подтвердите интерес оппонента, затем предложите обмен: скидка ↔ объём.",
      "Задайте открытый вопрос про приоритет: цена, сроки или риски.",
      "Суммируйте уже согласованное — это снижает напряжение.",
      "Предложите пилот на малый объём, чтобы обойти красную линию по предоплате.",
    ];
    return tips[seed % tips.length];
  }

  if (system.includes("ФИНАЛЬНЫЙ_ОТЧЁТ") || system.includes("итоговый отчёт")) {
    return JSON.stringify({
      strengths: [
        "Чёткая структура аргументов и ссылки на выгоды.",
        "Умение задавать уточняющие вопросы.",
      ],
      weaknesses: [
        "Иногда рано называли финальную цену.",
        "Мало использовали обмен уступками.",
      ],
      recommendation:
        "На реальной встрече начните с совместного определения критериев успеха, держите «якорь» цены и готовьте 2–3 пакета условий.",
      summary: "Переговоры прошли на среднем уровне конструктивности; есть база для сделки при уточнении коммерческих условий.",
    });
  }

  if (system.includes("[case:discount-request]")) {
    if (/что именно огранич|график платеж|важнее для вас/.test(playerText)) return "Для нас сейчас ограничен платёж именно в этом квартале. Общая сумма за год обсуждаема, если платежи будут распределены предсказуемо.";
    if (/в обмен на|контракт на|уменьшим пакет|график оплаты/.test(playerText)) return "Если зафиксируем объём и график платежей на год, я готова рассмотреть меньшую скидку и сохранить основной пакет.";
    if (/скидк|снизим цену|уступлю/.test(playerText)) return "Без встречного условия такую скидку согласовать не смогу. Давайте обсудим срок контракта или изменение объёма.";
    return "Предложение конкурента ниже. Что вы можете изменить по цене или условиям оплаты?";
  }
  if (system.includes("[case:supplier-price-increase]")) {
    if (/причина повышения|какое ограничение|что повлияло|почему срок/.test(playerText)) return "На цену повлияла логистика, а ближайшая партия ограничена. Для первой отгрузки можем сохранить прежнюю цену, если получим прогноз объёма.";
    if (/частичн|этапн|резервн|контрольн/.test(playerText)) return "Частичная отгрузка возможна. Давайте зафиксируем объём первой партии и дату проверки остатка.";
    if (/сменим|уйдём к конкуренту|разрываем/.test(playerText)) return "Понимаю, но переход к другому поставщику займёт время и потребует проверки качества. Какие риски вы уже учли?";
    return "Новые цены связаны с логистикой. Срок всего объёма сейчас гарантировать не могу.";
  }
  if (system.includes("[case:team-conflict]")) {
    if (/расскажи|что именно наруш|какая у тебя сейчас нагрузка|что тебя беспокоит/.test(playerText)) return "На прошлой неделе срочную задачу добавили, но ничего не сняли. Сейчас у меня две задачи до релиза, поэтому третью без изменения плана не возьму.";
    if (/снимем задачу|пересмотрим приоритет|перераспределим/.test(playerText)) return "Если снимем одну задачу и зафиксируем новый приоритет, я смогу помочь. Давайте назначим дату проверки плана.";
    if (/ты всегда|ты никогда|просто возьми/.test(playerText)) return "Такой тон только подтверждает, что мои ограничения не учитываются. Сначала нужно пересмотреть план.";
    return "Я не отказываюсь помогать, но прошлые срочные задачи добавлялись поверх текущего плана.";
  }
  if (system.includes("[case:partner-questions]")) {
    if (/пять интервью|пока гипотеза|не подтверждена конверсия|не готова интеграция/.test(playerText)) return "Спасибо за честное разделение данных и гипотез. Если зададим метрику и ограничим объём, могу подключить аналитика к проверке.";
    if (/ограниченный тест|пилот|измерим|метрик/.test(playerText)) return "Предлагаю начать с короткой проверки и заранее определить целевую метрику. Давайте пригласим аналитика на отдельную встречу.";
    if (/гарантирую конверсию|точно увеличим|интеграция уже готова/.test(playerText)) return "Эти цифры пока ничем не подтверждены, поэтому я не готова передавать их команде как факт.";
    return "На чём основана оценка спроса и какой риск интеграции вы уже проверили?";
  }
  if (system.includes("[case:unclear-partnership]")) {
    if (/какие ресурсы|какой вклад|кто будет участвовать/.test(playerText)) return "На пилот могу выделить одного специалиста примерно на месяц. Важно заранее договориться, кто принимает решения и отвечает за результат.";
    if (/ограниченный пилот|критерий успеха|пилот на месяц/.test(playerText)) return "Такой объём реалистичен. Давайте отдельно закрепим владельцев задач, критерий успеха и дату пересмотра.";
    if (/ответственный за|владелец задачи|порядок решений|распределим ответственность/.test(playerText)) return "Если эти роли и порядок решений будут записаны, можно запускать пилот. Кто со стороны вашей компании отвечает за интеграцию?";
    return "Идея интересная, но пока неясно, кто что делает и как будем принимать решения.";
  }
  if (system.includes("[case:salary-review]")) {
    if (/коллеги получают|меньше всех|у всех зарплата выше|иначе ухожу|немедленно гарантируйте/.test(playerText)) return "Понимаю, что вопрос оплаты важен, но сравнение с коллегами не даёт мне оснований согласовать изменение. Давайте вернёмся к вашему вкладу и критериям роли.";
    if (/какие критерии|что нужно показать|какие результаты нужны|как принимается решение|какой бюджет|когда бюджетный цикл/.test(playerText)) return "Бюджет этого квартала уже утверждён. Я готова вынести пересмотр на следующий цикл, если согласуем измеримые результаты и уровень ответственности. Давайте назначим встречу через три месяца.";
    if (/бонус|изменение роли|обучение|альтернатив|план пересмотра|этапный пересмотр/.test(playerText)) return "Можно обсудить разовый бонус за завершённый проект или расширение роли. Для базового пересмотра предлагаю согласовать показатели и вернуться к вопросу на следующем бюджетном цикле.";
    if (/результат|достиг|выполнил|вклад|ответственност|показател|метрик/.test(playerText)) return "Спасибо, это помогает понять ваш вклад. Я заинтересована удержать вас, но бюджет уже закрыт на этот квартал. Какие критерии пересмотра вы считаете измеримыми и реалистичными?";
    return "Расскажите, пожалуйста, каких результатов вы достигли и как изменилась ваша ответственность. Решение о пересмотре связано с бюджетом и критериями роли.";
  }

  // Opponent chat
  const replies = [
    `Понял вашу позицию. Нам важно уложиться в бюджет — давайте уточним: какой объём вы готовы гарантировать в первом квартале?`,
    `Интересно. Но текущее предложение всё ещё выше нашего бенчмарка. Что вы можете предложить взамен, если мы зафиксируем срок на 12 месяцев?`,
    `Хорошо, это звучит реалистичнее. Остаётся вопрос рисков: как вы страхуете срыв поставки?`,
    `Я готов двигаться, если мы разделим предоплату и добавим KPI по качеству. Ваш вариант?`,
    `Давайте не торопиться. Мне нужны цифры по TCO, а не только unit-price. Можете разложить?`,
  ];
  return replies[seed % replies.length];
}

export async function chatCompletion(
  req: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  if (isMockMode()) {
    return { content: mockReply(req.messages), mock: true };
  }

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  try {
    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_completion_tokens: req.max_tokens ?? 1024,
        ...(model.startsWith("openai/gpt-oss-")
          ? { reasoning_effort: "low", include_reasoning: false }
          : {}),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error("Groq error", res.status);
      return { content: mockReply(req.messages), mock: true };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.error("Groq returned an empty response");
      return { content: mockReply(req.messages), mock: true };
    }
    return { content, mock: false };
  } catch (err) {
    console.error("Groq request failed", err);
    return { content: mockReply(req.messages), mock: true };
  }
}

export function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
