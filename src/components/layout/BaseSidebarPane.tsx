import React, { ReactNode } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle';
import { useUIStore } from '@/stores/uiStore';
import { Separator } from '@/components/ui/separator';
import { SmoothSidebarTrigger } from './SmoothSidebarTrigger';
import { UserDropdown } from './UserDropdown';

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
  onOpenSettings?: (section: string) => void;

  // Event handlers
  onViewToggle?: (view: ViewMode) => void;
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
}) => {
  // Field selectors, not a whole-store read, so this pane doesn't re-render on
  // unrelated uiStore changes.
  const currentView = useUIStore((s) => s.currentView);
  const setCurrentView = useUIStore((s) => s.setCurrentView);
  const { isMobile, setOpenMobile } = useSidebar();

  const handleViewToggle = (view: ViewMode) => {
    setCurrentView(view);
    onViewToggle?.(view);
    // On mobile the sidebar is an offcanvas drawer covering the content the
    // user just switched to — dismiss it so a view toggle reads as navigation.
    if (isMobile) setOpenMobile(false);
  };

  // Default header content (controls only, no branding)
  const defaultHeaderContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 relative">
        {showViewToggle && (
          <ViewToggle currentView={currentView} onToggle={handleViewToggle} />
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightHeaderControls}
        {showSidebarTrigger && <SmoothSidebarTrigger position="sidebar" />}
      </div>
    </div>
  );

  // Default user profile content
  const defaultUserProfileContent = (
    <UserDropdown onOpenSettings={onOpenSettings} />
  );

  // "16 outer / 12 inner" rhythm: 16px horizontal inset the whole way down,
  // 12px vertical seams between header/content/footer regions. Exactly two
  // full-bleed dividers — header→content and content→footer-list — so every
  // seam that needs a line has one and every seam that doesn't, doesn't.
  return (
    <Sidebar collapsible="offcanvas" className={className}>
      {/* Header */}
      <SidebarHeader className="px-4 pt-4 pb-3">
        {headerContent || defaultHeaderContent}
        {additionalHeaderContent}
      </SidebarHeader>

      <Separator />

      {/* Main Content */}
      <SidebarContent>
        <SidebarGroup className="px-4 py-3">{mainContent}</SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="gap-3 px-4 pt-3 pb-4">
        {footerListContent && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">{footerListContent}</div>
          </>
        )}

        {/* User Profile */}
        {userProfileContent || defaultUserProfileContent}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

export default BaseSidebarPane;
