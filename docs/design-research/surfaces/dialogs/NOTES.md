# Surface evidence: dialogs, sheets, settings, auth (issue #28)

Captured 2026-07-02 against the live app (Vite :5188, dev API :3015) with playwright-cli headless, 1440x900 and 390x844. Themes toggled via Settings > General > Appearance (the in-app toggle; the app follows the `.dark` class after the `@custom-variant` fix). Closes #45 #46 #48 #54 and the #58 checklist across the landing commits.

## What changed (per design-brief 4.5 / 4.7 / 4.8 / 4.9, section 5 and 7)

- **Dialog/sheet/alert primitives**: `--surface-3` material, radius 12, machined edge + `--shadow-3`, 20px padding, footer over a hairline with right-aligned actions. Scrim is `--void` at 60% + `blur(4px)` in BOTH themes (night is night, so the light-theme backdrop reads dark by spec). Enter = translateY(8px) scale(0.98) + fade 240ms `--ease-settle`; exit 160ms fade; side sheets slide 280ms in / 200ms out. Motion is bound to `[data-slot]`+`[data-state]` in index.css; tw-animate classes removed from these primitives. Peek-mode dual render untouched.
- **Below 640px every dialog is a bottom sheet** (#46): pinned bottom, radius 16 16 0 0, max-h 92vh, drag handle, slide-up 280ms. Create Event stacks its name/calendar row and wraps the date/time row.
- **Primary buttons**: filled aqua with `--aqua-ink`; disabled = 40% opacity aqua, never gray; hover moves toward contrast (`--aqua-hover`); focus = 2px aqua outline offset 1.
- **TaskDetailSheet** (#45): permanent field rows STATUS / SCHEDULE / PRIORITY / LIST / TAGS. Unset fields are drawn, not hidden: SSM 11 caps label in `--etch-text` + a dashed `--etch-strong` ghost slot ("No date", "No priority", "No list", "No tags"). Every control writes through the real update API (verified: scheduledDate, priority, taskListId, tags persist via PUT /api/tasks/:id; scheduledDate:null clears). The permanent fake-spinner Loader is gone.
- **Create list / Create calendar**: one anatomy (CreateCollectionDialog): icon tile + name row, ten curated 24px swatches with named aria-labels and same-hue selection ring, copy "Create list" / "Create calendar" (kills the "Create Task" bug).
- **Settings** (#48): below 768px the two-pane layout is a list -> detail push (240ms `--ease-settle`, back chevron, deep links land on detail). Desktop rail re-based onto hairline/surface tokens at max-w-5xl. SharedToggleButton no longer renders empty pills below 640px when options lack short labels. Integrations panel inherits the token pass.
- **Auth** (4.8): conic rainbow, frosted panel, and cursor glow deleted (~230 lines of CSS + three mousemove trackers). Auth = the room: `--background` canvas, wordmark, one 400px `--surface-1` card with machined edge + `--shadow-2`, rim lifts to `--aqua-rim` on focus-within, one filled aqua primary. Real hrefs on Sign up / Sign in links, `autocomplete=new-password` on signup fields, strength meter on the token ladder (destructive/warning/aqua).
- **#54**: checkbox rest ring = `--hairline-strong` both themes (dark computes `oklch(0.332 0.023 203)` at runtime, verified via in-app toggle).
- **#58**: aria-labels say task on the task sheet, status chip keeps its label at 390, "NO DUE DATE" group is "No date", loader removed, signup link href fixed, autocomplete added.
- **Reduced motion**: all dialog/sheet enter/exit collapse to 120ms crossfades (verified via emulated `prefers-reduced-motion`: computed `settle-fade-in 0.12s` on open).

## Screenshot index

| File                               | Proves                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| create-event-center-light-1440.png | Dialog material, void scrim, hairline footer, 40% aqua disabled primary |
| create-event-sheet-light-390.png   | #46: Create Event fully usable at 390 as a bottom sheet (light)         |
| create-event-sheet-dark-390.png    | #46 in dark; drag handle, stacked fields, aqua focus ring               |
| task-sheet-light-1440.png          | #45: field rows, mono values (FRI, JUL 3 - 9:00 AM), etched TAGS ghost  |
| task-sheet-dark-1440.png           | #45 in dark; etch is phosphor-aqua, not white                           |
| task-sheet-dark-390.png            | #58: status chip keeps label at 390; etched SCHEDULE/TAGS slots         |
| create-list-dark-1440.png          | Unified anatomy: icon tile + name + 24px swatches + "Create list"       |
| settings-desktop-light-1440.png    | Token-aligned two-pane settings, aqua theme chips                       |
| settings-nav-dark-390.png          | #48: nav list is the first mobile screen (chevrons, full width)         |
| settings-detail-dark-390.png       | #48: pushed detail with back chevron; Integrations panel aligned        |
| tasks-checkboxes-dark-1440.png     | #54: quiet hairline checkbox rings on the dark canvas                   |
| login-light-1440.png               | 4.8: the room, machined 400px card, one aqua primary                    |
| login-dark-1440.png                | 4.8 dark: aqua is the light (bright fill, ink text)                     |
| login-focus-rim-1440.png           | Card rim lifts to --aqua-rim on focus-within                            |
| signup-dark-390.png                | Auth at 390; new-password autocomplete fields                           |

## Notes and follow-ups for other agents

- Theme preference sync stomps the in-app toggle on reload (usePreferencesSync pulls the server value over the local store). Worked around in captures by PATCHing /api/user/preferences; worth a look from workstream A.
- Mobile drawer's Calendar/Tasks ViewToggle did not switch the main view at 390 during captures (view switch works at desktop widths). Not a surface owned here; flagging for the layout agent.
- The dev DB was wiped twice by sibling agents mid-capture; evidence data is the seeded Work/Personal lists + 6 tasks + Team calendar under dlg-agent@example.com / dev-user context.
