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
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { EASE_SETTLE, DUR_2_S } from '@/lib/motion';
import { SettingsNav } from './SettingsNav';
import { GeneralSettings } from './GeneralSettings';
import { AccountSettings } from './AccountSettings';
import { SecuritySettings } from './SecuritySettings';
import { AboutSettings } from './AboutSettings';
import { IntegrationsSettings } from './IntegrationsSettings';
import {
  resolveSettingsSection,
  SECTION_TITLES,
  type SettingsSection,
} from './settingsSections';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSection?: SettingsSection | string;
}

export function SettingsDialog({
  open,
  onOpenChange,
  defaultSection = 'general',
}: SettingsDialogProps) {
  const resolvedDefault = resolveSettingsSection(String(defaultSection));
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(resolvedDefault);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  // The rail is off-canvas only on mobile; on md+ it is md:static and fully
  // visible/interactive, so aria-hidden must be scoped to the mobile layout —
  // hiding a still-visible nav (with focusable buttons) breaks WCAG 4.1.2.
  const railHidden = isMobile && mobileDetailOpen;

  useEffect(() => {
    if (open) {
      const next = resolveSettingsSection(String(defaultSection));
      setActiveSection(next);
      setMobileDetailOpen(next !== 'general');
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
      case 'account':
        return <AccountSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'integrations':
        return <IntegrationsSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Preference window: wide enough for rail + content, not a second app.
          'w-full max-w-[calc(100vw-2rem)] sm:max-w-[52rem]',
          'h-[min(78vh,680px)] p-0 gap-0 grid-rows-[auto_1fr]',
          'max-sm:max-w-full max-sm:h-[92vh] max-sm:pb-0 overflow-hidden',
          'border-hairline bg-surface-1'
        )}
        closeButtonClassName="top-3 right-3"
      >
        <DialogHeader className="px-5 py-3 border-b border-hairline max-sm:pt-5">
          <DialogTitle className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Manage account, workspace, and integrations
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 overflow-hidden md:flex">
          {/* Rail: wide enough for name+email (~14rem) */}
          <aside
            className={cn(
              'absolute inset-0 w-full overflow-y-auto p-3 bg-surface-1',
              'transition-transform motion-reduce:transition-none',
              mobileDetailOpen
                ? 'duration-[240ms] ease-settle'
                : 'duration-[160ms] ease-out',
              'md:static md:w-60 md:shrink-0 md:translate-x-0',
              'md:border-r md:border-hairline md:bg-surface-2 md:p-3',
              mobileDetailOpen && '-translate-x-1/4 md:translate-x-0'
            )}
            aria-hidden={railHidden ? true : undefined}
            inert={railHidden ? true : undefined}
          >
            <SettingsNav
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />
          </aside>

          <section
            className={cn(
              'absolute inset-0 w-full overflow-y-auto bg-surface-1',
              'transition-transform motion-reduce:transition-none',
              mobileDetailOpen
                ? 'duration-[240ms] ease-settle'
                : 'duration-[160ms] ease-out',
              'md:static md:flex-1 md:translate-x-0',
              mobileDetailOpen
                ? 'translate-x-0 [box-shadow:var(--shadow-dialog)] md:shadow-none'
                : 'translate-x-full md:translate-x-0'
            )}
          >
            <div className="px-6 py-5 max-w-[36rem]">
              <div className="mb-5 flex items-center gap-1">
                {mobileDetailOpen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden -ml-2 h-8 px-2 text-ink-muted"
                    onClick={() => setMobileDetailOpen(false)}
                    aria-label="Back to settings"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Settings
                  </Button>
                )}
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground max-md:hidden">
                  {SECTION_TITLES[activeSection]}
                </h2>
                {mobileDetailOpen && (
                  <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground md:hidden">
                    {SECTION_TITLES[activeSection]}
                  </h2>
                )}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeSection}
                  initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
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
