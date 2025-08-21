GPT-5 Project Manager: 

### Objective
- Implement a polished Task Analytics system.
- Part A now: compact analytics summary in the left sidebar footer (task view first).
- Part B next: comprehensive analytics dashboard with dialog/sheet toggle.

### Context & Constraints
- Sidebar composition flows through `BaseSidebarPane` → used by `LeftPane` (task/calendar views). Lists render in the footer via `footerListContent`.
- We will inject the summary above the lists for task view only (calendar view to follow later).
- `useTasks()`/`useAllTasks()` fetch all tasks, enabling client-side summary computations. Kanban scope derives from `useUIStore().selectedKanbanTaskListId ?? activeTaskGroupId` (see `TaskKanbanBoard`).
- Settings live in `useSettingsStore` and surface in `SettingsDialog` sections. Add a persisted toggle to control the summary visibility.
- For charts, use shadcn charts built on Recharts. Add `recharts` dependency. Follow shadcn examples for a minimal pie/donut chart.
- References: [Pie charts – shadcn/ui](https://ui.shadcn.com/charts/pie#charts), [Charts overview – shadcn/ui](https://ui.shadcn.com/charts/), [Recharts API](https://recharts.org/en-US/api).

### Part A – Sidebar Analytics Summary (Task View)
**UX spec**
- Placement: Above Task Lists, inside the sidebar footer group. Task view only for this phase.
- Visibility: Controlled by a new setting, default on. Toggle in Preferences (or General) settings.
- Content: Label “All Tasks” or current Kanban list name; “x / y completed”; breakdown of Not Started, In Progress, Done.
- Chart: Compact donut/pie on the left (~25–33% width), right-side stacked textual stats. Hover/focus highlights slice; tooltip shows count and percent.
- Interactions: Entire card clickable to open Detailed Analytics (Part B). Keyboard-focusable with visible focus ring. Smooth opacity/scale animations on hover (match app’s collapsible opacity transitions).
- Theming: Dark/light aware; colors from theme tokens; slice colors map semantically (NS-muted, IP-primary, Done-emerald). Ensure contrast.
- Performance: No extra API calls. Compute locally from cached tasks. Use `ResponsiveContainer`.
- Empty/edge: If no tasks, show a subtle placeholder encouraging task creation.

**Data model & computation**
- Source: `useAllTasks()` (same query as `useTasks()`). Scope by:
  - “All Tasks” (default): all fetched tasks.
  - Kanban context: constrain to `selectedKanbanTaskListId ?? activeTaskGroupId`.
- Status resolution: prefer `(task as any).status` from backend (`NOT_STARTED|IN_PROGRESS|DONE`). Fallback: if `completed===true` → `DONE`, else `NOT_STARTED`. Keep mapping ready to support `IN_PROGRESS` when present.
- Output: counts for { notStarted, inProgress, done }, totals, completion ratio, percentage breakdown.

**Integration points**
- Sidebar: `src/components/layout/LeftPane.tsx` builds `footerListContent`. Render `TaskAnalyticsSummary` above `TaskGroupList` for task view when the setting is enabled. Calendar view footer remains unchanged.
- Settings store: `src/stores/settingsStore.ts` add `showSidebarTaskAnalytics: boolean` + setter; persist via `partialize`.
- Settings UI: Add a toggle in `PreferencesSettings` (or `GeneralSettings`) for “Show sidebar analytics summary”.

**Accessibility**
- Chart slices keyboard focusable; tooltip content announced via `aria-live=polite`. Provide `aria-label` and `aria-describedby` on the summary container. Maintain 4.5:1 text contrast.

### Part B – Detailed Analytics Dashboard (Blueprint)
**Design overview**
- Entry: Clicking summary opens an “Analytics” view with a sheet/dialog toggle, mirroring `EventDisplayDialog` (peekMode center/right) using `IntegratedActionBar`.
- Layout: Tabs for Overview, Trends, Lists, Priority, Tags, Attachments, Goals. Each tab hosts charts + KPI summaries.
- Visualizations (Recharts):
  - Throughput over time (line/area, daily/weekly toggles)
  - Creation vs completion flow (stacked bars)
  - Overdue trend (area)
  - Status distribution (donut)
  - Priority distribution (bar or pie)
  - List contribution (ranked bar)
  - Completion time/cycle time histogram
  - Streaks and goals widgets (radial progress, mini-cards)
- Filters: Time range (7d/30d/90d/custom), list filter, show completed toggle, group by (day/week/month).
- Backend: Later, extend `/api/tasks/stats` with optional params (`taskListId`, range, groupBy) for server-aggregated series. MVP can compute client-side; add API when scaling.

### Deliverables – Implementation Tasks
1) Settings toggle for sidebar analytics
- Add `showSidebarTaskAnalytics: boolean` (default true) + `setShowSidebarTaskAnalytics` to `useSettingsStore`; include in `partialize`.
- Add UI toggle in `PreferencesSettings` (or `GeneralSettings`) with `Switch` and `Label`.
- Acceptance: Toggle persists; no linter errors; strict types.
- Files: `src/stores/settingsStore.ts`, `src/components/settings/PreferencesSettings.tsx` (or `GeneralSettings.tsx`).

2) TaskAnalyticsSummary component
- New `src/components/tasks/TaskAnalyticsSummary.tsx`.
- Read tasks via `useAllTasks()`; scope via `useUIStore()` to Kanban list when applicable; use `useTaskManagement({ includeTaskOperations: false })` to resolve list name.
- Compute { notStarted, inProgress, done, total, completed, completionPct }.
- Render compact donut (~25–33% width) + textual stats; hover/focus highlights; tooltip shows name/count/percent.
- Click opens Detailed Analytics (wire to new dialog scaffold via prop or store).
- Acceptance: Responsive; smooth transitions; dark/light correct.

3) Integrate summary into LeftPane footer
- Update `LeftPane.tsx` to render summary above `TaskGroupList` for task view, gated by the new setting.
- Calendar view footer remains `CalendarList` only.
- Acceptance: Summary shows/hides instantly with toggle; layout spacing consistent with `SidebarGroup`.

4) Stats computation hook
- New `src/hooks/useTaskStats.ts` with memoized reducer to compute counts/percentages from a task array and optional scope.
- Prefer backend status when present; fallback to completed flag.
- Tests: `src/hooks/__tests__/useTaskStats.test.ts` for various cases (0 tasks; all done; mix with/without status).

5) Analytics dialog/sheet scaffold (Part B foundation)
- New `src/components/dialogs/TaskAnalyticsDialog.tsx` modeled after `EventDisplayDialog` using `Dialog`/`Sheet` and `IntegratedActionBar`.
- Tabs exist; at least one working chart (status distribution) wired to live data; open from summary click.
- Acceptance: Peek mode toggle works; keyboard accessible; no console errors.

6) Dependency, polish, and tests
- Add `recharts` to dependencies; verify Vite build.
- Unit tests for summary render (sample tasks) and hook; snapshot is acceptable.
- Verify a11y (aria, focus order) and dark mode; align opacity transitions with existing styles.

### Technical Notes & Guidance
- Follow existing import aliases (`@/`, `@shared/`).
- Keep code readable and strongly typed; prefer early returns; meaningful error handling.
- Avoid touching unrelated components. Integrate into `LeftPane` and settings cleanly.
- Prefer theme variables for colors; avoid hardcoded hex except for transparentized backgrounds.
- Memoize to avoid recomputation on every render; minimize re-renders in sidebar.

### Acceptance Summary (Part A)
- New persisted setting controls visibility.
- Task view shows a compact analytics summary above Task Lists; calendar view unchanged for now.
- Summary shows “All Tasks” or current Kanban list name, x/y completed, and a Not Started/In Progress/Done breakdown with a donut chart.
- Clicking the summary opens the Analytics dialog scaffold.
- Tests pass; linter clean.

### References
- Pie charts – shadcn/ui: https://ui.shadcn.com/charts/pie#charts
- Charts overview – shadcn/ui: https://ui.shadcn.com/charts/
- Recharts API: https://recharts.org/en-US/api

