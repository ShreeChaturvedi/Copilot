/**
 * Task Analytics Dialog Component
 * Premium analytics dashboard with creative, cohesive design
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  PieChart as PieChartIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import { IntegratedActionBar } from './IntegratedActionBar';
import { useUIStore } from '@/stores/uiStore';
import { useAllTasks } from '@/hooks/useTasks';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import {
  GroupBy,
  RangePreset,
  RangePresetValue,
  computeStatusCounts,
  getOverdueCount,
  getWeeklyStatusBreakdown,
  getDateRange,
  bucketize,
} from '@/utils/analytics';
import {
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import type { Task } from '@shared/types';

// Chart colors - vibrant and visible in both themes
const COLORS = {
  done: '#10b981', // Emerald green
  inProgress: '#f59e0b', // Amber
  notStarted: '#6b7280', // Gray
  created: '#3b82f6', // Blue
  overdue: '#ef4444', // Red
};

interface TaskAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultScope?: string | null;
}

/**
 * Custom tooltip with proper dark mode styling
 */
type ChartTooltipEntry = {
  color?: string;
  name?: string;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
};

const ChartTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

/**
 * Circular Progress Ring - Creative stat display
 */
function StatRing({
  value,
  total,
  label,
  color,
  icon: Icon,
}: {
  value: number;
  total: number;
  label: string;
  color: string;
  icon: React.ElementType;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const circumference = 2 * Math.PI * 28; // radius 28
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        {/* Background ring */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/30"
          />
          <circle
            cx="40"
            cy="40"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center content - just the number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{value}</span>
        </div>
      </div>
      {/* Label with icon beside it */}
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Status Distribution - Horizontal bar visualization
 */
function StatusBar({
  tasks,
  listId,
}: {
  tasks: Task[];
  listId?: string | null;
}) {
  const statusCounts = useMemo(
    () => computeStatusCounts(tasks, listId),
    [tasks, listId]
  );
  const total =
    statusCounts.done + statusCounts.inProgress + statusCounts.notStarted;

  if (total === 0) return null;

  const segments = [
    {
      name: 'Done',
      value: statusCounts.done,
      color: COLORS.done,
      percent: ((statusCounts.done / total) * 100).toFixed(0),
    },
    {
      name: 'In Progress',
      value: statusCounts.inProgress,
      color: COLORS.inProgress,
      percent: ((statusCounts.inProgress / total) * 100).toFixed(0),
    },
    {
      name: 'Not Started',
      value: statusCounts.notStarted,
      color: COLORS.notStarted,
      percent: ((statusCounts.notStarted / total) * 100).toFixed(0),
    },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-muted/30">
        {segments.map((seg) => (
          <div
            key={seg.name}
            className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${seg.percent}%`,
              backgroundColor: seg.color,
              opacity: seg.name === 'Not Started' ? 0.6 : 1,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: seg.color,
                opacity: seg.name === 'Not Started' ? 0.6 : 1,
              }}
            />
            <span className="text-xs">
              <span className="font-medium">{seg.value}</span>
              <span className="text-muted-foreground ml-1">{seg.name}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Weekly Activity Heatmap - Enhanced with status colors
 * Shows green (completed), yellow (in-progress), red (overdue) per day
 */
function WeeklyHeatmap({
  tasks,
  listId,
}: {
  tasks: Task[];
  listId?: string | null;
}) {
  const weeklyData = useMemo(() => {
    return getWeeklyStatusBreakdown(tasks, listId);
  }, [tasks, listId]);

  const totalCompleted = weeklyData.reduce((sum, d) => sum + d.completed, 0);
  const totalInProgress = weeklyData.reduce((sum, d) => sum + d.inProgress, 0);
  const totalOverdue = weeklyData.reduce((sum, d) => sum + d.overdue, 0);
  const totalActivity = totalCompleted + totalInProgress + totalOverdue;

  return (
    <div className="rounded-lg border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium">This Week</span>
        <div className="flex items-center gap-2">
          {totalCompleted > 0 && (
            <span className="text-sm font-bold" style={{ color: COLORS.done }}>
              {totalCompleted}
            </span>
          )}
          {totalInProgress > 0 && (
            <span
              className="text-sm font-bold"
              style={{ color: COLORS.inProgress }}
            >
              {totalInProgress}
            </span>
          )}
          {totalOverdue > 0 && (
            <span
              className="text-sm font-bold"
              style={{ color: COLORS.overdue }}
            >
              {totalOverdue}
            </span>
          )}
          {totalActivity === 0 && (
            <span className="text-2xl font-bold text-muted-foreground">0</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weeklyData.map((day) => {
          const total = day.completed + day.inProgress + day.overdue;
          const hasActivity = total > 0;

          // Calculate proportions for stacked bar
          const completedPct = total > 0 ? (day.completed / total) * 100 : 0;
          const inProgressPct = total > 0 ? (day.inProgress / total) * 100 : 0;
          const overduePct = total > 0 ? (day.overdue / total) * 100 : 0;

          return (
            <div key={day.day} className="flex flex-col items-center gap-1">
              <div
                className="w-full aspect-square rounded-md transition-all duration-300 hover:scale-110 overflow-hidden flex flex-col justify-end"
                style={{
                  backgroundColor: hasActivity ? 'transparent' : 'var(--muted)',
                }}
                title={`${day.day}: ${day.completed} completed, ${day.inProgress} in progress, ${day.overdue} overdue`}
              >
                {hasActivity && (
                  <div className="w-full h-full flex flex-col">
                    {/* Overdue (red) - at top */}
                    {overduePct > 0 && (
                      <div
                        className="w-full"
                        style={{
                          height: `${overduePct}%`,
                          backgroundColor: COLORS.overdue,
                        }}
                      />
                    )}
                    {/* In Progress (yellow) - middle */}
                    {inProgressPct > 0 && (
                      <div
                        className="w-full"
                        style={{
                          height: `${inProgressPct}%`,
                          backgroundColor: COLORS.inProgress,
                        }}
                      />
                    )}
                    {/* Completed (green) - at bottom */}
                    {completedPct > 0 && (
                      <div
                        className="w-full"
                        style={{
                          height: `${completedPct}%`,
                          backgroundColor: COLORS.done,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {day.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Trends Chart with proper axis lines and styling
 */
function TrendsChart({
  tasks,
  listId,
  groupBy,
  rangePreset,
  includeCompleted,
}: {
  tasks: Task[];
  listId?: string | null;
  groupBy: GroupBy;
  rangePreset: RangePreset;
  includeCompleted: boolean;
}) {
  const [chartMode, setChartMode] = useState<'bars' | 'areas'>('areas');

  const trendsData = useMemo(() => {
    const { start, end } = getDateRange(rangePreset);
    const result = bucketize(
      tasks,
      groupBy,
      { start, end },
      { includeCompleted, listId }
    );
    // bucketize returns BucketingResult with .buckets array
    return result.buckets.map((bucket) => ({
      ...bucket,
      displayKey: bucket.key,
    }));
  }, [tasks, groupBy, rangePreset, includeCompleted, listId]);

  // Only show empty state if there are literally no buckets generated
  const isEmpty = !Array.isArray(trendsData) || trendsData.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-lg border bg-card/50 p-6">
        <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No data in selected range</p>
          <p className="text-xs mt-1 opacity-70">
            Try adjusting the time range
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium">Task Activity</span>
        <ViewSwitcher
          value={chartMode}
          onChange={setChartMode}
          options={[
            { value: 'areas', label: 'Area' },
            { value: 'bars', label: 'Bars' },
          ]}
        />
      </div>

      <div className="h-[200px] text-muted-foreground">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'bars' ? (
            <BarChart data={trendsData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                opacity={0.1}
              />
              <XAxis
                dataKey="displayKey"
                tick={{ fill: 'currentColor', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
              />
              <YAxis
                width={25}
                tick={{ fill: 'currentColor', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                domain={[0, 'dataMax + 1']}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'currentColor', fillOpacity: 0.1 }}
              />
              <Bar
                dataKey="created"
                fill={COLORS.created}
                name="Created"
                radius={[3, 3, 0, 0]}
              />
              {includeCompleted && (
                <Bar
                  dataKey="completed"
                  fill={COLORS.done}
                  name="Completed"
                  radius={[3, 3, 0, 0]}
                />
              )}
            </BarChart>
          ) : (
            <AreaChart data={trendsData}>
              <defs>
                <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={COLORS.created}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={COLORS.created}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.done} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.done} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                opacity={0.1}
              />
              <XAxis
                dataKey="displayKey"
                tick={{ fill: 'currentColor', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
              />
              <YAxis
                width={25}
                tick={{ fill: 'currentColor', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                domain={[0, 'dataMax + 1']}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke={COLORS.created}
                strokeWidth={2}
                fill="url(#createdGrad)"
                name="Created"
              />
              {includeCompleted && (
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke={COLORS.done}
                  strokeWidth={2}
                  fill="url(#completedGrad)"
                  name="Completed"
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Main Analytics Content
 */
function TaskAnalyticsDialogContent({
  actions,
  defaultScope,
}: {
  actions?: React.ReactNode;
  defaultScope?: string | null;
}) {
  const { data: tasks = [] } = useAllTasks();
  const { taskGroups } = useTaskManagement({ includeTaskOperations: false });

  const [activeTab, setActiveTab] = useState<'overview' | 'trends'>('overview');
  const [rangePreset, setRangePreset] = useState<RangePresetValue>('30d');
  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.Day);
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [listId] = useState<string | null>(defaultScope || null);

  // Compute analytics data
  const analyticsData = useMemo(() => {
    const statusCounts = computeStatusCounts(tasks, listId);
    return {
      total:
        statusCounts.done + statusCounts.inProgress + statusCounts.notStarted,
      completed: statusCounts.done,
      pending: statusCounts.inProgress + statusCounts.notStarted,
      overdue: getOverdueCount(tasks, listId),
      done: statusCounts.done,
      inProgress: statusCounts.inProgress,
      notStarted: statusCounts.notStarted,
    };
  }, [tasks, listId]);

  const contextLabel = useMemo(() => {
    if (!listId) return 'All Tasks';
    if (listId === 'default') return 'Default List';
    const group = taskGroups.find((g) => g.id === listId);
    return group ? `${group.emoji || '📋'} ${group.name}` : 'Selected List';
  }, [listId, taskGroups]);

  const timeRangeOptions = [
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' },
    { value: 'ytd', label: 'YTD' },
  ];

  const groupingOptions = [
    { value: GroupBy.Day, label: 'D' },
    { value: GroupBy.Week, label: 'W' },
    { value: GroupBy.Month, label: 'M' },
  ];

  return (
    <>
      {/* Header with context and tab switcher */}
      <div className="flex items-center gap-2 mb-4 flex-nowrap min-w-0">
        <PieChartIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <h2 className="text-lg font-semibold whitespace-nowrap">
          Task Analytics
        </h2>
        {listId && (
          <span className="text-sm text-muted-foreground truncate">
            • {contextLabel}
          </span>
        )}
        {/* Tab Switcher moved to header */}
        <ViewSwitcher
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'overview' | 'trends')}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'trends', label: 'Trends' },
          ]}
        />
        {actions && <div className="ml-auto flex-shrink-0">{actions}</div>}
      </div>

      {/* Trends-only Toolbar - only shown when Trends tab active */}
      {activeTab === 'trends' && (
        <div className="flex items-center gap-2 pb-4 border-b">
          <ViewSwitcher
            value={rangePreset}
            onChange={(v) => setRangePreset(v as RangePresetValue)}
            options={timeRangeOptions}
          />

          <ViewSwitcher
            value={groupBy}
            onChange={(v) => setGroupBy(v as GroupBy)}
            options={groupingOptions}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIncludeCompleted(!includeCompleted)}
            className={cn(
              // Base styling - consistent with TaskControls
              'h-7 w-7 p-0',
              // Conditional state styling
              includeCompleted
                ? [
                    // On state - calendar green with visible border and transparency
                    'bg-[oklch(0.7_0.15_140_/_0.15)] text-foreground border border-[oklch(0.7_0.15_140)]',
                    // Dark mode adjustments
                    'dark:bg-[oklch(0.7_0.15_140_/_0.1)] dark:border-[oklch(0.7_0.15_140)]',
                    // Hover states for on state
                    'hover:bg-[oklch(0.7_0.15_140_/_0.2)] dark:hover:bg-[oklch(0.7_0.15_140_/_0.15)]',
                  ]
                : [
                    // Off state - default ghost button styling
                    'text-muted-foreground hover:text-foreground border border-transparent',
                    'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
                  ]
            )}
            title={
              includeCompleted ? 'Hide completed tasks' : 'Show completed tasks'
            }
          >
            <Check className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="mt-3">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stat Rings Row */}
            <div className="flex justify-center gap-8 pb-6 border-b">
              <StatRing
                value={analyticsData.completed}
                total={analyticsData.total}
                label="Completed"
                color={COLORS.done}
                icon={CheckCircle2}
              />
              <StatRing
                value={analyticsData.inProgress}
                total={analyticsData.total}
                label="In Progress"
                color={COLORS.inProgress}
                icon={Clock}
              />
              <StatRing
                value={analyticsData.overdue}
                total={analyticsData.total}
                label="Overdue"
                color={COLORS.overdue}
                icon={AlertCircle}
              />
            </div>

            {/* Status distribution bar */}
            <StatusBar tasks={tasks} listId={listId} />

            {/* Weekly heatmap */}
            <WeeklyHeatmap tasks={tasks} listId={listId} />
          </div>
        )}

        {activeTab === 'trends' && (
          <TrendsChart
            tasks={tasks}
            listId={listId}
            groupBy={groupBy}
            rangePreset={rangePreset}
            includeCompleted={includeCompleted}
          />
        )}
      </div>
    </>
  );
}

/**
 * TaskAnalyticsDialog component
 */
export function TaskAnalyticsDialog({
  open,
  onOpenChange,
  defaultScope,
}: TaskAnalyticsDialogProps) {
  const { peekMode, setPeekMode } = useUIStore();
  const isPeekRight = peekMode === 'right';

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const togglePeekMode = useCallback(() => {
    setPeekMode(isPeekRight ? 'center' : 'right');
  }, [isPeekRight, setPeekMode]);

  const actionButtons = (
    <IntegratedActionBar
      peekMode={peekMode}
      onPeekModeToggle={togglePeekMode}
      onClose={handleClose}
    />
  );

  // Render both Sheet and Dialog, but only one is open at a time
  // This prevents the flicker caused by unmounting one before mounting the other
  return (
    <>
      {/* Sheet (right panel) - only open when open=true AND peekMode=true */}
      <Sheet open={open && isPeekRight} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl p-6 overflow-y-auto [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Task Analytics</SheetTitle>
            <SheetDescription>
              View your task statistics and trends
            </SheetDescription>
          </SheetHeader>
          <TaskAnalyticsDialogContent
            actions={actionButtons}
            defaultScope={defaultScope}
          />
        </SheetContent>
      </Sheet>

      {/* Dialog (center modal) - only open when open=true AND peekMode=false */}
      <Dialog open={open && !isPeekRight} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Task Analytics</DialogTitle>
          <DialogDescription className="sr-only">
            View your task statistics and trends
          </DialogDescription>
          <TaskAnalyticsDialogContent
            actions={actionButtons}
            defaultScope={defaultScope}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
