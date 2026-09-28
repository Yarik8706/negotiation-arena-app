# UX/UI audit: «Арена переговоров» before redesign

**Date:** 2026-09-29  
**Mode:** read-only audit; production code was not changed.  
**Reviewed against:** `DESIGN_VISION.md` — the deal-room / negotiation HQ metaphor, desktop-first split round, observable temperature, visible advisor, assessment scorecard, and preserved learning loop.

## Evidence reviewed

- Source: `src/app`, `src/components`, with current line references below.
- Fresh local screenshots: `screenshots/2026-09-29/visual-audit-{home,group,progress,admin}-*.png` at 1280×900 and the available 390×844 variants.
- Earlier, state-specific captures used only to inspect the active round, report and theory: `screenshots/2026-09-26/pilot-round-desktop-1280x900.png`, `pilot-report-desktop-1280x900.png`, `deadline-comparison-live-ui-1280x900.jpg`, `theory-desktop-1280x900.png`, and group-room captures from 2026-09-27. They may not reflect the current light-theme tokens, so claims derived from them are limited to layout and interaction structure that is still present in current source.
- Live read-only check of `https://negotiation-arena-app.vercel.app/`: catalog loaded with nine scenarios at 1280×900 and 390×844. At 390px, `clientWidth` and `scrollWidth` were both 390: no horizontal overflow was observed. The six nav links measured 40px high. The page was not mutated.
- Contrast calculation from current token values: white text on `--accent: #2fc456` is **2.29:1**; body-size button text requires 4.5:1 under WCAG 2.1 SC 1.4.3.

## Severity scale

- **P0** — prevents a primary flow or exposes sensitive information. None found in this UI audit.
- **P1** — materially impairs the core negotiation/training loop or accessibility of a primary action.
- **P2** — causes avoidable comprehension, hierarchy, responsive, or efficiency cost during normal use.

## Findings

### A11Y-01 — Primary action labels fail text contrast

- **Severity:** P1
- **Location:** [`src/app/globals.css`](../../src/app/globals.css#L9) (`--accent: #2fc456`) and [`src/app/globals.css`](../../src/app/globals.css#L86) (forced white `.text-white`); examples in [`src/app/page.tsx`](../../src/app/page.tsx#L138), [`src/components/PlayArena.tsx`](../../src/components/PlayArena.tsx#L287), and [`src/app/progress/page.tsx`](../../src/app/progress/page.tsx#L21).
- **Symptom:** labels such as “Администратору”, “Отправить” and “Выбрать сценарий” are white on the bright green primary fill. In the fresh home/progress captures, their letters are visibly less stable than dark body text.
- **Why it matters:** calculated contrast is 2.29:1, below the 4.5:1 requirement for normal text. The failed treatment repeats on actions that start, send and continue the learning loop.
- **Evidence:** token calculation above; fresh `visual-audit-home-desktop-1280x900.png` and `visual-audit-progress-desktop-1280x900.png` show the treatment; the code applies it across the product.
- **Fix principle:** define a semantic primary-action foreground/background pair that passes contrast in both themes. A darker green with white text or dark ink on the current green are both valid; validate disabled, hover and focus states too.
- **Do not break:** green may continue to identify forward progress and successful practice; retain visual prominence of the one primary action per context and the existing visible focus outline.
- **Confidence:** high.

### ARENA-01 — The default round removes the deal-room telemetry

- **Severity:** P1
- **Location:** [`src/app/page.tsx`](../../src/app/page.tsx#L20) defaults to `independent`; [`src/components/PlayArena.tsx`](../../src/components/PlayArena.tsx#L228) selects a one-column grid for it; the temperature and advisor are rendered only in the `guided` branch at [`src/components/PlayArena.tsx`](../../src/components/PlayArena.tsx#L294).
- **Symptom:** the user’s default path is a bare chat. “Температура сделки” and “Внутренний советник” disappear altogether until the user has found and switched the mode before opening a scenario.
- **Why it matters:** this directly conflicts with the agreed active-round model: conversation plus a visible severity/gauge rail and advisor. It makes the central feedback loop conditional on a setting whose copy only says that comparison is tracked separately.
- **Evidence:** current source branch; the earlier active-round capture demonstrates that the rail exists when guided, while the fresh home capture shows “Самостоятельно” as selected by default.
- **Fix principle:** keep temperature visible in every round, with an independent-mode presentation that reports state without giving tactical answers. Place the advisor in a clearly separate, optionally collapsed rail or make its availability explicit before round start.
- **Do not break:** retain the meaningful difference between “Самостоятельно” and “С подсказками”, do not reveal the opponent’s hidden interests, and preserve attempt comparison by mode.
- **Confidence:** high.

### ARENA-02 — Long negotiations scroll the document instead of maintaining a working desk

- **Severity:** P1
- **Location:** [`src/components/PlayArena.tsx`](../../src/components/PlayArena.tsx#L44) scrolls `bottomRef` into view after every message; the message region has only `min-h-[420px]` and no bounded parent height at [`src/components/PlayArena.tsx`](../../src/components/PlayArena.tsx#L228-L230).
- **Symptom:** as the dialogue grows, the message area can grow with the page; each new turn forces the browser to scroll to the bottom. The case title, goal, brief and any desktop rail leave the user’s viewport instead of remaining readable as a negotiating context.
- **Why it matters:** a deal room needs a stable composition: context and controls stay available while the transcript scrolls. Current behavior turns the main learning task into a long page and makes it harder to review constraints while composing the next move.
- **Evidence:** source layout has no definite height that would activate the intended `overflow-y-auto` transcript; `scrollIntoView` explicitly moves the document. The 2026-09-26 active-round capture shows the intended zones, but does not establish a bounded transcript for a long exchange.
- **Fix principle:** use a desktop viewport-aware workspace with a dedicated scrollable transcript, a sticky/pinned input and a persistent context/metrics rail. Let mobile become a deliberate stacked flow with a quick return to the brief.
- **Do not break:** restore saved attempts, message sending, speech controls, report generation, diagnostic turn limits and the auto-reveal of the latest reply.
- **Confidence:** high.

### METRIC-01 — “Temperature” is a colored bar, not an interpretable status

- **Severity:** P1
- **Location:** [`src/components/TemperatureMeter.tsx`](../../src/components/TemperatureMeter.tsx#L9-L38).
- **Symptom:** the only visual encoding is a 2px-high colored fill and a number. It has no named state (for example, stable / pressure / risk), threshold explanation or programmatic progress semantics. Before the first response it becomes a dash plus an empty bar.
- **Why it matters:** the vision calls this a severity/gauge that should help a person decide what to do in the round, not decorative progress. Color-only interpretation also weakens accessibility and makes the rail look inactive.
- **Evidence:** `colorFor` maps score only to color; the outer element has no `role="progressbar"`, `aria-valuenow`, label for the level, or visible thresholds. The prior active-round capture shows an unlabeled bar in the rail.
- **Fix principle:** make the metric an explicit status component: numeric score, named band, short cause/action, and accessible `progressbar` semantics where a bar remains. Use severity as a semantic token that also works without color.
- **Do not break:** keep score derivation and the API response as-is; do not expose hidden opponent constraints in the explanatory text.
- **Confidence:** high.

### REPORT-01 — The final report is an inaccessible modal state

- **Severity:** P1
- **Location:** [`src/components/FinalReport.tsx`](../../src/components/FinalReport.tsx#L18-L38).
- **Symptom:** the report overlays the entire app, but the container has no `role="dialog"`, `aria-modal`, accessible title association, focus management, Escape behavior or focus return. Keyboard focus can continue into the dimmed negotiation page.
- **Why it matters:** completing a round is a primary journey moment. Screen-reader and keyboard users do not receive a reliable change of context, and background controls remain in the tab sequence behind an opaque overlay.
- **Evidence:** component has only fixed visual layering and scroll styling; it does not use a focus ref/effect or dialog semantics. The active-report capture shows underlying chat content visually obscured rather than made inert.
- **Fix principle:** implement a real dialog/sheet contract: programmatic name, focus on opening, focus trap, Escape/close behavior, inert background and return focus to “Завершить переговоры”.
- **Do not break:** retry with one changed condition, close, outcome/skill data, evidence-to-theory links, and the ability to scroll report content on short screens.
- **Confidence:** high.

### REPORT-02 — Assessment is buried in a narrow generic overlay

- **Severity:** P2
- **Location:** [`src/components/FinalReport.tsx`](../../src/components/FinalReport.tsx#L19-L35).
- **Symptom:** desktop receives a `max-w-xl` (576px) vertical modal containing score, comparison, skills, evidence, recommendation and retry controls in one scroll stack. The report obscures the complete round and loses the “assessment scorecard” hierarchy promised by the brief.
- **Why it matters:** users cannot first scan result, skill trend and next exercise, then drill into two or three quoted moments. The modal turns the most valuable learning artefact into a long form and makes comparison feel secondary.
- **Evidence:** source structure; `pilot-report-desktop-1280x900.png` and `deadline-comparison-live-ui-1280x900.jpg` show the same narrow centered stack over a dimmed round.
- **Fix principle:** on desktop present a report workspace or wide side sheet with a fixed summary/scorecard, explicit comparison, and evidence cards linked to the transcript; retain a single-column sheet on narrow screens.
- **Do not break:** exact outcome labels/scores, comparison deltas, player quotes, theory links, recommendation and single-condition retry.
- **Confidence:** high.

### NAV-01 — Global navigation does not communicate location and is compressed on phone

- **Severity:** P2
- **Location:** [`src/app/layout.tsx`](../../src/app/layout.tsx#L19-L42) and mobile rules in [`src/app/globals.css`](../../src/app/globals.css#L97-L114).
- **Symptom:** all six routes, including the administrative constructor, have the same neutral treatment; there is no current-page indicator. On the 390px live check the six link targets are 40px high, while the narrow breakpoint reduces labels to 11px and action targets to 36px.
- **Why it matters:** a user moving between practice, theory, group work and progress loses orientation. The mobile header consumes two rows yet the labels become cryptic (“Я”, “2×2”, “Старт”) and miss the common 44px touch-target heuristic. The 40px measurement still clears WCAG 2.2 AA’s 24px minimum, so this is a usability priority rather than a conformance claim.
- **Evidence:** live browser metrics at 390×844: `scrollWidth=clientWidth=390`, `headerHeight=102`, every nav target `height=40`; source has no `aria-current` or active-route class. Fresh 390px home/group captures show the compressed navigation.
- **Fix principle:** create a route-aware shell. On desktop, show current section and separate/contain admin affordance. On mobile, use a deliberately chosen compact navigation pattern with semantic labels and at least 44px targets.
- **Do not break:** every current route, theme toggle, 390px no-overflow result, and direct access to admin for local demo work.
- **Confidence:** high.

### CATALOG-01 — The catalog does not carry a learner from recommendation to a chosen case

- **Severity:** P2
- **Location:** cards in [`src/app/page.tsx`](../../src/app/page.tsx#L101-L130); recommendation CTA in [`src/app/progress/page.tsx`](../../src/app/progress/page.tsx#L21).
- **Symptom:** the landing page puts quick-skill chips, practice mode, category filter and nine visually equal scenario cards into one long scan. Progress knows `recommendation.scenarioId` in its data model but its “Выбрать сценарий” CTA always returns to `/`, with no recommended case selected or highlighted.
- **Why it matters:** the specified cycle ends with theory and a repeat under one changed condition. The next-cycle entry should shorten the decision; here a learner must rediscover the suitable case and mode after reaching the progress page.
- **Evidence:** fresh desktop home capture shows three nearly equal first cards and the dense catalog below; fresh progress capture shows the generic CTA. Source types/data include `scenarioId`, but the link discards it.
- **Fix principle:** make a recommended next case a first-class catalog state: identify why it is recommended, retain the selected practice mode, and give the rest of the catalog a clear secondary role with filtering.
- **Do not break:** featured ordering, categories, JSON upload, all existing scenarios, and comparisons that require matching scenario/difficulty/mode.
- **Confidence:** high.

### ADMIN-01 — Scenario creation uses a long two-column form with fragile mini-languages

- **Severity:** P2
- **Location:** [`src/app/admin/page.tsx`](../../src/app/admin/page.tsx#L92-L118), input panels at [`src/app/admin/page.tsx`](../../src/app/admin/page.tsx#L201-L318).
- **Symptom:** an editor must enter outcomes and theory as pipe-separated multi-line text, remember mutually exclusive signal rules, and scroll through independent fields before discovering validation messages. The 1280px fresh capture shows only the first layer of two nearly identical input columns; the 390px capture shows the first long stack.
- **Why it matters:** this is an expert workflow, but the current interface relies on memory of syntax to protect a scenario’s evaluation logic. It hides the authoring sequence described in the product: brief → opponent → observable outcomes → preview → publish.
- **Evidence:** `outcomesText` and `theoryText` are parsed manually with several error branches; the visible instructions are inline text after the fields. Fresh `visual-audit-admin-desktop-1280x900.png` and `admin-groq-mock-mobile-434x627.jpg` show the dense start of the form.
- **Fix principle:** organize authoring into named sections/steps, represent outcome rules and theory as repeatable structured rows, validate where data is entered, and keep preview/publish state visible while scrolling.
- **Do not break:** current scenario JSON schema, draft versus published behavior, versioning, preview round, local demo warning, generation path and download/export.
- **Confidence:** high.

### SYSTEM-01 — The shared visual system has one generic card treatment for distinct jobs

- **Severity:** P2
- **Location:** shared tokens and global overrides in [`src/app/globals.css`](../../src/app/globals.css#L3-L91); home catalog cards in [`src/app/page.tsx`](../../src/app/page.tsx#L113-L127); group cards in [`src/app/group/page.tsx`](../../src/app/group/page.tsx#L33-L38); progress cards in [`src/app/progress/page.tsx`](../../src/app/progress/page.tsx#L21-L26).
- **Symptom:** catalog selection, a live team room, metrics, profile, achievement list and complex editor all use the same white/green rounded bordered card language. In fresh desktop captures, route purpose is carried mostly by headings; no visual grammar distinguishes case files, live pressure/telemetry, assessment, or administration.
- **Why it matters:** it does not yet deliver the negotiated “headquarters / deal room” character or editorial density. A full redesign would otherwise risk adding decoration while keeping every page structurally indistinguishable.
- **Evidence:** current global tokens use a white background, system font and only 10/14px radius overrides; fresh home/group/progress/admin captures show the repeated card treatment. This is a design-vision gap, not an assertion that light mode itself is invalid.
- **Fix principle:** establish a small semantic system before redrawing pages: surface roles (case file, active console, advisory, result), a type scale, state/severity tokens and density rules. Apply the system differently to catalog, live round, scorecard and calmer editor.
- **Do not break:** Russian content, dual theme behavior, existing focus treatment, the quiet admin distinction, responsive no-overflow behavior, and all working flows.
- **Confidence:** high.

## Strengths to preserve

- The current catalog has real category, difficulty, role, skill and duration metadata; it is a usable base for mission cards rather than a placeholder grid.
- The product already preserves a valuable report data model: outcome, comparison, skills, evidence quotes, theory links and one-condition retry.
- Group rooms protect the role-specific brief in the UI, and current source keeps the player’s and opponent’s information separated.
- The fresh mobile checks show no horizontal overflow at 390px, and interactive form controls generally use 44px minimum heights outside the compact header.

## Audit boundary

This report identifies observable design and accessibility problems; it does not choose a new palette, edit production code, or certify runtime behavior beyond the documented read-only browser check. The active-round and report visual artefacts predate the latest token refresh, so their layout findings are cross-checked against current component structure.
