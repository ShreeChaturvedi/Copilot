/**
 * Task Analytics Summary Component
 * Displays a compact analytics card with donut chart and textual stats
 */

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Circle, PlayCircle, CheckCircle2 } from 'lucide-react';
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ANALYTICS_STATUS_COLORS } from '@/constants/analyticsColors';
import { useAllTasks } from '@/hooks/useTasks';
import { useTaskStats } from '@/hooks/useTaskStats';
import { useUIStore } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { TaskAnalyticsDialog } from '@/components/dialogs/TaskAnalyticsDialog';

interface ChartData {
  name: string;
  value: number;
  color: string;
}

/**
 * Custom tooltip component for the pie chart
 */
function CustomPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartData }>;
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const name = String(data.name ?? '');
  const value = Number(data.value ?? 0);
  const color = String(data.color ?? 'var(--faint)');
  const percent = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-md border border-hairline bg-popover text-popover-foreground [box-shadow:var(--shadow-popover)] px-2.5 py-2 text-xs pointer-events-none z-50">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: color }}
        />
        <span className="font-medium">{name}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-muted-foreground">
        <span>
          Count:{' '}
          <span className="text-foreground font-medium tabular-nums">
            {value}
          </span>
        </span>
        <span className="opacity-40">|</span>
        <span>
          Percent:{' '}
          <span className="text-foreground font-medium tabular-nums">
            {percent.toFixed(1)}%
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * TaskAnalyticsSummary component for the sidebar
 */
function TaskAnalyticsSummaryComponent() {
  const { data: tasks = [], isLoading } = useAllTasks();
  const { selectedKanbanTaskListId, taskViewMode } = useUIStore();
  const { taskGroups, activeTaskGroupId } = useTaskManagement({
    includeTaskOperations: false,
  });
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);

  // Determine the scope for analytics based on current view mode
  const scopedListId = useMemo(() => {
    const isKanban = taskViewMode === 'kanban';
    if (!isKanban) return null; // Non-kanban must aggregate all tasks
    return selectedKanbanTaskListId ?? activeTaskGroupId ?? null;
  }, [taskViewMode, selectedKanbanTaskListId, activeTaskGroupId]);

  // Compute statistics
  const stats = useTaskStats(tasks, { taskListId: scopedListId });

  // Determine context label
  const contextLabel = useMemo(() => {
    if (!scopedListId) {
      return 'All Tasks';
    }

    // Find the task group name
    const taskGroup = taskGroups.find((g) => g.id === scopedListId);
    if (taskGroup) {
      return taskGroup.name;
    }

    // Fallback for cases where the list might not be loaded yet
    if (scopedListId === 'default') {
      return 'Tasks';
    }

    return 'Selected List';
  }, [scopedListId, taskGroups]);

  // Shared analytics palette (design-brief §2.2/2.3): done = aqua (success),
  // in progress = warning amber, not started = faint. These are the same
  // `var(--token)` strings TaskAnalyticsDialog.tsx already proves resolve
  // correctly inside Recharts SVG fill/stroke props, so both themes stay in
  // sync with zero JS branching — no resolvedTheme subscription needed.
  const chartData: ChartData[] = useMemo(
    () =>
      [
        {
          name: 'Done',
          value: stats.done,
          color: ANALYTICS_STATUS_COLORS.done,
        },
        {
          name: 'In progress',
          value: stats.inProgress,
          color: ANALYTICS_STATUS_COLORS.inProgress,
        },
        {
          name: 'Not started',
          value: stats.notStarted,
          color: ANALYTICS_STATUS_COLORS.notStarted,
        },
      ].filter((item) => item.value > 0),
    [stats.done, stats.inProgress, stats.notStarted]
  );

  const totalCount = stats.done + stats.inProgress + stats.notStarted;

  // Handle loading state
  if (isLoading) {
    return (
      <section
        role="region"
        aria-label="Task analytics summary"
        className="rounded-card border bg-card text-card-foreground px-3 py-2"
      >
        <div className="flex items-center gap-3">
          <div className="w-[60px] h-[60px] flex-shrink-0 animate-pulse bg-muted rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
          </div>
        </div>
      </section>
    );
  }

  // Handle empty state — etched donut + Sentient voice line (design-brief §4,
  // one of the six plain-text empty states this redesign closes).
  if (stats.total === 0) {
    return (
      <section
        role="region"
        aria-label="Task analytics summary"
        aria-describedby="analytics-empty-description"
        className="rounded-card border bg-card text-card-foreground px-3 py-2"
      >
        <div className="flex items-center gap-3">
          {/* Etched ring — same 60px footprint/ring geometry as the live
              donut (innerRadius 18 / outerRadius 28 → center ~23, thickness
              ~9), so the moment a task exists the literal shape resolves
              into the real chart (the same etch-resolves-to-real device
              ScheduleEmptyArt uses for its dashed rows → aqua check). */}
          <div className="w-[60px] h-[60px] flex-shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 60 60"
              width="60"
              height="60"
              role="img"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                cx="30"
                cy="30"
                r="23"
                fill="none"
                stroke="var(--etch-strong)"
                strokeWidth="9"
                strokeDasharray="3 4"
              />
            </svg>
          </div>

          {/* Empty state text */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-semibold text-base text-foreground truncate">
              {contextLabel}
            </div>
            <p className="font-serif text-base leading-[1.3] text-ink">
              Nothing to chart yet.
            </p>
            <p className="text-xs leading-[18px] text-ink-muted">
              Create a task to see it here.
            </p>
          </div>
        </div>

        {/* Hidden description for accessibility */}
        <div id="analytics-empty-description" className="sr-only">
          No tasks available for analytics in {contextLabel}
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        role="region"
        aria-label="Task analytics summary"
        aria-describedby="analytics-description"
        className="rounded-card border bg-card text-card-foreground px-3 py-2 hover:bg-surface-hover transition-colors duration-[var(--dur-3)] outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 cursor-pointer"
        tabIndex={0}
        onClick={() => {
          setAnalyticsDialogOpen(true);
        }}
      >
        <div className="flex items-center gap-3">
          {/* Left: Donut Chart, with the completion % as its center payoff
              (design-brief §2.1 stat-tile pairing: the number is the loudest
              element, plain Inter/mono-numeral, never rendered inside the
              chart's own hue). */}
          <div className="relative w-[60px] h-[60px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={18}
                  outerRadius={28}
                  paddingAngle={1}
                  stroke="none"
                  isAnimationActive
                  animationDuration={240}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      fillOpacity={entry.name === 'Not started' ? 0.7 : 1}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={<CustomPieTooltip total={totalCount} />}
                  cursor={{ fill: 'transparent' }}
                  wrapperStyle={{ zIndex: 9999 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[13px] font-semibold text-ink tabular-nums">
                {stats.completionPct}%
              </span>
            </div>
          </div>

          {/* Right: Textual Stats */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Context label - more prominent */}
            <div className="font-semibold text-base truncate text-foreground">
              {contextLabel}
            </div>

            {/* Progress section */}
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {stats.completed} / {stats.total}
                </span>{' '}
                completed
              </span>
              {/* Progress bar - thin, aqua = done (design-brief 2.3) */}
              <div
                className="relative h-[2px] w-full rounded-full bg-border/60 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 rounded-full bg-aqua"
                  style={{ width: `${stats.completionPct}%` }}
                />
              </div>
            </div>

            {/* Breakdown row with status icons — themed Tooltip instead of
                the native title= attribute (design-brief Craft). */}
            <div className="flex items-center gap-2 text-xs">
              {stats.notStarted > 0 && (
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Circle className="w-3 h-3" />
                      <span className="font-mono tabular-nums">
                        {stats.notStarted}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Not started: {stats.notStarted} tasks
                  </TooltipContent>
                </UiTooltip>
              )}
              {stats.inProgress > 0 && (
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-warning">
                      <PlayCircle className="w-3 h-3" />
                      <span className="font-mono tabular-nums">
                        {stats.inProgress}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    In progress: {stats.inProgress} tasks
                  </TooltipContent>
                </UiTooltip>
              )}
              {stats.done > 0 && (
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="font-mono tabular-nums">
                        {stats.done}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Done: {stats.done} tasks</TooltipContent>
                </UiTooltip>
              )}
            </div>
          </div>
        </div>

        {/* Hidden description for accessibility */}
        <div id="analytics-description" className="sr-only">
          Task analytics for {contextLabel}: {stats.completed} of {stats.total}{' '}
          tasks completed ({stats.completionPct}% completion rate). Breakdown:{' '}
          {stats.notStarted} not started, {stats.inProgress} in progress,{' '}
          {stats.done} done.
        </div>
      </section>

      {/* Task Analytics Dialog */}
      <TaskAnalyticsDialog
        open={analyticsDialogOpen}
        onOpenChange={setAnalyticsDialogOpen}
        defaultScope={scopedListId}
      />
    </>
  );
}

/**
 * Memoized TaskAnalyticsSummary component to prevent unnecessary re-renders
 */
export const TaskAnalyticsSummary = React.memo(TaskAnalyticsSummaryComponent);
