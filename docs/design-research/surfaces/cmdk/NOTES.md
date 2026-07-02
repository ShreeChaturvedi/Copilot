# Cmd+K command bar (brief section 4.6) - evidence notes

Built 2026-07-02 against the live app (Vite :5189, API :3016), issue #28. All shots via playwright-cli headless at 1440x900 and 390x844, themes toggled with the in-app control (via the palette's own theme command).

## What shipped

- `src/components/command/CommandBar.tsx` - lazy shell mounted once in MainLayout. Panel (cmdk + chrono chunk) loads on first Cmd+K and stays mounted.
- `src/components/command/CommandBarPanel.tsx` - Radix dialog + cmdk. Scrim `--void` 60% + blur(8px) (the one sanctioned heavy blur). Panel 560px, radius 12, top 20vh, `--surface-3` + `--edge-machined` + outer ring `0 0 0 1px var(--aqua-rim)` (the only always-on aqua rim). Enter translateY(-4px) scale(.98) 200ms `--ease-settle`, exit 100ms fade, result navigation not animated. Reduced motion: 120ms crossfades (command-bar.css media query).
- `src/components/ui/Keycap.tsx` - reusable 18px keycap, `--surface-2` + machined edge, 11px Spline mono. Exported from ui/index.
- `src/components/command/appCommands.ts` - 11 commands, all real capabilities: New task (N), New event, Today (T), Calendar, Tasks, Day/Week/Month/List (D/W/M/L), theme toggle (label flips with resolvedTheme), Open settings (Ctrl/Cmd+,). Keycap hints only for keys the app actually binds (useGlobalShortcuts here + the existing useKeyboardShortcuts Cmd+, map). Nothing invented.
- `src/components/command/dateGrammar.ts` - the product-native move. Imports the existing ChronoDateParser (same engine as the smart input, not duplicated). A query with a date and a leftover title renders `Place "<title>" on <resolved>` with the date in 12px mono aqua (mono-numeral law + aqua=placed). Accepting calls the real addTask mutation with scheduledDate, closes, toasts `Placed on <resolved>` (Place -> Placed, one verb through the flow).
- `src/hooks/useGlobalShortcuts.ts` - Cmd/Ctrl+K toggle, T today, D/W/M/L views, N new task. Single letters never fire from inputs/contenteditable/textbox roles and never while a Radix dialog/menu/popover layer is open. Number keys for visible day count SKIPPED: neither settingsStore nor calendarSettingsStore models a day count (only discrete sub-views), per the brief's conditional.
- Wiring (minimal): MainLayout +1 mount +1 hook. RightPane consumes uiStore.eventModalOpen (works when the pane mounts after the command) and listens for `app:calendar-today`. TaskFocusPane listens for `app:new-task` to show the enhanced input. T/view/new-task from the task view first switch views (a fresh calendar mounts at today).

## Runtime verification (not just render)

- Place accepted end to end: POST created task title "Email vendor", scheduledDate 2026-07-03T13:00:00Z (Jul 3 9:00 local), landed in default list, sidebar TOMORROW group + toast (cmdk-placed-light-1440.png). Test tasks deleted after.
- Keys: D/M/W/L switch FullCalendar views (probed `.fc-*-view` classes), T restores today after paging 2 weeks ahead, N opens+focuses the enhanced task input from calendar view, "dwm today" typed into the smart input changes nothing (guard), D under an open dialog changes nothing (layer guard), New event from Tasks view switches and opens Create Event.

## Defects found in my own first render and fixed

1. List max-height clipped the last group mid-row at rest -> raised to min(524px, 64vh) so the full 11-command set shows without scroll at both 1440x900 and 390x844.
2. Day view icon was `Square` (read as an unchecked checkbox next to Tasks' CheckSquare) -> `RectangleVertical` (one column).
3. cmdk's default fuzzy filter misranked: "dark" selected Calendar (d-a-r from "calendar" + k from keyword "week", fuzz across value+keyword boundary) -> custom substring/word-prefix `commandFilter` (zoom-filter-light.png shows the fix).

## Screenshot index

- cmdk-open-{light,dark}-{1440,390}.png - default open state, both themes, both widths
- cmdk-place-light-1440 / cmdk-place-dark-1440 / cmdk-place-light-390 - date grammar offers
- cmdk-placed-light-1440 - after accept: task in sidebar + Placed toast
- zoom-panel-{light,dark} - panel element closeups (rim, film+bar selection, keycaps)
- zoom-place-{light,dark}, zoom-filter-light, zoom-empty-light - states at element scale

## Notes for later surfaces

- The scrim samples dark in pixels (rgb ~105,108,109 over the light canvas) even though downscaled previews read lighter. Verified by pixel sampling, not eyeball.
- Keycap is ready for reuse (ViewSwitcher tooltips, landing keycap cluster).
- Sonner success toast is still stock green. The toast skin belongs to whatever surface owns feedback chrome, `--success` is already aqua in tokens.
- Unit tests: `src/components/command/__tests__/` (19 tests, fake timers pinned to Wed 2026-07-01).
