/**
 * Task Analytics Summary Component
 * Displays a compact analytics card with donut chart and textual stats
 */

import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useAllTasks } from '@/hooks/useTasks';
import { useTaskStats } from '@/hooks/useTaskStats';
import { useUIStore } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: ChartData;
  }>;
}

/**
 * Custom tooltip for the donut chart
 */
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0];
  const total = payload.reduce((sum, item) => sum + item.value, 0);
  const percentage = total > 0 ? Math.round((data.value / total) * 100) : 0;

  return (
    <div className="rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{data.name}</p>
      <p className="text-muted-foreground">
        {data.value} task{data.value !== 1 ? 's' : ''} ({percentage}%)
      </p>
    </div>
  );
};

/**
 * TaskAnalyticsSummary component for the sidebar
 */
function TaskAnalyticsSummaryComponent() {
  const { data: tasks = [], isLoading } = useAllTasks();
  const { selectedKanbanTaskListId, taskViewMode } = useUIStore();
  const { taskGroups, activeTaskGroupId } = useTaskManagement({ includeTaskOperations: false });

  // Determine the scope for analytics based on current view mode
  const scopedListId = useMemo(() => {
    // Only use Kanban list selection if we're actually in Kanban mode
    if (taskViewMode === 'kanban' && selectedKanbanTaskListId) {
      return selectedKanbanTaskListId;
    }
    // Otherwise fall back to active task group (but filter out 'all' and 'default')
    if (activeTaskGroupId && activeTaskGroupId !== 'all' && activeTaskGroupId !== 'default') {
      return activeTaskGroupId;
    }
    // Show all tasks
    return null;
  }, [taskViewMode, selectedKanbanTaskListId, activeTaskGroupId]);
  
  // Compute statistics
  const stats = useTaskStats(tasks, { taskListId: scopedListId });
  
  // Determine context label
  const contextLabel = useMemo(() => {
    if (!scopedListId) {
      return 'All Tasks';
    }
    
    // Find the task group name
    const taskGroup = taskGroups.find(g => g.id === scopedListId);
    if (taskGroup) {
      return taskGroup.name;
    }
    
    // Fallback for cases where the list might not be loaded yet
    if (scopedListId === 'default') {
      return 'Tasks';
    }
    
    return 'Selected List';
  }, [scopedListId, taskGroups]);

  // Prepare chart data with theme-aware colors
  const chartData: ChartData[] = useMemo(() => [
    {
      name: 'Done',
      value: stats.done,
      color: '#16a34a', // Success green (works in both themes)
    },
    {
      name: 'In Progress',
      value: stats.inProgress,
      color: '#3b82f6', // Primary blue (works in both themes)
    },
    {
      name: 'Not Started',
      value: stats.notStarted,
      color: '#64748b', // Muted gray (works in both themes)
    },
  ].filter(item => item.value > 0), [stats.done, stats.inProgress, stats.notStarted]); // Only show non-zero segments

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
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm mb-1">{contextLabel}</div>
            <div className="text-sm text-muted-foreground">No tasks yet</div>
            <div className="text-xs text-muted-foreground mt-0.5">
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
    <section
      role="region"
      aria-label="Task analytics summary"
      aria-describedby="analytics-description"
      className="group rounded-md border bg-card text-card-foreground px-3 py-2 hover:bg-accent/40 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer hover:shadow-sm"
      tabIndex={0}
      onClick={() => {
        // TODO: Wire to analytics dialog in future requirement
        console.log('Open detailed analytics');
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
                content={<CustomTooltip />}
                wrapperStyle={{ outline: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Textual Stats */}
        <div className="flex-1 min-w-0">
          {/* Context label */}
          <div className="font-medium text-sm mb-1 truncate">
            {contextLabel}
          </div>
          
          {/* Main KPI line with progress bar */}
          <div className="relative mb-2">
            <div className="text-sm font-medium">
              {stats.completed} / {stats.total} completed
            </div>
            {/* Inline progress bar background */}
            <div className="mt-1 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300 rounded-full"
                style={{ 
                  width: `${stats.completionPct}%`,
                  backgroundColor: '#16a34a' // Success green to match chart
                }}
              />
            </div>
          </div>
          
          {/* Breakdown row */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {stats.notStarted > 0 && (
              <>
                <span>NS {stats.notStarted}</span>
                {(stats.inProgress > 0 || stats.done > 0) && <span>·</span>}
              </>
            )}
            {stats.inProgress > 0 && (
              <>
                <span>IP {stats.inProgress}</span>
                {stats.done > 0 && <span>·</span>}
              </>
            )}
            {stats.done > 0 && (
              <span>D {stats.done}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden description for accessibility */}
      <div id="analytics-description" className="sr-only">
        Task analytics for {contextLabel}: {stats.completed} of {stats.total} tasks completed ({stats.completionPct}% completion rate). 
        Breakdown: {stats.notStarted} not started, {stats.inProgress} in progress, {stats.done} done.
      </div>
    </section>
  );
}

/**
 * Memoized TaskAnalyticsSummary component to prevent unnecessary re-renders
 */
export const TaskAnalyticsSummary = React.memo(TaskAnalyticsSummaryComponent);