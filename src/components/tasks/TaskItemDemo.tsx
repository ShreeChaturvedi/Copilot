/**
 * Demo component to test TaskItem with tooltip functionality
 */

import React from 'react';
import { TaskItem } from './TaskItem';
import type { Task } from "@shared/types";
import { TooltipProvider } from '@/components/ui/tooltip';

const demoTask: Task = {
  id: 'demo-task',
  title: 'Demo Task with AutoScheduling',
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: 'demo-user',
};

export const TaskItemDemo: React.FC = () => {
  const handleToggle = (id: string) => {
    console.log('Toggle task:', id);
  };

  const handleEdit = (id: string, newTitle: string) => {
    console.log('Edit task:', id, newTitle);
  };

  const handleDelete = (id: string) => {
    console.log('Delete task:', id);
  };

  const handleSchedule = (id: string) => {
    console.log('Schedule task:', id);
  };

  return (
    <TooltipProvider>
      <div className="p-4 max-w-md">
        <h3 className="text-lg font-semibold mb-4">TaskItem with Tooltip Demo</h3>
        <TaskItem
          task={demoTask}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSchedule={handleSchedule}
        />
        <p className="text-sm text-muted-foreground mt-4">
          Hover over the task to see the three dots menu, then hover over the info icon (ⓘ) next to "Schedule" to see the tooltip.
        </p>
      </div>
    </TooltipProvider>
  );
};