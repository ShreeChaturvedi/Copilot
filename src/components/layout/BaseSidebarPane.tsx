import React, { ReactNode } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { SmoothSidebarTrigger } from './SmoothSidebarTrigger';
import { UserDropdown } from './UserDropdown';
import { cn } from '@/lib/utils';

export interface BaseSidebarPaneProps {
  // Core layout props
  className?: string;
  
  // Header content
  headerContent?: ReactNode;
  additionalHeaderContent?: ReactNode; // Additional content to append after default header
  showViewToggle?: boolean;
  showSidebarTrigger?: boolean;
  // Optional right-side header controls rendered before the sidebar trigger
  rightHeaderControls?: ReactNode;
  
  // Main content
  mainContent?: ReactNode;
  
  // Footer content - lists section
  footerListContent?: ReactNode;
  
  // Footer content - user profile (can be overridden)
  userProfileContent?: ReactNode;
  
  // Settings dialog handler
  onOpenSettings?: (section: 'general' | 'profile' | 'help') => void;
  
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
  rightHeaderControls,
  mainContent,
  footerListContent,
  userProfileContent,
  onViewToggle,
  onOpenSettings,
  useMinimalMode = false
}) => {
  const { currentView, setCurrentView } = useUIStore();

  const handleViewToggle = (view: ViewMode) => {
    setCurrentView(view);
    onViewToggle?.(view);
  };

  // Default header content (controls only, no branding)
  const defaultHeaderContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 relative">
        {showViewToggle && (
          <ViewToggle
            currentView={currentView}
            onToggle={handleViewToggle}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightHeaderControls}
        {showSidebarTrigger && (
          <SmoothSidebarTrigger position="sidebar" />
        )}
      </div>
    </div>
  );

  // Default user profile content
  const defaultUserProfileContent = <UserDropdown onOpenSettings={onOpenSettings} />;

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