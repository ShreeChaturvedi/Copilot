# Folder cards surface — evidence (design-brief §4.2, issue #28, closes #53)

Files: `src/components/tasks/TaskFolderGrid.tsx` + `src/styles/new-folder.css` (both rebuilt). The clip-path manila folder and its detached-tab artifact are gone. All shots against the live app (Vite :5185, dev API :3012), playwright-cli headless, both themes via the in-app Settings > Theme toggle (empty-state dark shot toggled the same `.dark` class directly because the state was HMR-forced, see below).

## What landed

- Card: real `<button>`, min-height 132px (computed-verified), radius 10px, `--surface-1` + `--edge-machined`, 3px `--chip-c` top bar. `--chip-c` set inline from the list's stored color.
- Content: 28px icon tile (12% `--chip-c` film, lucide glyph from `getIconByName`, emoji ids fall back to the Folder glyph, never render), name 14px/600, count `N open` 12px Spline Sans Mono `--ink-muted`. `taskCount` is now always the active-task count to match the `N open` copy.
- Hover: `translateY(-2px)` + `--shadow-2`, 150ms `--ease-out`.
- Preview sequence (closes #53): default view fades OUT 120ms FIRST, then previews fade in 160ms delayed 120ms. Un-hover mirrors (previews out 120ms, default back in 160ms after 120ms). Name and count are outside the swap region, pinned visible. Proof: shot 07 is the real transition frozen at t=100ms via `document.getAnimations()` pause + `currentTime = 100` — icon layer fully out, previews not yet in, no double exposure (old bug: both layers at ~50%).
- Preview rows echo the §4.1 status-ring language: 8px ring, `--hairline-strong` rest, filled `--chip-c` + strike when done. Empty folder previews render two dashed `--etch-strong` rows + `No tasks yet` (shot 09).
- New-list tile: the etched drawing of a folder card — dashed 1px `--hairline-strong`, no top bar, ghost icon tile with Plus, `New list` label. Hover raises contrast (`--surface-2` wash, ink lifts), no travel.
- Click -> kanban: card scales 0.98 and holds 120ms while the board takes over. Computed transform mid-hold: `matrix(0.980315, ...)`. Reduced motion skips the hold (matchMedia check) and the CSS kills all transforms; crossfades stay at 120ms (shot 14: hover transform `none` under emulated reduce).
- Focus: `outline: var(--focus-ring)` offset 1px on every card; keyboard focus also runs the preview sequence (shot 10).
- Empty state (§4.7): three dashed ghost cards (`--etch-strong`, third hidden <640px), serif line `Every task wants a list.` (Sentient 400 18px), action line 13px `--ink-muted`, aqua `Create list` button. NOTE: unreachable through data today — the client always injects a default list — verified by temporarily forcing `folders = []` over HMR (shots 12/13), then reverting. The branch stays as defensive UI.

## Tune points / follow-ups for the integration pass

- The 12% icon-tile film is faint under low-chroma pastel list colors in light theme; §2.4's curated-hue validation script should confirm the ten swatches.
- Preview under `@media (hover: hover)` only; touch users rely on the pinned count + tap-through (per §4.1 hover gating).
- Segmented control's missing board state + back chevron (#56) is owned by the kanban agent; folder click already persists `selectedKanbanTaskListId`.

## Verification

- `npx vitest run`: 67 files, 801 tests green. `npx tsc -p tsconfig.app.json`: clean.
- Computed audit (Chrome): minHeight 132px, radius 10px, bg `oklch(1 0 0)`, name 14px/600, count 12px "Spline Sans Mono", icon 28x28, focus outline aqua.
