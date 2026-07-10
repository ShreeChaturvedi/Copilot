/**
 * Tag display component using shadcn badges
 * Shows parsed tags below input with appropriate icons and colors
 */

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ParsedTag } from '@shared/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getIconByName } from '@/components/ui/icons';
import { X } from 'lucide-react';
import { tagTone } from '../lib/tagTone';
import { DUR_1_S, DUR_2_S, EASE_OUT, EASE_SETTLE } from '@/lib/motion';

export interface ParsedTagsProps {
  /** Parsed tags to display */
  tags: ParsedTag[];
  /** Whether tags can be removed */
  removable?: boolean;
  /** Handler for tag removal */
  onRemoveTag?: (tagId: string) => void;
  /** Handler for tag click */
  onTagClick?: (tag: ParsedTag) => void;
  /** Maximum number of tags to show before collapsing the rest into a "+N" counter */
  maxTags?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display parsed tags as badges. Tags carry a stable id across debounced
 * re-parses (smart-input/parsers), so this is a normal React-keyed list:
 * genuinely new tags settle in, dismissed tags settle out, and a tag that
 * merely persists across a re-parse never replays its entrance.
 */
export const ParsedTags: React.FC<ParsedTagsProps> = ({
  tags,
  removable = false,
  onRemoveTag,
  onTagClick,
  maxTags,
  className = '',
}) => {
  const displayTags =
    typeof maxTags === 'number' && maxTags > 0 ? tags.slice(0, maxTags) : tags;
  const hiddenCount = tags.length - displayTags.length;

  // Degrade the scale-in/out under prefers-reduced-motion: fade only, no
  // transform (SETTLE motion grammar requires everything to degrade).
  const reduceMotion = useReducedMotion();

  if (displayTags.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      data-testid="parsed-tags"
    >
      <AnimatePresence initial={false}>
        {displayTags.map((tag) => (
          <motion.span
            key={tag.id}
            layout={!reduceMotion}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
            }
            animate={{
              opacity: 1,
              scale: 1,
              transition: { duration: DUR_2_S, ease: EASE_SETTLE },
            }}
            exit={
              reduceMotion
                ? {
                    opacity: 0,
                    transition: { duration: DUR_1_S, ease: EASE_OUT },
                  }
                : {
                    opacity: 0,
                    scale: 0.92,
                    transition: { duration: DUR_1_S, ease: EASE_OUT },
                  }
            }
          >
            <TagBadge
              tag={tag}
              removable={removable}
              onRemove={onRemoveTag}
              onClick={onTagClick}
            />
          </motion.span>
        ))}
      </AnimatePresence>

      {hiddenCount > 0 && (
        <span className="smart-parsed-tag-more">+{hiddenCount}</span>
      )}
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
}

const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  removable,
  onRemove,
  onClick,
}) => {
  // Get the icon component
  const IconComponent = getIconByName(tag.iconName);

  const handleClick = () => {
    onClick?.(tag);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(tag.id);
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'smart-parsed-tag h-5 rounded-full border-0 px-2 gap-1 group/tag',
        (onClick || removable) && 'cursor-pointer'
      )}
      // Tone (aqua/high/medium/low/neutral) drives the chip's fill + text
      // color entirely from smart-tags.css -- no inline style, no per-instance
      // hex (foundation §1.6). Low-confidence tags fade instead of carrying a
      // separate glyph.
      data-tone={tagTone(tag)}
      data-confidence={tag.confidence < 0.6 ? 'low' : undefined}
      onClick={removable ? handleRemove : handleClick}
      title={`${tag.type}: ${tag.displayText}`}
      aria-label={`${removable ? 'Remove' : 'View'} ${tag.displayText} tag`}
    >
      {/* Icon that becomes X on hover when removable - same as TaskItem */}
      <div className="w-3 h-3 relative" aria-hidden="true">
        <IconComponent className="w-3 h-3 absolute inset-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-0" />
        {removable && (
          <X className="w-3 h-3 absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-100" />
        )}
      </div>

      {/* Text */}
      <span className="text-xs font-medium">{tag.displayText}</span>
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
