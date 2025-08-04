/**
 * LeftPane - Complete rewrite using shadcn Sidebar component
 */

import React, { useState } from 'react';
import { User, Settings, HelpCircle, LogOut } from 'lucide-react';
import { SmartTaskInput, SmartTaskData } from '@/components/smart-input/SmartTaskInput';
import { TaskList } from '@/components/tasks/TaskList';
import { CalendarList } from '@/components/calendar/CalendarList';
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle';
import { useTasks } from '@/hooks/useTasks';
import { useCalendars } from '@/hooks/useCalendars';
import { useUIStore } from '@/stores/uiStore';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { SmoothSidebarTrigger } from './SmoothSidebarTrigger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface LeftPaneProps {
  className?: string;
}

export const LeftPane: React.FC<LeftPaneProps> = ({ className }) => {
  // Sidebar state
  const { isMobile } = useSidebar();
  
  // UI state for view management
  const { currentView, setCurrentView } = useUIStore();
  
  // Tasks management
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    addTask,
    updateTask,
    deleteTask,
    scheduleTask
  } = useTasks();

  // Calendar management
  const {
    data: calendars = [],
    isLoading: calendarsLoading,
    toggleCalendar,
    addCalendar,
    updateCalendar,
    deleteCalendar
  } = useCalendars();

  // Task groups state (temporary local state until backend supports it)
  const [taskGroups, setTaskGroups] = useState([
    {
      id: 'default',
      name: 'Tasks',
      iconId: 'CheckSquare',
      color: '#3b82f6',
      description: 'Default task group'
    }
  ]);
  const [activeTaskGroupId, setActiveTaskGroupId] = useState('default');
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  const handleAddTask = (title: string, _groupId?: string, smartData?: SmartTaskData) => {
    addTask.mutate({
      title,
      priority: smartData?.priority,
      scheduledDate: smartData?.scheduledDate,
      tags: smartData?.tags?.map(tag => ({
        id: tag.id,
        type: tag.type,
        value: tag.value,
        displayText: tag.displayText,
        iconName: tag.iconName,
        color: tag.color,
      })),
      parsedMetadata: smartData ? {
        originalInput: smartData.originalInput,
        cleanTitle: smartData.title,
      } : undefined,
    });
  };

  const handleToggleTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      updateTask.mutate({
        id,
        updates: { completed: !task.completed }
      });
    }
  };

  const handleEditTask = (id: string, title: string) => {
    updateTask.mutate({
      id,
      updates: { title }
    });
  };

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleScheduleTask = (id: string) => {
    scheduleTask.mutate(id);
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

  // View management
  const handleViewToggle = (view: ViewMode) => {
    setCurrentView(view);
  };

  // Task group handlers
  const handleCreateTaskGroup = (data: { name: string; description: string; iconId: string; color: string }) => {
    const newTaskGroup = {
      id: `group-${Date.now()}`,
      name: data.name,
      iconId: data.iconId,
      color: data.color,
      description: data.description
    };
    setTaskGroups(prev => [...prev, newTaskGroup]);
    setActiveTaskGroupId(newTaskGroup.id);
    setShowCreateTaskDialog(false);
  };

  const handleSelectTaskGroup = (groupId: string) => {
    setActiveTaskGroupId(groupId);
  };

  const handleUpdateTaskGroupIcon = (groupId: string, iconId: string) => {
    setTaskGroups(prev => prev.map(group =>
      group.id === groupId ? { ...group, iconId } : group
    ));
  };

  const handleUpdateTaskGroupColor = (groupId: string, color: string) => {
    setTaskGroups(prev => prev.map(group =>
      group.id === groupId ? { ...group, color } : group
    ));
  };

  const handleDeleteTaskGroup = (groupId: string) => {
    // Don't delete the default group
    if (groupId === 'default') return;

    setTaskGroups(prev => prev.filter(group => group.id !== groupId));
    // Switch to default group if we deleted the active one
    if (groupId === activeTaskGroupId) {
      setActiveTaskGroupId('default');
    }
  };

  const handleOpenCreateTaskDialog = () => {
    setShowCreateTaskDialog(true);
  };

  const handleRemoveTag = (taskId: string, tagId: string) => {
    updateTask.mutate({
      id: taskId,
      updates: {
        tags: tasks.find(t => t.id === taskId)?.tags?.filter(tag => tag.id !== tagId) || []
      }
    });
  };

  const isLoading = tasksLoading || calendarsLoading;

  return (
    <Sidebar collapsible="offcanvas" className={className}>
      {/* Header with Company Logo and Task Input */}
      <SidebarHeader className="pt-4 pb-2 px-2"> {/* Match calendar header vertical alignment */}
        {/* Company Logo and Controls */}
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
          
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <ViewToggle 
              currentView={currentView}
              onToggle={handleViewToggle}
              className="scale-90"
            />
            {/* Smooth toggle button that coordinates with sidebar animations */}
            <SmoothSidebarTrigger position="sidebar" />
          </div>
        </div>

        {/* Smart Task Input */}
        <div className="mt-4">
          <SmartTaskInput
            onAddTask={handleAddTask}
            taskGroups={taskGroups}
            activeTaskGroupId={activeTaskGroupId}
            onCreateTaskGroup={handleOpenCreateTaskDialog}
            onSelectTaskGroup={handleSelectTaskGroup}
            disabled={isLoading || addTask.isPending}
            enableSmartParsing={true}
            showConfidence={false}
            maxDisplayTags={3}
            useInlineHighlighting={false}
            useOverlayHighlighting={false}
            useFlexInputGroup={true}
          />
        </div>
      </SidebarHeader>

      {/* Main Content - Task List Only */}
      <SidebarContent>
        <SidebarGroup>
          {/* Task List */}
          <TaskList
            tasks={tasks}
            taskGroups={taskGroups}
            activeTaskGroupId={activeTaskGroupId}
            onToggleTask={handleToggleTask}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onScheduleTask={handleScheduleTask}
            onRemoveTag={handleRemoveTag}
            onCreateTaskGroup={handleCreateTaskGroup}
            onSelectTaskGroup={handleSelectTaskGroup}
            onUpdateTaskGroupIcon={handleUpdateTaskGroupIcon}
            onUpdateTaskGroupColor={handleUpdateTaskGroupColor}
            onDeleteTaskGroup={handleDeleteTaskGroup}
            showCreateTaskDialog={showCreateTaskDialog}
            onShowCreateTaskDialog={setShowCreateTaskDialog}
          />
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Calendars and User Info */}
      <SidebarFooter>
        {/* Separator above calendars */}
        <Separator />

        {/* Calendars Section */}
        <SidebarGroup>
          <CalendarList
            calendars={calendars}
            onToggleCalendar={handleToggleCalendar}
            onAddCalendar={handleAddCalendar}
            onEditCalendar={handleEditCalendar}
            onDeleteCalendar={handleDeleteCalendar}
          />
        </SidebarGroup>

        {/* User Info and Dropdown */}
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

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}
    </Sidebar>
  );
};

export default LeftPane;