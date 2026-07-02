# Taskflow Calendar — Design System & Frontend Architecture Map

Recon date: 2026-07-01. Branch: `finish-polish-deploy`. All paths relative to `/home/shree/dev/taskflow-calendar` unless absolute. All line numbers verified against the current working tree.

## 1. Stack (versions from package-lock.json, verified)

- **Tailwind CSS 4.1.11** (CSS-first v4). Wired via `@tailwindcss/vite` 4.1.11 in `vite.config.ts:4,8`. `postcss.config.js` also declares `@tailwindcss/postcss` + `autoprefixer` (redundant for Vite builds; the Vite plugin wins).
- **tw-animate-css 1.3.6** — imported at `src/index.css:4`. Provides `animate-in/out`, `fade-*`, `zoom-*`, `slide-in-from-*`, AND `animate-collapsible-down/up` + `animate-accordion-*` keyframes (verified in `node_modules/tw-animate-css/dist/tw-animate.css`).
- **FullCalendar 6.1.18** — `@fullcalendar/{core,react,daygrid,timegrid,list,interaction}`. v6 injects its CSS at runtime via JS (no CSS imports).
- **framer-motion 12.23.12** (own manualChunk `animation` with `@use-gesture/react`, `vite.config.ts:102`).
- React 19.1.0, react-router-dom 7.7.1, zustand 5.0.6, @tanstack/react-query 5.83, lucide-react 0.525.0, sonner 2.0.7 (Toaster mounted in `src/App.tsx`), cva 0.7.1 + tailwind-merge 3.3.1 (`cn` in `src/lib/utils`), full Radix set, `@dnd-kit/core` 6.3.1 (kanban), `react-dnd` 16 (installed, chunked at vite.config.ts:99, little/no live usage found), `react-resizable-panels` 3.0.4, `react-day-picker` 9.8.1, recharts 3.1.2, emoji-mart, cmdk, pell (rich text).
- Vite 5.4.19 with heavy `manualChunks` (`vite.config.ts:36-113`): `calendar`, `animation`, `nlp`, `analytics`, `emoji`, `editor`, `pdf`, `dnd`, radix split. Dev server port note: run `npx vite --port 5180 --strictPort` locally (5173 held by another project; config says 5173 strictPort at vite.config.ts:117).

## 2. Tailwind config reality — CRITICAL

`tailwind.config.js` (repo root) exists and declares `darkMode: 'class'`, custom grays (750:#2d3748, 850:#1a202c, 950:#0a0a0a), and `fadeIn/slideIn/collapsible` keyframes. **It is DEAD CONFIG.** Tailwind v4 only loads a JS config through a `@config` directive, and there is **no `@config` or `@custom-variant` anywhere** (grepped all CSS in repo, node_modules excluded). Consequences, verified in the built CSS `dist/assets/index-BVF8byrj.css`:

- `dark:` variants compile to `@media (prefers-color-scheme: dark)` (found: `@media (prefers-color-scheme:dark){.dark\:border-amber-400{...}}`), **not** `.dark &` (0 matches for `where(.dark`).
- The app toggles a `.dark` **class** on `<html>` (`src/stores/themeStore.ts:32-51`). So: CSS-variable tokens swap correctly (they're defined under `.dark` in index.css), but every `dark:*` utility (31 tsx files use them: kanban accents, button-variants, ViewSwitcher, sheet, dropdowns…) follows the **OS setting**, ignoring the in-app toggle. Mismatch bug. Fix = add `@custom-variant dark (&:is(.dark *));` to `src/index.css` right after the tailwind import.
- Custom grays 750/850/950 and `animate-fade-in`/`animate-slide-in` from the JS config generate nothing (no tsx uses them, so no visible breakage). `animate-collapsible-down/up` used in `LeftPane.tsx:181,389` still work only because tw-animate-css 1.3.6 happens to define them.
- The `success` color works because it's mapped in `@theme inline` (index.css:130-131), not because of the JS config.

## 3. Design tokens (`src/index.css`, 753 lines)

- Light tokens: `:root` lines 8-70. Dark tokens: `.dark` lines 152-195. shadcn "new-york" / zinc, all **oklch**. Examples: `--background: oklch(1 0 0)` / dark `oklch(0.141 0.005 285.823)`; `--primary: oklch(0.21 0.006 285.885)` / dark `oklch(0.92 0.004 286.32)`; `--destructive: oklch(0.577 0.245 27.325)`; `--radius: 0.625rem`.
- Extra non-stock tokens: `--success`/`--success-foreground` (43-44, 168-169), `--info-popover` (61-62, via color-mix), scrollbar tokens `--scrollbar-size: 8px`, `--scrollbar-size-lg: 12px`, thumb/track (63-69, 188-194).
- `@theme inline` mapping at 110-150 exposes them as `--color-*` utilities + radius sm/md/lg/xl.
- **Runtime token**: `--default-calendar-color` set on `<html>` by `CalendarView.tsx:144-151` from the default calendar's color; consumed by calendar.css mirror/highlight rules (264-271, 344-352).
- Chart palette `--chart-1..5` (48-52, 173-177) consumed by TaskAnalytics (recharts) and `.gradient-text-blue-red` utilities (index.css:496-517 — note these wrap chart tokens in `oklch(var(--chart-3))` which is ALSO invalid since tokens are full `oklch(...)` values already; see §11 landmines).

### hsl(var(--token)) landmine — VERIFIED VISUALLY

Large parts of `calendar.css` and some of `index.css` wrap the (now-oklch) tokens in `hsl(...)`, e.g. `.fc-col-header-cell { background-color: hsl(var(--muted)); }` (calendar.css:137-141). `hsl(oklch(...))` is invalid at computed-value time → the declaration resolves to `unset`. Verified against `loggedin-calendar.png` (repo root): week-view column headers render with **no** muted background, while the today-column tint (raw `oklch(0.7 0.15 140 / 0.15)`, calendar.css:61-71) works. Practical effect: most `hsl(var(--X))` colors in calendar.css (backgrounds, hovers, event fallback colors, scrollbars, popover styling) and `index.css` rte/scrollbar rules (e.g. 66-68, 215, 229-231) are silently dead; the calendar mostly inherits `bg-background` from utilities. Any redesign touching calendar.css should strip the `hsl()` wrappers first — that alone will visibly change the calendar.

## 4. Global stylesheets (complete inventory; only 5 CSS files are actually imported)

| File                                                   | Lines | Imported by             | Contents                                                                                     |
| ------------------------------------------------------ | ----- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `src/index.css`                                        | 753   | `src/main.tsx:3`        | Google-font import, tw-animate, tailwind, tokens, base layer, auth-page effects              |
| `src/components/calendar/calendar.css`                 | 679   | `CalendarView.tsx:12`   | ALL FullCalendar overrides                                                                   |
| `src/styles/new-folder.css`                            | 125   | `TaskFolderGrid.tsx:11` | folder-card shape/hover                                                                      |
| `src/components/ui/range-slider.css`                   | 62    | `RangeSlider.tsx:2`     | slider styling                                                                               |
| `src/components/smart-input/components/smart-tags.css` | 286   | `SmartTaskInput.tsx:45` | contentEditable highlight input; uses `rgb(from var(--tag-color) ...)` relative color syntax |
| `src/App.css`                                          | 0     | nothing                 | empty                                                                                        |
| `src/styles/folder.css`                                | 28    | **nothing — dead file** | older clip-path folder variant                                                               |

Notable blocks in `index.css`:

- Base-layer global scrollbar theming on `*` (410-457) + `.scrollbar-styled` / `.scrollbar-hide` helpers (459-493). `html { scrollbar-gutter: stable both-edges }` (79-83) affects layout width globally.
- **Checkbox nuclear option** (347-368): `button[role='checkbox']` forced to exactly 1rem with `!important` on every box property. Any checkbox redesign fights this first.
- Pell rich-text theming `.rte-*` (205-345).
- `:has()` hacks keeping hover action icons visible while a Radix dropdown is open, keyed on `data-slot='dropdown-menu-content'` (417-427).
- **Task drag transition kill** (599-607): `.group\/task, .group\/task * { transition: none !important; }` with a partial re-enable for background-color hover (604-607). This globally disables transitions inside every task row (added to stop FullCalendar drag ghosting). Constrains any task-row motion design.
- Vite-template leftovers: `h1 { font-size: 3.2em }` (95-98), `@media (prefers-color-scheme: light) { :root { color:#213547 } }` (100-108) — this last one fights the token system on light-OS machines.
- `.debug-dropdown-item` / `.debug-ai-badge` gradient hover styles (522-596) — used by smart-input dropdown; keyed off `prefers-color-scheme`, not `.dark` (same media/class mismatch).
- Auth pages (623-753): `.auth-gradient-bg` animated OKLCH conic gradient (`@property --auth-angle`, 90s rotation), `.frosted-panel` glass, `.cursor-glow-border` green cursor-tracked border (radial-gradient + mask; JS sets `--glow-x/--glow-y` from `src/components/auth/AuthLayout.tsx:20`, `pages/Login.tsx:15-17`). Used by `pages/{Login,Signup,ForgotPassword,ResetPassword}.tsx`, `components/login-form.tsx:119`.

## 5. Fonts

- **Inter 300/400/500/600/700 only** — loaded TWICE from Google Fonts: `index.html:8-10` (preconnect + stylesheet link) and `src/index.css:2` (`@import url(...)`). No `@font-face`, no self-hosting, no display font. Stack set on `:root` (index.css:9-19): `'Inter', ui-sans-serif, system-ui, ...`. No mono font declared (uses `font-mono` utility → Tailwind default stack, e.g. TaskList.tsx:237).
- A redesign changing type: touch `index.html:10`, `src/index.css:2,9-19`, and consider `--font-sans` in `@theme`.

## 6. Dark mode mechanism

- `src/stores/themeStore.ts` (zustand + persist key `theme-store`): `theme: 'light'|'dark'|'system'` (default `system`), resolves via `matchMedia('(prefers-color-scheme: dark)')`, `applyThemeToDocument` (32-51) toggles `dark` class on `document.documentElement` and rewrites `<meta name="theme-color">` to hardcoded `#1f2937`/`#ffffff` (48).
- Bootstrapped by `src/components/providers/ThemeProvider.tsx` (mount effect + `onRehydrateStorage`), which renders a **blue spinner** (`border-blue-600`, line 43) pre-init. No inline `<head>` script → flash-of-light-theme risk on dark systems.
- UI toggle in `src/components/settings/GeneralSettings.tsx`.
- **Remember**: token swap = class-driven (works); `dark:` utilities = media-driven (broken w.r.t. the toggle). See §2.

## 7. shadcn setup

`components.json`: style `new-york`, `rsc: false`, tailwind css `src/index.css`, baseColor `zinc`, cssVariables `true`, no prefix, aliases `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`, iconLibrary `lucide`.

`src/components/ui/` inventory (46 files): alert-dialog, alert, avatar, badge, BaseList, **Button.tsx (capitalized!)** + button-variants.ts, calendar (react-day-picker), card, checkbox, CircularCheckbox, collapsible, color-picker, combobox, command (cmdk), CursorTooltip, CustomTimeInput, datetime-input, dialog, dropdown-menu, emoji-picker, form, icon-picker, icons.ts, index.ts, Input.tsx, label, Modal.tsx, popover, progress, radio-group, range-slider.css + RangeSlider, resizable (react-resizable-panels), RichTextEditor (pell), scroll-area, Select.tsx, separator, SharedToggleButton, sheet, sidebar (738 lines, full shadcn sidebar), skeleton, switch, tabs, textarea, toggle-group, toggle, tooltip, ViewSwitcher, ViewToggle.

Deviations from stock shadcn:

- `Button` import path is `@/components/ui/Button` (capital B); variants live in `button-variants.ts` with an extra `authPrimary` variant; `outline` variant has a typo class `dark:bg/input/30` (button-variants.ts:13) — dead class, dark outline buttons lack their intended bg.
- `badge.tsx` adds a `size: sm|md` axis (8-30).
- `checkbox.tsx` adds `customColor` prop (inline backgroundColor/borderColor when checked, 33-37) + heavy `!important` resets (24-29); pairs with the global `button[role='checkbox']` CSS in index.css.
- All primitives stamp `data-slot="..."` attributes (dialog.tsx, sheet.tsx, card.tsx, sidebar.tsx...) — some CSS targets them (index.css:417-427); safe hook for a redesign, risky to rename.

## 8. Layout skeleton (who renders what)

```
App.tsx (Router, QueryProvider, ThemeProvider, Toaster, DevAuthToggle[dev])
└─ MainLayout (src/components/layout/MainLayout.tsx:81-119)
   ├─ SidebarProvider (defaultOpen from settingsStore.sidebarExpanded)
   ├─ TopProgressBar (128-236): fixed 3px bar, gradient 'linear-gradient(90deg in oklch, oklch(92% 0.26 145) 0%, oklch(60% 0.18 155) 100%)' (212)
   ├─ LeftPane (lazy) → BaseSidebarPane.tsx:135-165 → ui/sidebar.tsx Sidebar collapsible="offcanvas"
   │    SIDEBAR_WIDTH = 20rem, MOBILE 22rem, ICON 3rem (sidebar.tsx:29-31); NOT user-resizable
   │    header: ViewToggle (calendar|task) + SmoothSidebarTrigger; content per view:
   │    calendar view → SmartTaskInput (collapsible) + TaskList calendarMode maxTasks=10 + CalendarList footer
   │    task view → MiniCalendar (ui/calendar, `[--cell-size:--spacing(7)]`) + EventOverview + TaskGroupList footer + TaskAnalyticsSummary
   └─ currentView === 'task'
        ? TaskFocusPane (layout/TaskFocusPane.tsx)
        : MainContent → RightPane (layout/RightPane.tsx:127-177)
             ├─ ConsolidatedCalendarHeader (lazy)
             ├─ CalendarView (FullCalendar)
             ├─ EventCreationDialog (lazy) / EventDisplayDialog (lazy)
```

- `ResizableDivider` (`src/components/layout/ResizableDivider.tsx`, 165 lines) is **ORPHANED**: exported in `layout/index.ts:4` and unit-tested, but rendered nowhere. It contains its own out-of-system styling (hardcoded `gray-700/600` gradient + green-400 glow dots, lines 93-163). Do not treat as live surface; candidate for deletion.
- Actual pane resizing = react-resizable-panels inside the task view (`TaskPaneContainer.tsx:478-507`), handle at 503: `<ResizableHandle className="w-1 bg-border hover:bg-border-hover ..."/>` — `border-hover` token doesn't exist → hover class is dead.
- Left↔right divider in calendar view: none; sidebar is offcanvas fixed-width with a rail (`ui/sidebar.tsx:232-260`).

## 9. Target-component style surfaces

### 9.1 Task item — `src/components/tasks/TaskItem.tsx` (668 lines)

The single task row/card used in all three list surfaces.

- **Container**: wrapper `<div className="relative">` (312); row div (313-335): `group/task py-2 px-3 rounded-md`; calendarMode adds `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` + `cursor-grab` + inline `{transition:'none', transform:'none', animation:'none'}` (326-332).
- **Top row** (337-464): flex items-center gap-3.
  - Completion control (339-357): settingsStore `taskCompletionControl` picks `Checkbox` (customColor=groupColor when completed) or `StatusBadge iconOnly` (tasks/StatusBadge.tsx:48-65 — 20x20 bordered chip, amber-500/emerald-600/muted per status, dropdown to change).
  - Title (361-432): edit-in-place input or display div `cursor-pointer text-sm font-medium px-1 py-0.5 h-[1.25rem] leading-5 truncate`; completed → `line-through text-muted-foreground opacity-[${COMPLETED_TASK_OPACITY}]` (line 387-388). **DEAD CLASS**: the template literal means Tailwind never generates `opacity-[0.6]`; completed rows get strike+muted but no opacity change.
  - Optional inline list label (397-429): `↳ emoji name`, opacity-60 hover:100.
  - 3-dot menu (436-463): `opacity-0 group-hover/task:opacity-100`, ghost icon Button h-7 w-7, DropdownMenuContent side=right w-48 → `TaskActionMenuItems`.
- **Tag rows** (466-604), hidden in calendarMode: indent `ml-7` when checkbox shown; horizontal `ScrollArea`; `DueDateBadge` (tasks/DueDateBadge.tsx:116-169 — Badge outline, hardcoded hex states: reminder `#3b82f6`, overdue `#ef4444`, backgrounds via `${hex}1A` inline style, `color-mix(in srgb, currentColor 10%, transparent)` default); smart tags Badge outline size=md with inline `borderColor: ${tag.color}30`, `backgroundColor: ${tag.color}1A` (515-523) — the className version at 512-513 (`border-[${tag.color}]/30`) is another dead template-literal class; icon→X swap on hover (534-547). Attachment badges (556-600).
- **Drag**: FullCalendar `new Draggable(element, {eventData})` per item in calendarMode (263-309); drag color = default calendar color → groupColor → `#3788d8`. This is WHY transitions are killed globally (index.css:599-607). Redesign must not add transforms/transitions to the row in calendarMode.
- **Props** (46-60): `task, onToggle, onEdit, onDelete, onSchedule?, onRemoveTag?, groupColor?, className?, calendarMode?, showTaskListLabel?, hideCheckbox?`.
- **Render sites**: sidebar `TaskList.tsx:552-564` (calendarMode, grouped by day, `space-y-1`); main list panes `TaskList.tsx:581-593` via `TaskPaneContainer`; kanban `TaskKanbanBoard.tsx:317-334` (`hideCheckbox`, `className="p-0"`); kanban DragOverlay copy (383-393). `TaskItemDemo.tsx` is a dead demo. **No virtualization anywhere** (grep clean for virtual/react-window/virtuoso); sidebar capped at `maxTasks=10`.
- Also owned by TaskItem: `TaskDetailSheet` (right sheet on title click, tasks/TaskDetailSheet.tsx:152-176) and `AttachmentPreviewDialog`.

### 9.2 Folder region — `src/components/tasks/TaskFolderGrid.tsx` (266) + `src/styles/new-folder.css` (125)

- Grid: `p-6` wrapper, `grid gap-x-6 gap-y-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6` (205-211).
- FolderItem (61-155): `.folder-wrapper` (padding-top:75% aspect hack, new-folder.css:6-12) with `style={{'--folder-color': folder.color}}` (82). `.folder-body` = `background: var(--card)`, radius `8px 18px 18px 18px`, drop-shadow, hover translateY(-4px) (css:20-35). Folder tab = `::before` with hand-tuned `clip-path: path('M 0 0 L 70 0 C 85 1, 80 12, 95 12 L 0 12 z')` (css:37-49); color bar = `::after` `background: var(--folder-color, #7036e9)` (css:51-61).
- Hover swaps `.default-view` (icon chip w/ inline `${folder.color}15` bg at line 91, name `font-semibold text-lg`, count) for `.preview-view` (first 3 task titles) via opacity (css:70-98). Hover hides the folder name — a UX constraint to keep or fix deliberately.
- Add-new tile (220-240) + `.add-new-folder` dashed border styles (css:100-125).
- Data/flow: `useTaskManagement` tasks+taskGroups → `createTaskFolders` (17-54, preview = 3 active + fill to 4); click → `handleSelectTaskGroup(folderId)`, `setTaskViewMode('kanban')`, `setSelectedKanbanTaskListId(folderId)` (172-181, uiStore). CreateTaskDialog for new list.
- new-folder.css uses raw `var(--card)/var(--border)` correctly (no hsl() wrapper) except `hsl(var(--primary) / 0.05)` at css:109 (dead, see §3 landmine).

### 9.3 Kanban board — `src/components/tasks/TaskKanbanBoard.tsx` (403), lazy-loaded from `TaskFocusPane.tsx:13`

- Status theming centralized in `getStatusConfig` (34-77): not_started `gray-500` / in_progress `amber-500` / done `emerald-600`, each `bg-*/10` + `border-*` + `dark:bg-*-400/10 dark:border-*` (dark: variants → OS-media, §2).
- Board (345-357): mobile `flex overflow-x-auto gap-4 snap-x snap-mandatory`, desktop `md:grid md:grid-cols-3 md:gap-0`.
- Column (217-278): `border-r border-border last:border-r-0`, `min-w-[min(85vw,24rem)] md:min-w-0`; header `border-b px-4 py-2 bg-muted/10` with status Icon + label + count Badge outline; droppable body `px-4 py-2`, `space-y-2 md:space-y-3 min-h-[60vh]`; empty state "Drop tasks here".
- Card (281-337): dnd-kit `useDraggable`, `Card` (ui/card.tsx: `bg-card rounded-xl border py-6 shadow-sm` — overridden here to `shadow-sm border rounded-md py-2 px-2 sm:px-3`) + statusConfig classes + cursor-grab/grabbing; original hidden while dragging (opacity 0), visual handled by `DragOverlay` (360-398: `scale-105 shadow-2xl ring-1 ring-black/5` + inline boxShadow).
- Interaction: `DndContext` + PointerSensor `activationConstraint: {distance: 6}` (135-137); optimistic column move via `dragState.targetColumn` merged in `grouped` memo (99-133); drop → `updateTask.mutate({status, completed})` (186-215); sonner toast on error.
- List filter: `selectedKanbanTaskListId ?? activeTaskGroupId`; 'default' = tasks with no `taskListId` (105-113).

### 9.4 Calendar header + left pane layout

- **ConsolidatedCalendarHeader** `src/components/calendar/ConsolidatedCalendarHeader.tsx` (467), lazy-rendered by `RightPane.tsx:130-138`:
  - Wrapper (409-414): `flex-shrink-0 p-4 border-b border-border bg-background`.
  - 3-zone grid `grid grid-cols-[1fr_auto_1fr] items-center gap-4` (416).
  - Left (418-430): `SmoothSidebarTrigger position="rightPane"` (only visible when sidebar collapsed; `layout/SmoothSidebarTrigger.tsx`, uses `animate-in fade-in-0 slide-in-from-left-2`), title `text-lg font-semibold` with bold first word / normal rest (421-429). Title text derives from FullCalendar API and updates on `datesSet` (384-407, 10ms setTimeout).
  - Center (433-438): `ViewSwitcher` (`src/components/ui/ViewSwitcher.tsx`) — segmented control `rounded-lg border bg-background shadow-xs p-0.5` + absolutely positioned sliding indicator measured via getBoundingClientRect (51-105). Options M/W/D/L with responsive short labels.
  - Right (441-464): Today outline Button (disabled-when-current logic 329-363 reads FullCalendar view range); `CalendarToolbar` (187-289) in `bg-muted/30 rounded-md p-1`: framer-motion expanding search (69-174, `width: 0 → 200px`, Ctrl/Cmd+F shortcut), disabled Filter button, chevron prev/next, and the "glisten" New Event `+` button (256-286): gradient `bg-gradient-to-br from-secondary/98 via-secondary to-secondary/95`, shimmer `before:` sweep translate-x -150%→150% over 480ms, `hover:scale-105`.
- **RightPane** root `h-full flex flex-col bg-background overflow-hidden right-pane-container` (RightPane.tsx:127); `.right-pane-container` overscroll/touch-action rules in calendar.css:603-634.
- **Left pane**: see §8. Styling knobs: `SIDEBAR_WIDTH` (`ui/sidebar.tsx:29`), `bg-sidebar`/`--sidebar-*` tokens, `BaseSidebarPane` header `pt-4 pb-2 px-2` (138). Calendar-list stagger animation classes `.calendar-item` + `fadeInStagger` keyframes live at calendar.css:640-680 (also reused by LeftPane collapsibles, LeftPane.tsx:186,395).
- **Task-view header analog**: `TaskFocusPane.tsx:163-175` (`border-b border-border bg-background p-4`) wrapping `TaskControls` (`src/components/tasks/TaskControls.tsx`, 586 lines — segmented view toggles list/kanban/folder, sort/filter dropdowns, framer-motion search; SharedToggleButton ui component). The drag-scheduling strip at TaskFocusPane.tsx:178-204 uses hardcoded light-only colors (`bg-green-50 border-green-200 text-green-700`, blue/purple/orange/gray) — unreadable in dark mode.

### 9.5 Dialogs

- **Base primitives**: `ui/dialog.tsx` — Overlay `bg-black/50` + `animate-in/out fade-in-0/out-0` (40); Content (64): `fixed top-[50%] left-[50%] translate-x/y-[-50%] z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg overflow-hidden bg-background` + `zoom-in-95/out-95`; close button = ghost Button top-4 right-4 (71-91). Header/Footer/Title/Description standard (98-145). `ui/sheet.tsx` — right sheet `w-3/4 sm:max-w-sm border-l slide-in-from-right duration-500/300` (61-63).
- **Peek-mode dual render** (the app's signature dialog pattern): `EventCreationDialog.tsx:1150-1196` and `EventDisplayDialog.tsx:285-318` mount BOTH a `Sheet` (right panel, `w-full sm:max-w-lg md:max-w-xl p-6 overflow-y-auto [&>button]:hidden`) and a `Dialog` (`max-h-[90vh] overflow-y-auto` / `sm:max-w-[400px]`), gated by `uiStore.peekMode` ('right'|'center') so switching modes doesn't flicker. `TaskDetailSheet.tsx:152-176` uses the same sheet sizing; header uses `IntegratedActionBar` (dialogs/IntegratedActionBar.tsx) with a peek-mode toggle.
- Other dialogs: `CreateTaskDialog.tsx:108` and `CreateCalendarDialog.tsx:113` `sm:max-w-[500px]` (emoji + color pickers inside); `TaskAnalyticsDialog.tsx:769` (recharts, chart tokens); `SettingsDialog` (`src/components/settings/`, sectioned, lazy from MainLayout.tsx:8); `AttachmentPreviewDialog` (pdfjs preview); destructive confirms via `ui/alert-dialog` (e.g. TaskList.tsx:628-648, recurring-event scope pickers EventCreationDialog.tsx:1040+, `bg-destructive hover:bg-destructive/90` actions); `dialogs/ConditionalDialogHeader.tsx`, `dialogs/RecurrenceSection.tsx` are shared subparts. Toasts: sonner `<Toaster/>` in App.tsx.

## 10. FullCalendar integration & override strategy

- Component: `src/components/calendar/CalendarView.tsx` (524). Plugins daygrid/timegrid/list/interaction; `headerToolbar={false}` (custom header instead); views: dayGridMonth / timeGridWeek (default) / timeGridDay / listWeek; `key={slotMinTime}-{slotMaxTime}` forces remount when settings change (401).
- Styling levers, in order of power:
  1. `--fc-*` CSS vars set on `.fc` (calendar.css:6-22): `--fc-border-color: var(--border)` (valid), `--fc-today-bg-color` (raw oklch, valid), page/neutral bg (hsl-wrapped, dead).
  2. Plain-selector overrides w/ liberal `!important` throughout calendar.css (headers 137-157, slots 190-243, events 249-301, now-indicator 307-323 using `var(--destructive)` raw = valid, list view 361-394, popover 426-461, scrollbars 504-521, responsive/print/contrast 527-601).
  3. React content injection: `dayHeaderContent` (CalendarView.tsx:504-519 → `.day-header-container/.day-header-name/.day-header-number(.today)` styled at calendar.css:79-131 — today pill `oklch(0.7 0.15 140)` green, dark `oklch(0.6 0.25 140)`); `slotLabelContent` (441-457, NOON label + `<span class="fc-slot-hour/meridiem">` html); `eventClassNames` (470-478, adds `fc-event-preview` for task-drag mirrors); `dayCellClassNames` (469, tailwind hover classes into FC cells).
  4. Inline event colors: `transformEventsForCalendar` (185-217) sets `backgroundColor/borderColor` per event from `event.color || calendar.color || '#3788d8'`, `textColor:'#ffffff'`; plus `eventBackgroundColor/eventBorderColor={defaultCalendar?.color}` props (479-480). Event chips are NOT token-driven — a palette redesign must handle user-picked calendar colors (color-picker ui) rather than tokens.
- Layout coupling: sidebar expand/collapse triggers a 7ms-interval `calendarApi.updateSize()` loop for 210ms (84-107) matching the sidebar's 200ms width transition — changing sidebar animation duration requires updating this.
- Gestures: wheel/touch swipe navigation (`useSwipeDetection`, 325-357); overscroll/touch-action hard-disabled on calendar containers (calendar.css:603-634).
- External task drag-in: `Draggable` per TaskItem (§9.1) + `eventReceive` (154-180) removes temp event and opens the create dialog; mirror styled by `.fc-event-preview` using `--default-calendar-color` (calendar.css:264-271).

## 11. Animation/motion inventory

- **framer-motion** (12.23): ConsolidatedCalendarHeader search expand; TaskFocusPane EnhancedTaskInput overlay (`initial/animate/exit y:12 fade`, 220-272); TaskControls; used sparingly elsewhere (grep `motion.` for full list).
- **tw-animate-css**: all Radix open/close states (dialog/sheet/dropdown/popover/tooltip), SmoothSidebarTrigger entrance, LeftPane collapsibles (`animate-collapsible-down/up`).
- **Hand-rolled CSS**: `.calendar-item` fadeIn/OutStagger (calendar.css:640-680), auth conic gradient + breathe (index.css:637-696), New Event shimmer (utility classes), TopProgressBar rAF/EMA logic (MainLayout.tsx:180-207).
- **@dnd-kit** transforms for kanban; FullCalendar's own drag mirrors for calendar.
- `prefers-reduced-motion` handled only for auth bg (index.css:666-671) and FC transitions (calendar.css:572-579).

## 12. Leverage points — minimal file set for a design overhaul

1. **`src/index.css`** — tokens (:root/.dark), radius, fonts, scrollbars, and the place to add `@custom-variant dark (&:is(.dark *));`. ~90% of component chrome follows tokens automatically (bg/fg/card/border/accent/sidebar).
2. **`src/components/calendar/calendar.css`** — the entire calendar skin. Fix `hsl(var(--*))` wrappers here (mechanical: `hsl(var(--x))` → `var(--x)`, `hsl(var(--x) / a)` → `color-mix` or oklch w/ alpha) and the calendar snaps to the token system.
3. **`src/components/ui/button-variants.ts`, `badge.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `checkbox.tsx` (+ index.css checkbox block), `ViewSwitcher.tsx`, `sidebar.tsx` (width consts line 29-31 + sidebar tokens)** — system-wide component look.
4. **`src/components/tasks/TaskItem.tsx`** (+ `DueDateBadge.tsx`, `StatusBadge.tsx`) — the task row; also de-hardcode `#3b82f6/#ef4444` and fix the two dead template-literal classes (388, 512-513).
5. **`src/styles/new-folder.css` + `TaskFolderGrid.tsx` grid classes (205-211)** — folder region.
6. **`TaskKanbanBoard.tsx` `getStatusConfig` (34-77) + Column/Card class strings (228-235, 303-313, 369-381)** — kanban.
7. **`ConsolidatedCalendarHeader.tsx` (195, 261-277, 410-416)** and **`TaskFocusPane.tsx:163-204` / `TaskControls.tsx`** — the two app headers.
8. **`MainLayout.tsx:212`** (progress-bar gradient), **`themeStore.ts:48`** (meta theme-color hexes) if the palette changes.
9. **`CalendarView.tsx:185-217, 479-480`** only if event-chip treatment changes (colors are data-driven).

## 13. Risks

- **dark: variant vs .dark class mismatch** (§2) — any dark-mode polish is built on sand until `@custom-variant dark` is added; adding it will _change_ current behavior for OS-dark users (dark: utilities suddenly follow the toggle) — retest both modes. Candidate GitHub issue (not filed; recon was read-only/plan mode).
- **hsl(oklch) dead declarations** (§3) — fixing them will make dormant styles (muted headers, hovers, scrollbars, rte chrome) suddenly appear; visual diff carefully. Same class of bug: `oklch(var(--chart-N))` in index.css:496-517.
- **!important wars**: global checkbox sizing (index.css:347-368), time-picker scroll (370-408), calendar.css everywhere, `.group/task` transition kill (599-607). New styles at lower specificity will silently lose.
- **FullCalendar coupling**: runtime-injected FC base CSS can shift between versions; drag preview depends on inline colors + `--default-calendar-color` runtime var; sidebar-resize updateSize loop hardcodes 200/210ms; TaskItem drag requires no transforms on rows.
- **Dead/misleading artifacts**: `tailwind.config.js` (lies about darkMode/theme), `src/styles/folder.css`, `ResizableDivider.tsx` (+ its styling), `TaskItemDemo.tsx`, `ConsolidatedCalendarHeaderDemo.tsx`, `App.css`, `hover:bg-border-hover` (TaskPaneContainer.tsx:503), `dark:bg/input/30` typo (button-variants.ts:13), Vite-template `h1`/light-scheme rules (index.css:95-108).
- **Hardcoded palettes off-token**: DueDateBadge hex blues/reds; drop-zone strip light-only colors (TaskFocusPane.tsx:178-204); kanban amber/emerald/gray; ThemeProvider blue spinner; ResizableDivider greens; smart-tags fallback #3b82f6; event default #3788d8. A palette change must sweep these by hand.
- **Double Inter fetch** (index.html + index.css) and no font fallback metrics — swap-flash risk; `scrollbar-gutter: stable both-edges` on html affects width math if layout is rebuilt.
- **No virtualization**: fine today (lists capped/small); folder->kanban->list all re-filter full task arrays per render — heavy visual trees inside TaskItem multiply cost across panes.
- **Radix data-slot dependencies**: index.css `:has([data-slot='dropdown-menu-content'])` hacks break if slots are renamed; `[&>button]:hidden` on SheetContent hides the built-in close (dialogs supply their own action bars).
- **FOUC**: theme applied post-hydration (no head script).

## 14. Repro/verify commands

- Dev: `npx vite --port 5180 --strictPort` + `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/react_calendar_dev npx tsx scripts/dev-server.ts` (port 3001; `/api` proxied). Postgres via repo `docker-compose.yml`.
- Verify dark-variant compilation: `grep -o '.\{80\}prefers-color-scheme:dark.\{200\}' dist/assets/index-BVF8byrj.css | head -2` (dist is stale but demonstrative; rebuild with `npm run build:frontend`).
- Find all dark: users: `grep -rl 'dark:' src --include='*.tsx'` (31 files).
- Find hsl-wrapped tokens: `grep -rn 'hsl(var(--' src --include='*.css'`.
- Existing screenshot for baseline: `loggedin-calendar.png` (repo root, untracked).
