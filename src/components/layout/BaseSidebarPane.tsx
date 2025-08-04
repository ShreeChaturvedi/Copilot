import React, { ReactNode } from 'react';
import { User, Settings, HelpCircle, LogOut } from 'lucide-react';
import { 
  Sidebar,
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter,
  SidebarGroup,
  SidebarSeparator 
} from '@/components/ui/sidebar';
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle';
import { useUIStore } from '@/stores/uiStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SmoothSidebarTrigger } from './SmoothSidebarTrigger';
import { cn } from '@/lib/utils';

export interface BaseSidebarPaneProps {
  // Core layout props
  className?: string;
  
  // Header content
  headerContent?: ReactNode;
  additionalHeaderContent?: ReactNode; // Additional content to append after default header
  showViewToggle?: boolean;
  showSidebarTrigger?: boolean;
  
  // Main content
  mainContent?: ReactNode;
  
  // Footer content - lists section
  footerListContent?: ReactNode;
  
  // Footer content - user profile (can be overridden)
  userProfileContent?: ReactNode;
  
  // Event handlers
  onViewToggle?: (view: ViewMode) => void;
  
  // Styling options
  useMinimalMode?: boolean; // For CalendarSummaryPane-style layout without full Sidebar wrapper
}

export const BaseSidebarPane: React.FC<BaseSidebarPaneProps> = ({
  className,
  headerContent,
  additionalHeaderContent,
  showViewToggle = true,
  showSidebarTrigger = false,
  mainContent,
  footerListContent,
  userProfileContent,
  onViewToggle,
  useMinimalMode = false
}) => {
  const { currentView, setCurrentView } = useUIStore();

  const handleViewToggle = (view: ViewMode) => {
    setCurrentView(view);
    onViewToggle?.(view);
  };

  // Default header content (company logo section)
  const defaultHeaderContent = (
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
        {showViewToggle && (
          <ViewToggle 
            currentView={currentView}
            onToggle={handleViewToggle}
            className="scale-90"
          />
        )}
        {/* Smooth toggle button that coordinates with sidebar animations */}
        {showSidebarTrigger && (
          <SmoothSidebarTrigger position="sidebar" />
        )}
      </div>
    </div>
  );

  // Default user profile content
  const defaultUserProfileContent = (
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
  );

  // Minimal mode (for CalendarSummaryPane)
  if (useMinimalMode) {
    return (
      <div 
        className={cn(
          'bg-sidebar text-sidebar-foreground',
          'flex flex-col h-full',
          className
        )}
        data-slot="sidebar-pane"
      >
        {/* Header */}
        <SidebarHeader className="pt-4 pb-2 px-2">
          {headerContent || defaultHeaderContent}
          {additionalHeaderContent}
        </SidebarHeader>

        <SidebarSeparator />

        {/* Main Content Area */}
        <SidebarContent className="flex-1 px-4 py-2">
          {mainContent}
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter>
          {footerListContent && (
            <>
              <Separator />
              <SidebarGroup>
                {footerListContent}
              </SidebarGroup>
            </>
          )}
          
          {/* User Profile */}
          {userProfileContent || defaultUserProfileContent}
        </SidebarFooter>
      </div>
    );
  }

  // Full sidebar mode (for LeftPane)
  return (
    <Sidebar collapsible="offcanvas" className={className}>
      {/* Header */}
      <SidebarHeader className="pt-4 pb-2 px-2">
        {headerContent || defaultHeaderContent}
        {additionalHeaderContent}
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent>
        <SidebarGroup>
          {mainContent}
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        {footerListContent && (
          <>
            <Separator />
            <SidebarGroup>
              {footerListContent}
            </SidebarGroup>
          </>
        )}
        
        {/* User Profile */}
        {userProfileContent || defaultUserProfileContent}
      </SidebarFooter>
    </Sidebar>
  );
};

export default BaseSidebarPane;