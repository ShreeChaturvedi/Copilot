import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
// import { Separator } from '@/components/ui/separator';
import { SettingsNav } from './SettingsNav';
import { ProfileSettings } from './ProfileSettings';
import { GeneralSettings } from './GeneralSettings';
import { PreferencesSettings } from './PreferencesSettings';
import { SecuritySettings } from './SecuritySettings';
import { HelpSettings } from './HelpSettings';
import { CalendarSettings } from './CalendarSettings';

export type SettingsSection =
  | 'general'
  | 'profile'
  | 'preferences'
  | 'security'
  | 'help'
  | 'calendar';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSection?: SettingsSection;
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultSection = 'general',
}: SettingsDialogProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(defaultSection);

  // Update active section when defaultSection changes and dialog opens
  useEffect(() => {
    if (open) {
      setActiveSection(defaultSection);
    }
  }, [open, defaultSection]);

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSettings />;
      case 'calendar':
        return <CalendarSettings />;
      case 'profile':
        return <ProfileSettings />;
      case 'preferences':
        return <PreferencesSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'help':
        return <HelpSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'general':
        return 'General';
      case 'calendar':
        return 'Calendar';
      case 'profile':
        return 'Profile';
      case 'preferences':
        return 'Preferences';
      case 'security':
        return 'Security';
      case 'help':
        return 'Help & Support';
      default:
        return 'Settings';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[90vw] md:max-w-6xl h-[80vh] max-h-[800px] p-0 gap-0 grid-rows-[auto_1fr]"
        closeButtonClassName="top-2"
      >
        <DialogHeader className="px-6 py-2 border-b">
          <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 overflow-hidden">
          {/* Navigation Sidebar */}
          <aside className="w-64 border-r bg-muted/30 p-4 overflow-auto">
            <div className="space-y-1">
              <SettingsNav
                activeSection={activeSection}
                onSectionChange={setActiveSection}
              />
            </div>
          </aside>

          {/* Content Area */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="p-6">
              <div className="mb-2 space-y-1">
                <h2 className="text-lg font-semibold">{getSectionTitle()}</h2>
                <p className="text-sm text-muted-foreground">
                  {activeSection === 'general' &&
                    'Manage your account and application settings'}
                  {activeSection === 'profile' &&
                    'Manage your personal information and preferences'}
                  {activeSection === 'preferences' &&
                    'Customize your workspace and default preferences'}
                  {activeSection === 'security' &&
                    'Manage your password and security settings'}
                  {activeSection === 'help' &&
                    'Get help, documentation, and support'}
                </p>
              </div>
              {/* Keep content tight to the header; separator removed to avoid large visual gap */}
              {renderContent()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
