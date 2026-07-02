# TaskItem surface evidence (issue #28, design-brief 4.1)

Captured 2026-07-02, playwright-cli headless, 1440x900 and 390x844, both themes via the in-app toggle. Files: `src/components/tasks/TaskItem.tsx`, `StatusRing.tsx` (new), `task-item.css` (new, imported by TaskItem and DueDateBadge), `DueDateBadge.tsx`, `StatusBadge.tsx`.

## What shipped

- Row anatomy: grid `16px ring / 10px / title 1fr / actions`, min-height 36px (44px under 768px per 4.9), padding 6px 12px, radius 6px, title 13px/500 Inter. Meta second line renders only when data exists. The infinite ScrollArea is gone.
- Status ring (default control, `taskCompletionControl: 'checkbox'`): 16px SVG, 1.5px stroke, rest `--hairline-strong`, row-hover stroke = the ROW'S OWN list color at 60% (resolved from `task.taskListId`, not the pane's group), in-progress = amber 270 arc (`--warning`), done = filled with the list color + white check. `status-tag` mode still renders StatusBadge (re-based to `--warning`/`--success` tokens).
- Due chip: `.ti-due`, 20px pill, 11px Spline Sans Mono uppercase, proximity ink keyed on the date itself (overdue `--destructive`, today `--aqua`, later `--muted`), film bg = 10% currentColor. Formats `TODAY 17:30`, `THU 14:00`, `JUL 21`, absolute `07/21/2026 14:00`. Hardcoded #3b82f6/#ef4444 are gone.
- Tags: max 2 + mono `+N` (title attr lists the rest). Chip-film formula lite via `--tag-c`: light 12% film + `oklch(from c 0.5 c h)` text, dark 24% film + lifted text. Attachments: up to 2 neutral chips + `+N`.
- Hover: `--surface-2` instant-on / 150ms off, `@media (hover: hover)` gated, touch shows actions at 40%. Actions = NEW quick-schedule CalendarPlus (wired to `onSchedule`, visible path to a date, #45) + 3-dot. Selected = `--aqua-film-08` + 2px inset left aqua bar (`selected` prop, `data-selected`). Rows are focusable (tabIndex 0, not in kanban cards) with `--focus-ring`.
- Completion moment, all times from click: ring draw 160ms, fill pop 120ms at 160, check draw 120ms at 280, strike + inner-wrapper 55% opacity as a REAL class at 400 (kills the dead `opacity-[${...}]` template literal), 800ms grace with second-click reversal, settle-out `translateY(6px) scale(.985)` fade 240ms `--ease-settle`, gap close via grid-template-rows 1fr to 0fr 200ms, THEN `onToggle` commits. All motion is CSS keyframes on the `.ti-inner` wrapper, never the row root.
- calendarMode: settle-out degrades to opacity-only 160ms, row root keeps inline `transform: none`, the transition kill stays scoped to `.is-dragging` (rescoped pre-req). Keyboard toggles (click detail 0) commit immediately per section 5. Un-completing commits immediately.
- Reduced motion: keyframes and grid-rows transition off, ring fill + strike keep their end states, grace and commit still run (verified via `emulateMedia`, see reduced-motion capture: ring done at 700ms, row committed and gone after).

## Shots

- `taskitem-completion-sequence-light-1440.png`: 6-frame strip at 120/340/700/1330/1520/2100ms (draw, fill+check, struck grace, settling fade, gap closing, committed with siblings closed).
- `taskitem-drag-mirror-dark-1440.png`: mid-drag from sidebar to WED 10:00, mirror renders as a clean chip, no ghosting, drop-cancel verified (no event, no dialog).
- `taskitem-focus-selected-light-1440.png`: row 1 keyboard focus (aqua ring + quick-schedule revealed via focus-within), row 3 staged `data-selected`.
- Render sites x themes: sidebar calendarMode, main list, kanban cards, 1440 + 390.

## Deviations and notes for later agents

- Duration segment `THU 14:00 · 90 MIN`: NOT rendered. Task model has no duration field (packages/shared Task). Wire it into `DueDateBadge` formatDisplay when the model gains one.
- Meta line stays hidden in calendarMode (pre-existing behavior kept deliberately: sidebar rows are grouped under day headings and stay light for dragging).
- `selected` prop exists and is styled but no call site sets it yet (no row-selection model in the app). Staged via attribute for the capture.
- Kanban board chrome (columns, card films, Schedule no-op #44) is the kanban surface agent's scope. TaskItem inside cards uses `hideCheckbox` = `data-in-card`: padding 0, no row hover bg, no tabIndex.
- Tag pills use inline `--tag-c` custom property, NOT template-literal Tailwind classes (the old dead `border-[${color}]/30` classes are gone).
- TaskItem tests updated: completion is committed AFTER the timeline (fireEvent with `detail: 1`, waitFor), reversal and keyboard-immediate cases added. user-event + vi.useFakeTimers hangs in this repo, use fireEvent + real timers for timeline tests.
- Filed #68 while capturing: usePreferencesSync clobbers the persisted theme with server prefs on boot, so the theme resets to system on reload.
- `NO DUE DATE` group heading copy (should become `No date` per brief section 7) lives in TaskList.tsx grouping, not TaskItem. Left for the list surface pass.
