import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

// Get all Lucide icons
const iconNames = Object.keys(LucideIcons).filter(
  (name) => name !== 'createLucideIcon' && name !== 'default'
);

export interface IconPickerProps {
  selectedIcon?: string;
  onIconSelect: (iconName: string) => void;
  className?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  onIconSelect,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchTerm) return iconNames.slice(0, 100); // Show first 100 icons by default
    
    return iconNames.filter(name =>
      name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50); // Limit search results
  }, [searchTerm]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className={cn("w-full max-w-sm", className)}>
      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search icons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Icons Grid */}
      <div className="max-h-64 overflow-y-auto border rounded-md">
        <div className="grid grid-cols-6 gap-1 p-2">
          {filteredIcons.map((iconName) => {
            const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons] as React.ComponentType<{ className?: string; size?: number }>;
            if (!IconComponent) return null;

            return (
              <Button
                key={iconName}
                variant="ghost"
                size="sm"
                onClick={() => onIconSelect(iconName)}
                className={cn(
                  "h-10 w-10 p-0 hover:bg-accent",
                  selectedIcon === iconName && "bg-accent border-2 border-primary"
                )}
                title={iconName}
              >
                <IconComponent className="w-4 h-4" />
              </Button>
            );
          })}
        </div>
        
        {filteredIcons.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No icons found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IconPicker;