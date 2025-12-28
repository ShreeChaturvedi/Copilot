import React, { useMemo, useState, Suspense } from 'react';
import { Search, X } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

// Use Lucide's dynamic icon imports to code-split each icon.
// Static import so bundlers can include the small mapping table only.
// lucide-react exposes a mapping of kebab-case icon names to dynamic imports
// Types are not exported, so we cast to a safe index signature.
const typedIconImports = dynamicIconImports as Record<
  string,
  () => Promise<{ default: React.ComponentType<React.SVGProps<SVGSVGElement>> }>
>;

const allIconNames: string[] = Object.keys(typedIconImports);

export interface IconPickerProps {
  selectedIcon?: string;
  onIconSelect: (iconName: string) => void;
  className?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  onIconSelect,
  className,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const readyToShow = searchTerm.trim().length >= 2;
  const filteredIcons = useMemo(() => {
    if (!readyToShow) return [] as string[];
    const q = searchTerm.trim().toLowerCase();
    return allIconNames.filter((name) => name.includes(q)).slice(0, 60);
  }, [readyToShow, searchTerm]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className={cn('w-full max-w-sm', className)}>
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
        {!readyToShow ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Type at least 2 characters to search icons
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1 p-2">
            {filteredIcons.map((iconName) => {
              const loader = typedIconImports[iconName];
              if (!loader) return null;
              const IconLazy = React.lazy(loader);
              return (
                <Suspense
                  key={iconName}
                  fallback={<div className="h-10 w-10" />}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onIconSelect(iconName)}
                    className={cn(
                      'h-10 w-10 p-0 hover:bg-accent',
                      selectedIcon === iconName &&
                        'bg-accent border-2 border-primary'
                    )}
                    title={iconName}
                  >
                    <IconLazy className="w-4 h-4" />
                  </Button>
                </Suspense>
              );
            })}
          </div>
        )}

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
