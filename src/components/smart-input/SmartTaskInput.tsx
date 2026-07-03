/**
 * Smart Task Input - Main component that combines highlighted input with parsed tags
 * Maintains compatibility with existing TaskInput API
 */

import React, { useState, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FlexInputGroup } from './components/FlexInputGroup';
import { HighlightedInputField } from './components/HighlightedInputField';
import { TaskGroupCombobox } from './components/TaskGroupCombobox';
import { ParsedTags } from './components/ParsedTags';
import { useTextParser } from './hooks/useTextParser';
import { DEFAULT_PRESET_COLOR } from '@/constants/colors';
// Local TaskGroup type (emoji-based)
type TaskGroup = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
};
import { ParsedTag } from '@shared/types';
import { cn } from '@/lib/utils';
import './components/smart-tags.css';

export interface SmartTaskData {
  /** Clean title without parsed elements */
  title: string;
  /** Optional free-text description entered alongside the title */
  description?: string;
  /** Original input text */
  originalInput: string;
  /** Parsed priority level */
  priority?: 'low' | 'medium' | 'high';
  /** Parsed scheduled date */
  scheduledDate?: Date;
  /** All parsed tags */
  tags: ParsedTag[];
  /** Overall parsing confidence */
  confidence: number;
}

export interface SmartTaskInputProps {
  onAddTask: (
    title: string,
    groupId?: string,
    smartData?: SmartTaskData
  ) => void;
  taskGroups?: TaskGroup[];
  activeTaskGroupId?: string;
  onCreateTaskGroup?: () => void;
  onSelectTaskGroup?: (groupId: string) => void;
  disabled?: boolean;
  className?: string;
  /** Whether to enable smart parsing */
  enableSmartParsing?: boolean;
  /**
   * @deprecated The confidence-dot/conflict-banner UI this once gated has
   * been retired (low-confidence tags fade via `data-confidence` instead).
   * Kept only so existing callers stay source-compatible; no longer read.
   */
  showConfidence?: boolean;
  /** Maximum number of tags to display before collapsing the rest into a "+N" counter */
  maxDisplayTags?: number;
  /**
   * @deprecated `FlexInputGroup` + `HighlightedInputField` is now the only
   * render path -- these four flags used to select between five since-deleted
   * variants. Kept only so existing callers stay source-compatible; no
   * longer read.
   */
  useInlineHighlighting?: boolean;
  /** @deprecated see {@link useInlineHighlighting}. */
  useOverlayHighlighting?: boolean;
  /** @deprecated see {@link useInlineHighlighting}. */
  useFlexInputGroup?: boolean;
  /**
   * @deprecated see {@link useInlineHighlighting}. The standalone
   * `EnhancedTaskInput` is the real Compose surface this once duplicated.
   */
  useEnhancedLayout?: boolean;
  /** Custom parsing options */
  parsingOptions?: {
    debounceMs?: number;
    minLength?: number;
  };
}

/**
 * Smart Task Input component with natural language parsing
 */
export const SmartTaskInput: React.FC<SmartTaskInputProps> = ({
  onAddTask,
  taskGroups = [],
  activeTaskGroupId,
  onCreateTaskGroup,
  onSelectTaskGroup,
  disabled = false,
  className = '',
  enableSmartParsing = true,
  maxDisplayTags = 5,
  parsingOptions = {},
}) => {
  const [inputText, setInputText] = useState('');

  // Initialize text parser
  const { error, tags, confidence, clear } = useTextParser(inputText, {
    enabled: enableSmartParsing,
    debounceMs: parsingOptions.debounceMs || 100,
    minLength: parsingOptions.minLength || 2,
  });

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    emoji: '📋',
    color: DEFAULT_PRESET_COLOR,
    description: 'Default task group',
  };

  // Get current active task group
  const activeTaskGroup =
    taskGroups.find((group) => group.id === activeTaskGroupId) ||
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setInputText(value);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Always use the original input text as the title (user's requirement)
      const titleToUse = inputText.trim();

      if (titleToUse) {
        // Capitalize first letter
        const capitalizedTitle =
          titleToUse.charAt(0).toUpperCase() + titleToUse.slice(1);

        // Extract smart data if parsing is enabled
        let smartData: SmartTaskData | undefined;
        if (enableSmartParsing && tags.length > 0) {
          // Extract priority from tags
          const priorityTag = tags.find((tag) => tag.type === 'priority');
          const priority = priorityTag?.value as
            | 'low'
            | 'medium'
            | 'high'
            | undefined;

          // Extract scheduled date from date/time tags
          const dateTag = tags.find(
            (tag) => tag.type === 'date' || tag.type === 'time'
          );
          const scheduledDate = dateTag?.value as Date | undefined;

          smartData = {
            title: capitalizedTitle, // This is the full original title, not cleaned
            originalInput: inputText, // Keep original for metadata
            priority,
            scheduledDate,
            tags,
            confidence,
          };
        }

        // Call onAddTask with smart data
        onAddTask(capitalizedTitle, activeTaskGroup.id, smartData);

        // Clear input and parsing state
        setInputText('');
        clear();
      }
    },
    [
      inputText,
      enableSmartParsing,
      tags,
      confidence,
      onAddTask,
      activeTaskGroup.id,
      clear,
    ]
  );

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  // Handle tag removal
  const handleRemoveTag = useCallback(
    (tagId: string) => {
      // Find the tag to remove
      const tagToRemove = tags.find((tag) => tag.id === tagId);
      if (tagToRemove) {
        // Remove the tag text from the input
        const startIndex = tagToRemove.startIndex;
        const endIndex = tagToRemove.endIndex;

        // Create new text without the removed tag
        const beforeTag = inputText.substring(0, startIndex);
        const afterTag = inputText.substring(endIndex);
        const newText = (beforeTag + afterTag).replace(/\s+/g, ' ').trim();

        // Update input text - this will trigger re-parsing
        setInputText(newText);
      }
    },
    [tags, inputText]
  );

  // Check if we have any content to show
  const hasValidContent = inputText.trim().length > 0;
  const showTags = enableSmartParsing && tags.length > 0 && hasValidContent;

  // Task Group Selector (prefix element) -- shared with Compose (EnhancedTaskInput)
  const taskGroupSelector = (
    <TaskGroupCombobox
      taskGroups={taskGroups}
      activeTaskGroupId={activeTaskGroupId}
      onSelectTaskGroup={onSelectTaskGroup}
      onCreateTaskGroup={onCreateTaskGroup}
      disabled={disabled}
    />
  );

  // Submit Button (suffix element)
  const submitButton = (
    <Button
      type="submit"
      disabled={disabled || !inputText.trim()}
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0"
      aria-label="Add task"
      onClick={handleSubmit}
    >
      <ArrowUp className="w-4 h-4" />
    </Button>
  );

  return (
    <div className={cn('space-y-2', className)}>
      <form onSubmit={handleSubmit}>
        <FlexInputGroup
          prefix={taskGroupSelector}
          suffix={submitButton}
          disabled={disabled}
        >
          {enableSmartParsing ? (
            <HighlightedInputField
              id="smart-task-input-highlighted"
              name="smart-task-input-highlighted"
              value={inputText}
              onChange={handleInputChange}
              tags={tags}
              placeholder="Add task"
              disabled={disabled}
              onKeyPress={handleKeyPress}
            />
          ) : (
            <input
              type="text"
              id="smart-task-input-fallback"
              name="smart-task-input-fallback"
              placeholder="Add task"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled}
              className={cn(
                'h-full w-full border-none outline-none bg-transparent',
                'text-base md:text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
              aria-label="New task input"
            />
          )}
        </FlexInputGroup>
      </form>

      {/* Parsed Tags Display */}
      {showTags && (
        <ParsedTags
          tags={tags}
          removable
          onRemoveTag={handleRemoveTag}
          maxTags={maxDisplayTags}
          className="px-1"
        />
      )}

      {/* Error Display */}
      {error && enableSmartParsing && (
        <div className="text-sm text-destructive px-1">
          Parsing error: {error}
        </div>
      )}
    </div>
  );
};

export default SmartTaskInput;
