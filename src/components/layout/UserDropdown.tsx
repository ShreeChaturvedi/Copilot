import React, { useState } from 'react';
import { User, Settings, HelpCircle, LogOut } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';

interface UserDropdownProps {
  onOpenSettings?: (section: 'general' | 'profile' | 'help') => void;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ 
  onOpenSettings 
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const { 
    user, 
    googleUser, 
    authMethod, 
    logout 
  } = useAuthStore();

  // Get user info based on auth method
  const userInfo = authMethod === 'google' 
    ? {
        name: googleUser?.name || 'User',
        email: googleUser?.email || 'user@example.com',
        picture: googleUser?.picture
      }
    : {
        name: user?.name || 'User', 
        email: user?.email || 'user@example.com',
        picture: user?.picture
      };


  // Generate fallback initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const dispatchOpen = (section: 'general' | 'profile' | 'help') => {
    // Fire custom event as a fallback bridge
    window.dispatchEvent(new CustomEvent('app:open-settings', { detail: { section } }));
    onOpenSettings?.(section);
  };

  const handleProfileClick = () => dispatchOpen('profile');

  const handleSettingsClick = () => dispatchOpen('general');

  const handleHelpClick = () => dispatchOpen('help');

  const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors">
          <Avatar className="size-8">
            <AvatarImage
              src={userInfo.picture}
              alt={userInfo.name}
            />
            <AvatarFallback>{getInitials(userInfo.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate">{userInfo.name}</span>
            <span className="text-xs text-muted-foreground truncate">{userInfo.email}</span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleProfileClick}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘P</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSettingsClick}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘,</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleHelpClick}>
          <HelpCircle className="mr-2 h-4 w-4" />
          <span>Help</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘?</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleLogoutClick} 
          disabled={isLoggingOut}
          variant="destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoggingOut ? 'Logging out...' : 'Log Out'}</span>
          <span className="ml-auto text-xs text-muted-foreground">⌘Q</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;