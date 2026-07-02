# Kanban surface (design-brief 4.3) — evidence notes

Issue #28. Files: `src/components/tasks/TaskKanbanBoard.tsx` (rebuilt), `src/components/tasks/kanban.css` (new), `src/components/tasks/ScheduleTaskDialog.tsx` (new), `src/components/tasks/TaskControls.tsx`, `src/components/layout/TaskFocusPane.tsx`. Screenshots taken against the live dev stack (Vite :5186, API :3013) with playwright-cli headless, 1440x900 and 390x844, both themes via the in-app Settings > General toggle.

## What shipped, mapped to the brief

- Columns as gutters: `border-r` rules deleted, 16px gaps, transparent column bg. Header is 28px: status glyph + label 13/600 `--ink` + plain mono count (Badge killed, amber/green header text killed). A hover-revealed `+` per column opens the task input (visible at 40% on touch per 4.9).
- Status glyphs use the 4.1 ring language at 14px: rest ring (`--faint` stroke), in-progress amber 270deg arc (`--warning`), done filled with the LIST color + white check (never the accent).
- Card: `--surface-1`, radius 8, `--edge-machined` + `--shadow-1`, padding 9+1px border = 10px optical, 3px left `--chip-c` bar (the list color, chip formula 2.4). Title 13/500 Inter clamp-2. Footer: due chip 11px SSM caps with proximity ink (overdue `--destructive`, today `--aqua`, later `--ink-muted`) + colorless 3-bar priority glyph in `currentColor`. Done cards strike + `--ink-muted`. Hover-revealed 3-dot menu (Schedule / Delete), gray-500 prison-card look gone.
- THE DROP SETTLE: pick-up 160ms to scale 1.03 rotate 1.5deg with static `--shadow-3` on the DragOverlay. Vacated slot renders as a dashed `--etch-strong` placeholder at identical box metrics (transparent 1px border swap). Target-column gap opens 200ms via grid-template-rows 0fr -> 1fr (no height animation), slot sized to the dragged card's measured height. Drop = dnd-kit dropAnimation 320ms cubic-bezier(0.16,1,0.3,1); the real card stays hidden (`--landing`) while the overlay travels, then the pre-rendered 1px aqua inset ring plays opacity .35 -> 0 over 240ms on a pseudo-element. Transform and opacity only, box-shadow never animates.
- Verified lifecycle by sampling classes at 60ms intervals after mouseup: vacated -> landing (through ~320ms) -> flash (~240ms window) -> clear. See board-light-rimflash-1440.png (ring caught mid-flash on "Set up status page monitors").
- Empty column: rest = ghost `+ New task` dashed row (opens the enhanced task input, verified). During drag = full-height dashed etch + `--aqua-film-04`, `DROP A TASK HERE` SSM 11 caps `--etch-text` (aria-hidden); the hovered target steps to `--aqua-film-08` + `--aqua-rim` border.
- Schedule menu item wired to a real dialog (closes #44): calendar + optional time, primary action `Place`, success toast `Placed on Thu, Jul 9` (one name through the flow). Verified end-to-end: mutation persists, due chip updates.
- Board entry + active state in the Folder | List | Board segmented control, and board mode swaps the header title for a back chevron labeled with the list name (closes #56). Back returns to the folder grid.
- Mobile: columns `calc(100vw - 56px)` with next-column peek, scroll-snap mandatory, 3 pager dots (ink scale, aqua stays reserved for live/placed) that track scroll and are tappable. TaskControls header stacks to two rows under 768px (the old 3-zone grid collapsed its left column to 0px and overlapped).
- Keyboard: cards are focusable (dnd-kit attributes + `--focus-ring`), ArrowLeft/Right move a card between columns with NO animation and focus follows the card into its new column.
- Reduced motion (brief 5): pickup animation none, gap transition none, drop travel becomes a 120ms crossfade, rim flash becomes the 240ms static ring at 20%. Verified with emulateMedia: lifted card reports `animationName: none`, flash ::after reports `kanban-rim-flash-static`.

## Screenshot inventory (14)

- board-light-1440 / board-dark-1440: main board, Website launch list (indigo #6875d8 bars, aqua TODAY chips, red overdue, struck done cards).
- board-light-card-hover-1440: 3-dot menu + column `+` reveal on hover.
- board-light-drag-1440 / board-dark-drag-1440: mid-drag, all three settle elements visible (tilted overlay, vacated etch, 200ms gap slot). Dark etch is phosphor-aqua per 2.5.
- board-light-rimflash-1440: crop ~60ms into the flash after landing.
- board-light-cardmenu-1440 / board-light-schedule-dialog-1440 / board-light-placed-toast-1440: the #44 flow, menu -> dialog -> Placed toast.
- board-light-empty-ghost-1440: Work list, two empty columns with ghost `+ New task` rows.
- board-light-empty-droptarget-1440: mid-drag over an empty column, film-04 targets, hovered one at film-08 + aqua rim.
- board-light-390 / board-dark-390 / board-dark-390-page2: mobile column + peek + pager dots (page2 shows the middle dot active after swipe).

## Notes and known limits

- Seed-data times show a UTC shift (tasks were seeded with naive local ISO strings). Display code uses the stored Date faithfully. Not a board defect.
- The yellow DEV MODE panel is dev-only and was hidden via style for the screenshots.
- The card menu keeps only Schedule / Delete (existing TaskActionMenuItems). Edit / move-to-list from the menu is out of this surface's scope.
- Dialog chrome (radius 12 / surface-3 / scrim) is the 4.5 dialogs agent's scope. ScheduleTaskDialog uses the shared primitives and will inherit that pass.
