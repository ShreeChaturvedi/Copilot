import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { EASE_SETTLE, DUR_2_S } from '@/lib/motion';
import { SettingsNav } from './SettingsNav';
import { ProfileSettings } from './ProfileSettings';
import { GeneralSettings } from './GeneralSettings';
import { PreferencesSettings } from './PreferencesSettings';
import { SecuritySettings } from './SecuritySettings';
import { HelpSettings } from './HelpSettings';
import { CalendarSettings } from './CalendarSettings';
import { IntegrationsSettings } from './IntegrationsSettings';

export type SettingsSection =
  | 'general'
  | 'profile'
  | 'preferences'
  | 'security'
  | 'integrations'
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
  // Below 768px settings is a list -> detail push (#48): the nav is the
  // first screen, a section choice slides the detail pane in over it.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Update active section when defaultSection changes and dialog opens
  useEffect(() => {
    if (open) {
      setActiveSection(defaultSection);
      // Deep links (e.g. straight to Integrations) land on the detail pane
      setMobileDetailOpen(defaultSection !== 'general');
    }
  }, [open, defaultSection]);

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    setMobileDetailOpen(true);
  };

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
      case 'integrations':
        return <IntegrationsSettings />;
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
      case 'integrations':
        return 'Integrations';
      case 'help':
        return 'Help & Support';
      default:
        return 'Settings';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[90vw] md:max-w-5xl h-[80vh] max-h-[800px] p-0 gap-0 grid-rows-[auto_1fr] max-sm:max-w-full max-sm:h-[92vh] max-sm:pb-0 overflow-hidden"
        closeButtonClassName="top-2"
      >
        <DialogHeader className="px-5 py-3 border-b border-hairline max-sm:pt-5">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Manage your account, preferences, and integrations
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 overflow-hidden md:flex">
          {/* Navigation: static rail on md+, first screen of the push below */}
          <aside
            className={cn(
              'absolute inset-0 w-full overflow-y-auto p-4 bg-surface-3',
              'transition-transform motion-reduce:transition-none',
              // Close (~70%) is faster than open, never the reverse (§3.1).
              mobileDetailOpen
                ? 'duration-[240ms] ease-settle'
                : 'duration-[160ms] ease-out',
              'md:static md:w-64 md:shrink-0 md:translate-x-0 md:border-r md:border-hairline md:bg-surface-2',
              mobileDetailOpen && '-translate-x-1/4 md:translate-x-0'
            )}
            aria-hidden={mobileDetailOpen ? true : undefined}
          >
            <SettingsNav
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />
          </aside>

          {/* Detail pane: slides in over the nav below md (#48) */}
          <section
            className={cn(
              'absolute inset-0 w-full overflow-y-auto bg-surface-3',
              'transition-transform motion-reduce:transition-none',
              // Close (~70%) is faster than open, never the reverse (§3.1).
              mobileDetailOpen
                ? 'duration-[240ms] ease-settle'
                : 'duration-[160ms] ease-out',
              'md:static md:flex-1 md:translate-x-0',
              mobileDetailOpen
                ? 'translate-x-0 shadow-[-8px_0_24px_-16px_rgb(0_0_0/0.4)] md:shadow-none'
                : 'translate-x-full md:translate-x-0'
            )}
          >
            <div className="p-5">
              <div className="mb-3 space-y-1">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden -ml-2 px-2 text-muted-foreground"
                    onClick={() => setMobileDetailOpen(false)}
                    aria-label="Back to settings"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Settings
                  </Button>
                </div>
                <h2 className="text-base font-semibold tracking-[-0.01em]">
                  {getSectionTitle()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeSection === 'general' &&
                    'Manage your account and application settings'}
                  {activeSection === 'profile' &&
                    'Manage your personal information and preferences'}
                  {activeSection === 'preferences' &&
                    'Customize your workspace and default preferences'}
                  {activeSection === 'security' &&
                    'Manage your password and security settings'}
                  {activeSection === 'integrations' &&
                    'Connect external services like Google Calendar'}
                  {activeSection === 'help' &&
                    'Get help, documentation, and support'}
                </p>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeSection}
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: DUR_2_S, ease: EASE_SETTLE }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
