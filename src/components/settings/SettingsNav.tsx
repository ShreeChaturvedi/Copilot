import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button-variants';
import { Settings2, HelpCircle, Shield, Sliders, Calendar as CalendarIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useProfileData } from '@/hooks/useProfileData';
import type { SettingsSection } from './SettingsDialog';

// Navigation items excluding 'profile' (rendered separately)
const navItems = [
  {
    id: 'general' as const,
    title: 'General',
    icon: Sliders,
    description: 'Account and application settings',
  },
  {
    id: 'calendar' as const,
    title: 'Calendar',
    icon: CalendarIcon,
    description: 'Time range and calendar preferences',
  },
  {
    id: 'preferences' as const,
    title: 'Preferences',
    icon: Settings2,
    description: 'Workspace and display settings',
  },
  {
    id: 'security' as const,
    title: 'Security',
    icon: Shield,
    description: 'Password and authentication',
  },
  {
    id: 'help' as const,
    title: 'Help & Support',
    icon: HelpCircle,
    description: 'Documentation and support',
  },
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
              ? 'bg-muted hover:bg-muted text-foreground'
              : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
            'w-full justify-start h-auto p-3 flex items-center gap-3'
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
            <div className="text-xs text-muted-foreground truncate">
              {profileData.email}
            </div>
          </div>
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
                  ? 'bg-muted hover:bg-muted text-foreground'
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
                'w-full justify-start h-auto p-3 flex items-center gap-3'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="font-medium text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
