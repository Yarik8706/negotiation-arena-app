# Design constraints

Derived from `DESIGN_VISION.md`, current application code, and the user's request.

- Treat the product as a negotiation desk/deal room, not a generic AI chat.
- Keep the learning loop: choose case → brief → dialogue → outcome/report → theory → repeat with one changed condition.
- Keep Russian copy, current route destinations, and current data operations.
- Preserve existing light/dark theme support; the selected redesign uses warm surfaces and graphite framing in light mode with the same semantic accents in dark mode.
- Reference screenshots inspire layout and density only; do not reproduce their brands or copy.
- Never render hidden opponent interests or internal prompt data in player-facing surfaces.
- Keep all controls usable by keyboard and touch; target at least 44px controls on mobile and maintain clear focus/disabled/hover states.
- Avoid new dependencies, new fonts, gratuitous charts, and decorative content without data behind it.
- Desktop-first visual density must still collapse to a useful mobile single-column flow.
