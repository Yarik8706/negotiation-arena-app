# Продолжение задач БД / Linear

Исторический снимок состояния на переход в новый чат. Актуальный результат на 30.09.2026: [DB_COMPLETION.md](verification/DB_COMPLETION.md). Ниже сохранён первоначальный контекст; его блокировки и следующие шаги уже обработаны.

## Запрос пользователя

Доделать все связанные с БД задачи Linear в negotiation-arena-app. Последнее обязательное уточнение: работать с БД через плагин Neon, не Supabase. Пользователь попросил новый диалог с сохранённым контекстом, поскольку инструменты установленного Neon отсутствовали в текущей сессии.

## Linear

Команда Digital Transformation Hackathon, проект «Основной этап — Цифровые трансформации». Основная MYO-130 (In Progress): постоянное хранение сценариев/попыток, профили/псевдонимы, доступ к комнате/переписке, защита админки, удаление учебных данных, local demo, перезапуск и параллельные раунды. Зависят MYO-132 (комнаты), MYO-138 (прогресс), MYO-141 (рейтинг), MYO-142 (конструктор). Связана MYO-136 (подбор). Полные критерии получены через get_issue; запросить заново при необходимости. Статусы и комментарии ещё НЕ менялись.

## Neon

plugin_management_search_plugins({query:"Neon"}) подтвердил установленный ENABLED Neon, id plugin_asdk_app_69e0086d87088191a3edc052fa50c29f. В ALL_TOOLS не было инструментов Neon ни по имени, ни по описанию. Не утверждать, что подключение инструментов уже работает: проверить в новом чате.

До уточнения пользователя `npm run db:migrate` через Neon serverless SDK применил 001_group_rooms.sql и 002_core_persistence.sql. В sandbox было ENOTFOUND; запуск require_escalated успешно подключился и применил оба файла. После требования плагина новых операций БД НЕ было. 003_shared_runtime.sql НЕ применена.

.env.local содержит DATABASE_URL/POSTGRES_URL и Groq; значения не печатать. В ignored .env.local сгенерированы ADMIN_API_TOKEN и SESSION_SECRET, значения не выводились. Для продакшена нужно сохранить одинаковый SESSION_SECRET на репликах и задать оба секрета в deployment env; текущая генерация только локальная.

## Изменения текущего чата

- src/lib/db.ts: интерактивные транзакции Neon Pool/WebSocket; Node >=22 (package.json engines).
- scripts/migrate.mjs: каждый SQL-файл и запись _migrations в одной HTTP-транзакции. Простой line-based SQL splitter остаётся, нет защиты от одновременного запуска мигратора; улучшить при необходимости.
- db/migrations/003_shared_runtime.sql: encrypted ticket delivery, delivered flag, message sequence, индекс updated_at.
- src/lib/group-rooms/database.ts: нормализованные rooms/members/messages/tickets, короткая транзакция с advisory lock 130132 для сериализации нескольких экземпляров. AES-GCM временных room delivery токенов с SESSION_SECRET; хеши invite/member credentials. Адаптер пока читает все комнаты/участников/реплики и при записи проходит все строки: проверить и уменьшить стоимость, это ограничение нагрузки.
- src/lib/group-rooms/store.ts: переключение JSON/БД, обёрнутый getRoom, deleteRoom. В DB пути все операции внутри транзакции. JSON путь остаётся.
- src/lib/attempts/store.ts: row lock при append/complete, AsyncLocalStorage для transaction client; удаление попытки; публичный DTO убирает baseScenario и profileId. Проверить некорректный UUID до locked(), гонку удаления профиля/новой попытки, конкурентное завершение/ход. LLM вызывается перед транзакцией, ответ конкурентного запроса может иметь устаревший контекст; сообщения не должны теряться.
- src/lib/access.ts: проверка anonymous profile capability через x-profile-id (случайный local UUID, НЕ аккаунты); admin bearer/basic/HttpOnly cookie. Не выдавать profile capability в публичном DTO/рейтинге.
- src/middleware.ts: защита /admin, admin GET /api/scenarios и scenario mutations; Basic challenge, HttpOnly cookie (8h, SameSite strict). DB/public без ADMIN_API_TOKEN fail-closed. Проверить браузерный вход и cookie, CSRF/Origin при необходимости.
- API обоих families attempts проверяют owner до LLM/изменений; draft preview требует admin; complete ответ исправлен на toPublicAttempt (раньше мог вернуть baseScenario).
- API DELETE /api/attempts/[id], /api/progress?profileId=..., /api/group-rooms/[id]. Политика: член комнаты может удалить весь общий диалог, tickets и историю; ещё задокументировать пользователям.
- PlayArena и progress page добавляют x-profile-id. В progress page был чужой dirty reset calibration, сохранён.
- Все stores поддерживают ARENA_DATA_DIR для изолированной проверки.
- next.config.ts NEXT_DIST_DIR, .gitignore .next-db-verify; build автоматически добавил этот каталог types в tsconfig.json.
- .env.example добавлены два пустых secret-поля.

## Уже выполненная проверка

`npx tsc --noEmit` — pass.
`npm run lint` — pass с прежним предупреждением WorkspaceNav img.
`NEXT_DIST_DIR=.next-db-verify npm run build` — pass, полный production build; данные env прочитаны из .env.local, запросов новой схемы не было.
HTTP/integration, два процесса, рестарт, mock fallback, доступ/удаление, импорт local данных, browser/admin acceptance ещё НЕ проверены. Тесты ещё не написаны. README/DOCUMENTATION пока устарели (JSON-only). Перед Done нужны доказательства критериев; In Review при незавершённой ручной приёмке.

## Сохранить чужую работу

До текущего чата уже были dirty: data/attempts.json, scripts/smoke.mjs, src/app/globals.css, src/app/group/page.tsx, src/app/progress/page.tsx, src/lib/llm/client.ts, src/lib/scenarios/seed.ts, все текущие screenshots/2026-09-29. Не откатывать/не объявлять своими. Живой сервер node PID 40175 слушал 127.0.0.1:3100, его не останавливали. Сборка изолирована в .next-db-verify, чтобы не повредить .next сервера.

## Следующие шаги

1. Найти callable Neon tools, выбрать проект/ветку по конфигурации без печати connection string. Не использовать Supabase.
2. Проверить схему/применить 003 через Neon плагин, продолжить импорт существующих данных без overwrite и документировать команды.
3. Написать/прогнать изолированный integration harness: два экземпляра, гонка join, matchmaking, simultaneous turns/finish, рестарт, privacy/auth/admin, прогресс/рейтинг, owner deletion. Очистить только созданные тестовые записи. Не сбрасывать реальную БД или чужие JSON.
4. Обновить README/DOCUMENTATION и фактические Linear статусы/комментарии по доказательствам; сохранить нерешённые критерии.
5. Если Neon tools всё ещё не появились — сообщить точно, не обходить явно запрошенный плагин без согласия.
