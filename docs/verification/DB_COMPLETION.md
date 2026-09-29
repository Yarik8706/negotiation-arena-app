# Проверка задач БД — 30.09.2026

## Результат

Работа с подключённой БД выполнена через плагин Neon. Проект `square-pine-10413033`, основная ветка `br-round-silence-b1xynzb5`. Миграция `003_shared_runtime.sql` применена атомарно с записью `_migrations.id`. На основной ветке проверены 9 сценариев, 12 попыток, индекс рейтинга и новая схема. Импорт JSON использует ON CONFLICT DO NOTHING; существующий каталог не перезаписан. 10 старых попыток без profileId сохранены как закрытый архив, две сохраняют исходный идентификатор владельца. Эфемерная локальная очередь не импортируется.

Реализованы общие сценарии, попытки, профили, комнаты и очередь. Доступ к попыткам принадлежит секретному профилю, к комнате — случайному member token; публичные DTO не раскрывают владельцев, переписку или скрытые брифы. Админка защищена. Файл доступа переносит анонимный профиль между устройствами; пользователь может удалить историю. Это не регистрация аккаунта.

## Проверки

- TypeScript, production build в отдельном `.next-db-verify`, lint: pass. Остаётся прежнее предупреждение WorkspaceNav img.
- [Интеграционный отчёт](database-integration.json): два production-экземпляра, одновременные ходы/завершение, гонка приглашения, очередь и одноразовая доставка токена, права, admin cookie/Origin, версии сценариев, перезапуск, удаление своих тестовых записей.
- [Браузерный отчёт](database-browser.json): реальные pointer-действия, экспорт/импорт в отдельный контекст, рейтинг и собственная позиция, ошибка файла, удаление с сохранением профиля, desktop/mobile/320px и тёмная тема. Все 12 PNG лично просмотрены; формат и размеры проверены, scrollWidth = clientWidth.
- [Локальное демо](local-demo.json): БД отключена, отдельный JSON-каталог, mock без LLM-ключа; smoke проверил восемь сценариев и двенадцать авторских исходов.
- Интеграционные проверки использовали отдельную ветку `br-rough-grass-b14nlvgg`, срок истечения 01.10.2026 03:00 Москва. Основные данные не используются для тестового удаления. Старый сервер 3100/PID40175 и чужие рабочие изменения сохранены.

## Linear и пределы проверки

| Задача | Статус | Осталось |
|---|---|---|
| MYO-130 | In Review | Пользовательская приёмка, deployment env, нагрузочная проверка |
| MYO-138 | In Review | Пользовательская приёмка переноса/истории |
| MYO-141 | In Review | Пользовательская приёмка рейтинга |
| MYO-132 | In Progress | Автоматические тайм-ауты и полный выход/reconnect |
| MYO-136 | In Progress | Несколько совместимых сценариев/режимов/сложностей и восстановление поиска |
| MYO-142 | In Progress | Полная проверка противоречий и авторского потока |

В hosting env нужно задать ADMIN_API_TOKEN и одинаковый SESSION_SECRET на всех репликах; локальные секреты уже настроены, hosting не менялся. Проверки LLM выполнялись в mock; живой Groq, нагрузка, production deployment и пользовательская приёмка не подтверждены. Короткие групповые изменения сериализованы advisory lock, что ограничивает масштабирование при большой нагрузке.

## Повторение и восстановление инструментов

Команды и параметры проверки описаны в [README](../../README.md). Если плагин включён, а Neon tools отсутствуют в текущем чате, установка не подтверждает доступность инструментов: после запрошенного пользователем нового диалога с сохранённым контекстом инструменты появились; доступ затем проверен реальным чтением схемы. Это подтверждённое восстановление данной сессии, не гарантия для любой ошибки соединения. В unscoped connection список проектов был недоступен; Project ID предоставил пользователь, выбранная ветка сверена с настроенным endpoint.

Chrome в данной Playwright-сессии не доставлял обычные pointer/keyboard события; DOM-click давал ложное впечатление успешного действия. Рабочее восстановление — установленный Chromium headless shell через ARENA_BROWSER_EXECUTABLE; полный тест с обычными click/download/import/delete прошёл. DOM-click не использовался для итоговой приёмки. Изолированный build требует ignore для .next-db-verify в ESLint; это уже настроено.

## Свежие снимки

- [db-progress-versioned-skills-desktop-1280x900-1790718281803](../../screenshots/2026-09-30/db-progress-versioned-skills-desktop-1280x900-1790718281803.png)
- [db-progress-transfer-desktop-1280x900-1790718281803](../../screenshots/2026-09-30/db-progress-transfer-desktop-1280x900-1790718281803.png)
- [db-progress-rating-period-desktop-1280x900-1790718281803](../../screenshots/2026-09-30/db-progress-rating-period-desktop-1280x900-1790718281803.png)
- [db-progress-versioned-skills-mobile-390x844-1790718281803](../../screenshots/2026-09-30/db-progress-versioned-skills-mobile-390x844-1790718281803.png)
- [db-progress-versioned-history-mobile-390x844-1790718281803](../../screenshots/2026-09-30/db-progress-versioned-history-mobile-390x844-1790718281803.png)
- [db-progress-transfer-mobile-390x844-1790718281803](../../screenshots/2026-09-30/db-progress-transfer-mobile-390x844-1790718281803.png)
- [db-progress-ranking-mobile-390x844-1790718281803](../../screenshots/2026-09-30/db-progress-ranking-mobile-390x844-1790718281803.png)
- [db-progress-transfer-narrow-320x844-1790718281803](../../screenshots/2026-09-30/db-progress-transfer-narrow-320x844-1790718281803.png)
- [db-progress-ranking-narrow-320x844-1790718281803](../../screenshots/2026-09-30/db-progress-ranking-narrow-320x844-1790718281803.png)
- [db-progress-import-error-narrow-320x844-1790718281803](../../screenshots/2026-09-30/db-progress-import-error-narrow-320x844-1790718281803.png)
- [db-progress-transfer-alternate-theme-mobile-390x844-1790718281803](../../screenshots/2026-09-30/db-progress-transfer-alternate-theme-mobile-390x844-1790718281803.png)
- [db-progress-erased-history-mobile-390x844-1790718281803](../../screenshots/2026-09-30/db-progress-erased-history-mobile-390x844-1790718281803.png)
