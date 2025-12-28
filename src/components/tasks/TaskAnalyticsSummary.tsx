/**
 * Task Analytics Summary Component
 * Displays a compact analytics card with donut chart and textual stats
 */

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Circle, PlayCircle, Flag } from 'lucide-react';
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

// (removed unused local CustomTooltip in favor of portal-based tooltip)

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
  const color = String(data.color ?? '#999');
  const percent = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-2.5 py-2 text-xs pointer-events-none z-50">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: color }}
        />
        <span className="font-medium">{name}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-muted-foreground">
        <span>
          Count: <span className="text-foreground font-medium">{value}</span>
        </span>
        <span className="opacity-40">|</span>
        <span>
          Percent:{' '}
          <span className="text-foreground font-medium">
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

  // Use actual hex colors - CSS variables don't work in Recharts SVG elements
  const chartData: ChartData[] = useMemo(
    () =>
      [
        { name: 'Done', value: stats.done, color: '#10b981' },
        { name: 'In Progress', value: stats.inProgress, color: '#f59e0b' },
        { name: 'Not Started', value: stats.notStarted, color: '#6b7280' },
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
        className="rounded-md border bg-card text-card-foreground px-3 py-2"
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

  // Handle empty state
  if (stats.total === 0) {
    return (
      <section
        role="region"
        aria-label="Task analytics summary"
        aria-describedby="analytics-empty-description"
        className="group rounded-md border bg-card text-card-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
        tabIndex={0}
      >
        <div className="flex items-center gap-3">
          {/* Empty ring chart placeholder */}
          <div className="w-[60px] h-[60px] flex-shrink-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-muted-foreground/30" />
          </div>

          {/* Empty state text */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-semibold text-base text-foreground">
              {contextLabel}
            </div>
            <div className="text-sm text-muted-foreground">No tasks yet</div>
            <div className="text-xs text-muted-foreground">
              Create tasks to see analytics
            </div>
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
        className="group rounded-md border bg-card text-card-foreground px-3 py-2 hover:bg-accent/40 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer hover:shadow-sm"
        tabIndex={0}
        onClick={() => {
          setAnalyticsDialogOpen(true);
        }}
      >
        <div className="flex items-center gap-3">
          {/* Left: Donut Chart */}
          <div className="w-[60px] h-[60px] flex-shrink-0">
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
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      fillOpacity={entry.name === 'Not Started' ? 0.7 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomPieTooltip total={totalCount} />}
                  cursor={{ fill: 'transparent' }}
                  wrapperStyle={{ zIndex: 9999 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Right: Textual Stats */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Context label - more prominent */}
            <div className="font-semibold text-base truncate text-foreground">
              {contextLabel}
            </div>

            {/* Progress section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {stats.completed} / {stats.total} completed
                </span>
                <span className="text-xs font-medium text-emerald-600">
                  {stats.completionPct}%
                </span>
              </div>
              {/* Progress bar - thin with gradient matching TopProgressBar */}
              <div
                className="relative h-[2px] w-full rounded-full bg-border/60 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 rounded-full"
                  style={{
                    width: `${stats.completionPct}%`,
                    background:
                      'linear-gradient(90deg in oklch, oklch(92% 0.26 145) 0%, oklch(60% 0.18 155) 100%)',
                  }}
                />
              </div>
            </div>

            {/* Breakdown row with status icons */}
            <div className="flex items-center gap-2 text-xs">
              {stats.notStarted > 0 && (
                <div
                  className="flex items-center gap-1 text-muted-foreground"
                  title={`Not Started: ${stats.notStarted} tasks`}
                >
                  <Circle className="w-3 h-3" />
                  <span>{stats.notStarted}</span>
                </div>
              )}
              {stats.inProgress > 0 && (
                <div
                  className="flex items-center gap-1 text-amber-500"
                  title={`In Progress: ${stats.inProgress} tasks`}
                >
                  <PlayCircle className="w-3 h-3" />
                  <span>{stats.inProgress}</span>
                </div>
              )}
              {stats.done > 0 && (
                <div
                  className="flex items-center gap-1 text-emerald-600"
                  title={`Done: ${stats.done} tasks`}
                >
                  <Flag className="w-3 h-3" />
                  <span>{stats.done}</span>
                </div>
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
