import React, { useState } from 'react';
import { User, Settings, HelpCircle, LogOut } from 'lucide-react';
import { 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter,
  SidebarSeparator 
} from '@/components/ui/sidebar';
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle';
import { EventOverview } from '@/components/calendar/EventOverview';
import { CalendarList } from '@/components/calendar/CalendarList';
import { TaskGroupList, type TaskGroup } from '@/components/tasks/TaskGroupList';
import { useUIStore } from '@/stores/uiStore';
import { useCalendars } from '@/hooks/useCalendars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CalendarSummaryPaneProps {
  className?: string;
}

export const CalendarSummaryPane: React.FC<CalendarSummaryPaneProps> = ({
  className
}) => {
  const { currentView, setCurrentView } = useUIStore();

  // Real calendar data from existing hooks
  const {
    data: calendars = [],
    toggleCalendar,
    addCalendar,
    updateCalendar,
    deleteCalendar
  } = useCalendars();

  // Task groups state (using same structure as TaskFocusPane)
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([
    {
      id: 'default',
      name: 'Tasks',
      iconId: 'CheckSquare',
      color: '#3b82f6',
      description: 'Default task group',
      isDefault: true
    }
  ]);
  const [activeTaskGroupId, setActiveTaskGroupId] = useState('default');

  const handleViewToggle = (view: ViewMode) => {
    setCurrentView(view);
  };

  const handleToggleCalendar = (name: string) => {
    toggleCalendar.mutate(name);
  };

  const handleAddCalendar = (name: string, color: string) => {
    addCalendar.mutate({ name, color });
  };

  const handleEditCalendar = (currentName: string, newName: string, color: string) => {
    updateCalendar.mutate({
      name: currentName,
      updates: { name: newName, color }
    });
  };

  const handleDeleteCalendar = (name: string) => {
    deleteCalendar.mutate(name);
  };

  // Task group handlers (using same logic as TaskFocusPane)
  const handleAddTaskGroup = (data: Omit<TaskGroup, 'id'>) => {
    const newTaskGroup: TaskGroup = {
      id: `group-${Date.now()}`,
      name: data.name,
      iconId: data.iconId,
      color: data.color,
      description: data.description
    };
    setTaskGroups(prev => [...prev, newTaskGroup]);
    setActiveTaskGroupId(newTaskGroup.id);
  };

  const handleEditTaskGroup = (groupId: string, updates: Partial<TaskGroup>) => {
    setTaskGroups(prev => prev.map(group =>
      group.id === groupId ? { ...group, ...updates } : group
    ));
  };

  const handleDeleteTaskGroup = (groupId: string) => {
    if (groupId === 'default') return; // Don't delete default group
    setTaskGroups(prev => prev.filter(group => group.id !== groupId));
    if (groupId === activeTaskGroupId) {
      setActiveTaskGroupId('default');
    }
  };

  const handleSelectTaskGroup = (groupId: string) => {
    setActiveTaskGroupId(groupId);
  };

  return (
    <div 
      className={cn(
        'bg-sidebar text-sidebar-foreground',
        'flex flex-col h-full',
        className
      )}
      data-slot="calendar-summary-pane"
    >
      {/* Header with Logo and View Toggle - match LeftPane structure */}
      <SidebarHeader className="pt-4 pb-2 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarImage
                src="https://img.glyphs.co/img?q=85&w=900&src=aHR0cHM6Ly9zMy5tZWRpYWxvb3QuY29tL2Jsb2ctaW1hZ2VzL0dUR0wtSW1hZ2UtMDMuanBnP210aW1lPTIwMTgxMDE1MTMxNDA1"
                alt="Company Logo"
                className="object-cover"
              />
              <AvatarFallback>CO</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">DASH AI</span>
              <span className="text-xs text-muted-foreground">Task Manager</span>
            </div>
          </div>
          
          <ViewToggle 
            currentView={currentView}
            onToggle={handleViewToggle}
            className="scale-90"
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Main Content Area */}
      <SidebarContent className="flex-1 px-4 py-2">
        {/* Event Overview Section */}
        <EventOverview 
          maxEvents={5}
          showCurrentWeekOnly={true}
        />

        <SidebarSeparator className="my-4" />

        {/* Conditional List Section - Task Lists for task view, Calendars for calendar view */}
        {currentView === 'task' ? (
          <TaskGroupList
            taskGroups={taskGroups}
            activeTaskGroupId={activeTaskGroupId}
            onAddTaskGroup={handleAddTaskGroup}
            onEditTaskGroup={handleEditTaskGroup}
            onDeleteTaskGroup={handleDeleteTaskGroup}
            onSelectTaskGroup={handleSelectTaskGroup}
          />
        ) : (
          <CalendarList
            calendars={calendars}
            onToggleCalendar={handleToggleCalendar}
            onAddCalendar={handleAddCalendar}
            onEditCalendar={handleEditCalendar}
            onDeleteCalendar={handleDeleteCalendar}
          />
        )}
      </SidebarContent>

      {/* Footer with User Account - exact copy from LeftPane */}
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors">
              <Avatar className="size-8">
                <AvatarImage
                  src="https://ui-avatars.com/api/%22f%22?name=S+C&background=000000&color=ffffff&bold=true&size=512"
                  alt="Shree Chaturvedi"
                />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">Shree Chaturvedi</span>
                <span className="text-xs text-muted-foreground truncate">chaturs@miamioh.edu</span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘P</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘,</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘?</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log Out</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘Q</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </div>
  );
};

export default CalendarSummaryPane;