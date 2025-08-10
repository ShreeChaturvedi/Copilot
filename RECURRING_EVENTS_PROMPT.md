### Prompt for new agent: Implement recurring events

Goal
- Add robust, UX-polished recurring events (RFC 5545 RRULE) with creation, display, editing, and exceptions. Preserve existing calendar behaviors (drag/drop, previews, colors) with zero regressions.

Context
- React + FullCalendar calendar app with shadcn UI, Tailwind v4, Zustand, and TanStack Query.
- Events are stored in UTC; convert to local for rendering.
- Event data model already supports an RRULE string; extend minimally to support exceptions as needed.

Functional requirements
- Recurrence creation
  - “Repeat” section in the event creation/edit dialog with: Does not repeat, Daily, Weekly (weekday picker), Monthly (day-of-month and nth-weekday), Yearly (month/day).
  - Interval (every N), end condition (never / on date / after N occurrences).
  - Generate and persist an RRULE string; clear it when “Does not repeat”.
  - Show a human-readable recurrence summary inline.
- Instance display
  - Expand recurring series into concrete instances only for the visible calendar range (month/week/day). Use correct duration (end − start), preserve all-day vs timed.
  - Respect timezone and DST; persist UTC; convert to local only at render.
  - Apply event color resolution: event.color if present; otherwise the hosting calendar’s color.
- Editing recurring events
  - In the event display/edit flow, show the recurrence summary and provide “Edit series” vs “Edit this event only” and “Delete this event / Delete series”.
  - V1 exceptions: skipping an occurrence (“delete this event”) is supported via an exceptions list (e.g., EXDATE-style). Expansion must subtract exceptions.
- Drag/drop and previews (no regressions)
  - Keep existing drag/drop behavior and mirror preview styling exactly as-is.
  - Do not change how previews derive color (they should continue to use the default calendar color).
- Performance
  - Expansion must be range-bounded using the current FullCalendar visible range. Memoize expanded results on series id + range + RRULE + duration + exceptions.
  - Avoid recomputing expansions unnecessarily; keep UI snappy on large datasets.
- Accessibility and UX
  - Build recurrence UI with shadcn components. Keep it responsive, keyboard-accessible, and theme-aware (light/dark).
  - Provide sensible defaults; avoid overwhelming users. Keep copy concise and descriptive.
- Internationalization/time
  - Ensure weekday/month formatting respects locale. Keep all persisted values in UTC.
- Validation
  - Validate recurrence input (intervals, ends, sensible ranges); handle invalid RRULEs gracefully.

Non-functional constraints
- No hardcoding (colors, time ranges, IDs, etc.).
- Maintain code clarity, type-safety, and existing architectural patterns.
- Do not degrade existing features or visual design.

Testing (must-have coverage)
- Unit tests for RRULE expansion across range windows (daily/weekly/monthly/yearly; intervals; all-day and timed; DST transitions).
- Exceptions handling: “delete this event only” removes one occurrence across views.
- Component tests: recurrence editor generates the correct RRULE; instances render in all views; editing/deleting series vs occurrence.
- Integration tests: switching views updates expansion range; drag/drop continues to work; previews retain correct colors.

Acceptance criteria
- Users can create, view, and edit recurring events with clear summaries.
- Instances render only within the visible range and with correct times/durations.
- “Delete this event only” removes just that occurrence; the series remains intact.
- Existing drag/drop + preview styling unchanged; default calendar color still drives previews.
- No performance regressions; UI remains responsive.
- All new tests pass alongside existing test suite; linting and type checks are clean.

Additional guidance
- Prefer a proven RRULE implementation (e.g., rrule library) for parsing/generating/expanding.
- Keep expansion logic isolated and easily testable; use memoization where beneficial.
- Document key decisions (e.g., exception representation and DST handling approach).

