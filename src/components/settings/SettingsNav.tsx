import { cn } from '@/lib/utils';
import { HelpCircle, Shield, Link2, Sliders, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useProfileData } from '@/hooks/useProfileData';
import type { SettingsSection } from './settingsSections';

const navItems: {
  id: Exclude<SettingsSection, 'account'>;
  title: string;
  icon: typeof Sliders;
}[] = [
  { id: 'general', title: 'General', icon: Sliders },
  { id: 'integrations', title: 'Integrations', icon: Link2 },
  { id: 'security', title: 'Security', icon: Shield },
  { id: 'about', title: 'About', icon: HelpCircle },
];

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsNav({
  activeSection,
  onSectionChange,
}: SettingsNavProps) {
  const profileData = useProfileData();

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <nav
      className="flex flex-col gap-3"
      role="navigation"
      aria-label="Settings navigation"
    >
      <button
        type="button"
        onClick={() => onSectionChange('account')}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-btn px-2 py-2 text-left',
          'transition-colors duration-150 ease-out',
          'outline-none focus-visible:ring-1 focus-visible:ring-hairline-strong',
          activeSection === 'account'
            ? 'bg-surface-3 text-foreground'
            : 'text-ink-2 hover:bg-surface-hover'
        )}
      >
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={profileData.picture} alt={profileData.name} />
          <AvatarFallback className="text-[11px] font-medium">
            {getInitials(profileData.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate leading-tight">
            {profileData.name}
          </div>
          <div className="text-[11px] text-ink-muted truncate leading-tight mt-0.5">
            {profileData.email}
          </div>
        </div>
        <ChevronRight
          className="size-3.5 shrink-0 text-ink-muted md:hidden"
          aria-hidden
        />
      </button>

      <Separator className="bg-hairline" />

      <div className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-btn h-8 px-2',
                'text-[13px] font-medium transition-colors duration-150 ease-out',
                'outline-none focus-visible:ring-1 focus-visible:ring-hairline-strong',
                isActive
                  ? 'bg-surface-3 text-foreground'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  isActive ? 'text-aqua' : 'text-ink-muted'
                )}
              />
              <span className="flex-1 min-w-0 text-left truncate">
                {item.title}
              </span>
              <ChevronRight
                className="size-3.5 shrink-0 text-ink-muted md:hidden"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
