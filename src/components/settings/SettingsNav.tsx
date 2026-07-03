import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  Settings2,
  HelpCircle,
  Shield,
  Sliders,
  Calendar as CalendarIcon,
  Link2,
  ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useProfileData } from '@/hooks/useProfileData';
import type { SettingsSection } from './SettingsDialog';

// Navigation items excluding 'profile' (rendered separately). Descriptions
// were dropped (#1.D/#2.7) — they duplicated the detail-pane's own header,
// visible simultaneously on any viewport >=768px.
const navItems = [
  { id: 'general' as const, title: 'General', icon: Sliders },
  { id: 'calendar' as const, title: 'Calendar', icon: CalendarIcon },
  { id: 'preferences' as const, title: 'Preferences', icon: Settings2 },
  { id: 'security' as const, title: 'Security', icon: Shield },
  { id: 'integrations' as const, title: 'Integrations', icon: Link2 },
  { id: 'help' as const, title: 'Help & Support', icon: HelpCircle },
] as const;

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsNav({
  activeSection,
  onSectionChange,
}: SettingsNavProps) {
  const profileData = useProfileData();

  // Generate initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav
      className="space-y-3"
      role="navigation"
      aria-label="Settings navigation"
    >
      {/* Profile Section */}
      <div className="space-y-1">
        <button
          onClick={() => onSectionChange('profile')}
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            activeSection === 'profile'
              ? 'bg-aqua-film-08 text-foreground'
              : 'text-ink-muted hover:bg-surface-hover hover:text-foreground',
            'w-full justify-start h-auto px-3 py-2.5 flex items-center gap-3'
          )}
        >
          <Avatar className="size-8">
            <AvatarImage src={profileData.picture} alt={profileData.name} />
            <AvatarFallback>{getInitials(profileData.name)}</AvatarFallback>
          </Avatar>
          <div className="text-left flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {profileData.name}
            </div>
            <div className="text-xs text-ink-muted truncate">
              {profileData.email}
            </div>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-ink-muted md:hidden"
            aria-hidden="true"
          />
        </button>

        <Separator />
      </div>

      {/* Other Settings Sections */}
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                isActive
                  ? 'bg-aqua-film-08 text-foreground'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-foreground',
                'w-full justify-start h-auto px-3 py-2.5 flex items-center gap-3'
              )}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0', isActive && 'text-aqua')}
              />
              <span className="flex-1 min-w-0 text-left text-sm font-medium">
                {item.title}
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-ink-muted md:hidden"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
