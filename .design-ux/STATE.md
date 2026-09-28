# Current design task state

- User request: rethink the app interface using `DESIGN_VISION.md` and its reference screenshots, then begin redesigning the existing application while preserving its functionality.
- Source brief: `/Users/yaroslav/Documents/Projects/DocsProjects/negotiation-arena-app-docs/DESIGN_VISION.md`.
- Agreed direction for this pass: negotiation desk — warm light work surface, restrained graphite navigation, green for primary actions, amber/red for deal urgency; coherent dark theme remains available.
- Surface scope: catalog, active round and temperature/advisor, final report, group room, theory, progress, diagnostic, and admin editor; existing routes and data actions stay in place.
- Invariants: Russian UI, do not leak opponent secrets, preserve local-demo/privacy caveats, mobile and desktop usable, no new UI dependencies.
- Workflow: audit current UI, write and critique this plan, implement accepted items, review the resulting diff, inspect fresh screenshots across the agreed responsive/theme matrix.
- Audit: `.design-ux/audits/20260929-interface-audit.md`; no P0, four P1 findings accepted: primary contrast, telemetry visibility/semantics, bounded transcript, accessible report dialog. Six P2 items are deferred unless included as necessary polish to the explicitly requested full visual redesign.
- Plan critique: `.design-ux/critiques/20260929-plan-critique.md`; revised for AA contrast, optional catalog fields, privacy, deterministic 1024px reflow/mobile rail order, accessible native dialog, 641–799px navigation and state/theme/viewport acceptance.
- Not done yet: implementation, browser verification, screenshots, final diff critique.

## 2026-09-29 — композиция информации

- Новый запрос пользователя: индивидуальная композиция страниц, разрешена полная переработка UI.
- Реализовано по плану `plans/20260929-information-composition.md`: каталог как досье, теория вопрос/реплика/метод, прогресс как следующий шаг, личный бриф рядом с диалогом, отчёт вокруг эпизодов, единое имя группы, процесс конструктора.
- Критика: `critiques/20260929-information-composition.md`; приняты исправления dark и 800px; чужие изменения пакетов/данных не откатывались.
- Lint, build, smoke passed. 36 финальных PNG + отдельные первые экраны; gallery `audits/20260929-dossier-visual-evidence.md`. DOM на 320/375/640/768/800/900/1280 без горизонтального overflow.
- Визуальная приёмка пользователем ожидается. Реальный Groq, звук/микрофон, группа двух людей не проверены. Собственные тестовые attempts/rooms удалены по точным ID.
- Проверенное восстановление сборки и 404 stylesheet дополнено в README, без дублирования прежней заметки про общий `.next`.
