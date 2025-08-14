/**
 * Tag display component using shadcn badges
 * Shows parsed tags below input with appropriate icons and colors
 */

import React from 'react';
import { ParsedTag } from '@shared/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getIconByName } from '@/components/ui/icons';
import { X } from 'lucide-react';

export interface ParsedTagsProps {
  /** Parsed tags to display */
  tags: ParsedTag[];
  /** Whether tags can be removed */
  removable?: boolean;
  /** Handler for tag removal */
  onRemoveTag?: (tagId: string) => void;
  /** Handler for tag click */
  onTagClick?: (tag: ParsedTag) => void;
  /** Whether to show confidence indicators */
  showConfidence?: boolean;
  /** Maximum number of tags to show */
  maxTags?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display parsed tags as badges
 */
export const ParsedTags: React.FC<ParsedTagsProps> = ({
  tags,
  removable = false,
  onRemoveTag,
  onTagClick,
  showConfidence = false,
  // maxTags,
  className = '',
}) => {
  // Limit tags if maxTags is specified
  const displayTags = tags;
  const hasMoreTags = false; // Enhanced input shows all tags and lets them wrap

  if (displayTags.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      data-testid="parsed-tags"
    >
      {displayTags.map((tag) => (
        <TagBadge
          key={tag.id}
          tag={tag}
          removable={removable}
          onRemove={onRemoveTag}
          onClick={onTagClick}
          showConfidence={showConfidence}
        />
      ))}

      {hasMoreTags && null}
    </div>
  );
};

/**
 * Individual tag badge component
 */
interface TagBadgeProps {
  tag: ParsedTag;
  removable: boolean;
  onRemove?: (tagId: string) => void;
  onClick?: (tag: ParsedTag) => void;
  showConfidence: boolean;
}

const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  removable,
  onRemove,
  onClick,
  showConfidence,
}) => {
  // Get the icon component
  const IconComponent = getIconByName(tag.iconName);

  // Get badge variant - using outline for all by default as requested
  const getBadgeVariant = (): 'outline' => {
    return 'outline';
  };

  // Get confidence indicator
  const getConfidenceIndicator = (confidence: number) => {
    if (confidence >= 0.8) return '●';
    if (confidence >= 0.6) return '◐';
    return '○';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const handleClick = () => {
    onClick?.(tag);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(tag.id);
  };

  return (
    <Badge
      variant={getBadgeVariant()}
      className={cn(
        'text-xs px-2 py-1 gap-1 text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50 transition-all duration-100 ease-out group/tag',
        (onClick || removable) && 'cursor-pointer'
      )}
      style={
        tag.color
          ? {
              borderColor: `${tag.color}30`,
              color: tag.color,
              backgroundColor: `${tag.color}1A`,
            }
          : {
              backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)',
            }
      }
      onClick={removable ? handleRemove : handleClick}
      title={`${tag.type}: ${tag.displayText}${showConfidence ? ` (${Math.round(tag.confidence * 100)}% confidence)` : ''}`}
      aria-label={`${removable ? 'Remove' : 'View'} ${tag.displayText} tag`}
    >
      {/* Icon that becomes X on hover when removable - same as TaskItem */}
      <div className="w-3 h-3 relative" aria-hidden="true">
        <span className="absolute inset-0" style={tag.color ? { color: tag.color } : undefined}>
          <IconComponent className="w-3 h-3 transition-opacity duration-150 ease-out group-hover/tag:opacity-0" />
        </span>
        {removable && (
          <X
            className="w-3 h-3 absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-100"
            style={tag.color ? { color: tag.color } : undefined}
          />
        )}
      </div>

      {/* Text */}
      <span className="text-xs font-medium">{tag.displayText}</span>

      {/* Confidence indicator */}
      {showConfidence && (
        <span
          className={cn('text-xs ml-1', getConfidenceColor(tag.confidence))}
          title={`${Math.round(tag.confidence * 100)}% confidence`}
        >
          {getConfidenceIndicator(tag.confidence)}
        </span>
      )}
    </Badge>
  );
};

/**
 * Tag statistics component
 */
export interface TagStatsProps {
  tags: ParsedTag[];
  className?: string;
}

export const TagStats: React.FC<TagStatsProps> = ({ tags, className }) => {
  if (tags.length === 0) return null;

  const averageConfidence =
    tags.reduce((sum, tag) => sum + tag.confidence, 0) / tags.length;
  const tagsByType = tags.reduce(
    (acc, tag) => {
      acc[tag.type] = (acc[tag.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div
      className={cn(
        'flex items-center gap-4 text-xs text-muted-foreground',
        className
      )}
    >
      <span>
        {tags.length} tag{tags.length !== 1 ? 's' : ''} detected
      </span>
      <span>{Math.round(averageConfidence * 100)}% avg confidence</span>
      <div className="flex gap-1">
        {Object.entries(tagsByType).map(([type, count]) => (
          <Badge key={type} variant="outline" className="text-xs px-1 py-0">
            {type}: {count}
          </Badge>
        ))}
      </div>
    </div>
  );
};
