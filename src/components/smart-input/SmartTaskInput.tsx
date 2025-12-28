/**
 * Smart Task Input - Main component that combines highlighted input with parsed tags
 * Maintains compatibility with existing TaskInput API
 */

import React, { useState, useCallback } from 'react';
import { ArrowUp, Plus } from 'lucide-react';
// import { getIconByName } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HighlightedInput } from './components/HighlightedInput';
import { InlineHighlightedInput } from './components/InlineHighlightedInput';
import { OverlayHighlightedInput } from './components/OverlayHighlightedInput';
import { FlexInputGroup } from './components/FlexInputGroup';
import { HighlightedInputField } from './components/HighlightedInputField';
import { EnhancedTaskInputLayout } from './components/EnhancedTaskInputLayout';
import { VoiceInputButton } from './components/VoiceInputButton';
import { ParsedTags } from './components/ParsedTags';
import { useTextParser } from './hooks/useTextParser';
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
  /** Whether to show parsing confidence */
  showConfidence?: boolean;
  /** Maximum number of tags to display */
  maxDisplayTags?: number;
  /** Feature flag: Use new inline highlighting instead of overlay */
  useInlineHighlighting?: boolean;
  /** Feature flag: Use proper overlay technique */
  useOverlayHighlighting?: boolean;
  /** Feature flag: Use new flexbox input group architecture */
  useFlexInputGroup?: boolean;
  /** Feature flag: Use enhanced Claude AI-style layout */
  useEnhancedLayout?: boolean;
  /** Custom parsing options */
  parsingOptions?: {
    debounceMs?: number;
    minLength?: number;
  };
  /** Hide focus outline/ring around the input group when focused */
  hideFocusOutline?: boolean;
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
  showConfidence = false,
  maxDisplayTags = 5,
  useInlineHighlighting = false, // Disable broken implementation
  useOverlayHighlighting = false, // Disable absolute positioning approach
  useFlexInputGroup = true, // Enable new flexbox architecture
  useEnhancedLayout = false, // Feature flag for enhanced layout
  parsingOptions = {},
  hideFocusOutline = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [, setVoiceTranscript] = useState(''); // Voice transcript state maintained for potential future use

  // Initialize text parser
  const { isLoading, error, tags, confidence, hasConflicts, clear } =
    useTextParser(inputText, {
      enabled: enableSmartParsing,
      debounceMs: parsingOptions.debounceMs || 100,
      minLength: parsingOptions.minLength || 2,
    });

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    emoji: '📋',
    color: '#3b82f6',
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

  // Handle voice transcript (final results)
  const handleVoiceTranscript = useCallback((transcript: string) => {
    // Use functional update to avoid dependency on inputText
    setInputText((prevText) => {
      const currentText = prevText.trim();
      const newText = currentText ? `${currentText} ${transcript}` : transcript;
      return newText;
    });

    setVoiceTranscript('');
  }, []);

  // Handle interim voice transcript (real-time feedback)
  const handleInterimTranscript = useCallback((interim: string) => {
    setVoiceTranscript(interim);
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
        setVoiceTranscript('');
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

  // Handle tag click
  const handleTagClick = useCallback((_tag: ParsedTag) => {
    // TODO: Open tag editor or show tag details
  }, []);

  // Get the icon component for the active task group
  // Emoji replaces icon component for task groups

  // Check if we have any content to show
  const hasValidContent = inputText.trim().length > 0;
  const showTags = enableSmartParsing && tags.length > 0 && hasValidContent;

  // Task Group Selector (prefix element)
  const taskGroupSelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={`Current task group: ${activeTaskGroup.name}`}
        >
          <span className="text-base" style={{ color: activeTaskGroup.color }}>
            {activeTaskGroup.emoji}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {taskGroups.map((group) => (
          <DropdownMenuItem
            key={group.id}
            onClick={() => onSelectTaskGroup?.(group.id)}
            className={activeTaskGroup.id === group.id ? 'bg-accent' : ''}
          >
            <span className="mr-2 text-base" style={{ color: group.color }}>
              {group.emoji}
            </span>
            <span>{group.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {/* New List Option */}
        <DropdownMenuItem
          onClick={() => onCreateTaskGroup?.()}
          className="text-success hover:text-success hover:bg-success/10 focus:text-success focus:bg-success/10"
        >
          <Plus className="mr-2 h-4 w-4 text-success" />
          <span>New List</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Submit Button (suffix element)
  const submitButton = (
    <div className="relative">
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

      {/* Loading indicator */}
      {isLoading && enableSmartParsing && (
        <div className="absolute -left-8 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );

  // Right controls for enhanced layout (voice input + submit button)
  const rightControls = useEnhancedLayout ? (
    <>
      {/* Voice Input Button - positioned to the left of submit button */}
      <VoiceInputButton
        onTranscriptChange={handleVoiceTranscript}
        onInterimTranscript={handleInterimTranscript}
        disabled={disabled}
        continuous={false} // Use non-continuous mode to avoid multiple permission requests
        size="sm"
      />
      {submitButton}
    </>
  ) : (
    submitButton
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* Enhanced Claude AI-style layout */}
      {useEnhancedLayout ? (
        <form onSubmit={handleSubmit}>
          <EnhancedTaskInputLayout
            value={inputText}
            onChange={handleInputChange}
            tags={tags}
            placeholder="Add Task"
            disabled={disabled}
            onKeyPress={handleKeyPress}
            confidence={confidence}
            showConfidence={showConfidence}
            enableSmartParsing={enableSmartParsing}
            leftControls={taskGroupSelector}
            rightControls={rightControls}
            minHeight="120px"
            maxHeight="300px"
          />
        </form>
      ) : /* Main input form using new FlexInputGroup architecture */
      useFlexInputGroup ? (
        <form onSubmit={handleSubmit}>
          <FlexInputGroup
            prefix={taskGroupSelector}
            suffix={submitButton}
            disabled={disabled}
            hideFocusOutline={hideFocusOutline}
          >
            {enableSmartParsing ? (
              <HighlightedInputField
                id="smart-task-input-highlighted"
                name="smart-task-input-highlighted"
                value={inputText}
                onChange={handleInputChange}
                tags={tags}
                placeholder="Add Task"
                disabled={disabled}
                onKeyPress={handleKeyPress}
                confidence={confidence}
                showConfidence={showConfidence}
              />
            ) : (
              <input
                type="text"
                id="smart-task-input-fallback"
                name="smart-task-input-fallback"
                placeholder="Add Task"
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
      ) : (
        // Legacy form structure (for fallback)
        <form onSubmit={handleSubmit} className="relative">
          {/* Task Group Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 z-10"
                aria-label={`Current task group: ${activeTaskGroup.name}`}
              >
                <span
                  className="text-base"
                  style={{ color: activeTaskGroup.color }}
                >
                  {activeTaskGroup.emoji}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {taskGroups.map((group) => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => onSelectTaskGroup?.(group.id)}
                  className={activeTaskGroup.id === group.id ? 'bg-accent' : ''}
                >
                  <span
                    className="mr-2 text-base"
                    style={{ color: group.color }}
                  >
                    {group.emoji}
                  </span>
                  <span>{group.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {/* New List Option */}
              <DropdownMenuItem
                onClick={() => onCreateTaskGroup?.()}
                className="text-success hover:text-success hover:bg-success/10 focus:text-success focus:bg-success/10"
              >
                <Plus className="mr-2 h-4 w-4 text-success" />
                <span>New List</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Smart Input */}
          {enableSmartParsing ? (
            useOverlayHighlighting ? (
              <OverlayHighlightedInput
                value={inputText}
                onChange={handleInputChange}
                tags={tags}
                placeholder="Add Task"
                disabled={disabled}
                onKeyPress={handleKeyPress}
                confidence={confidence}
                showConfidence={showConfidence}
                className="pl-10 pr-12 border-input"
              />
            ) : useInlineHighlighting ? (
              <InlineHighlightedInput
                value={inputText}
                onChange={handleInputChange}
                tags={tags}
                placeholder="Add Task"
                disabled={disabled}
                onKeyPress={handleKeyPress}
                confidence={confidence}
                showConfidence={showConfidence}
                className="pl-10 pr-12 border-input"
              />
            ) : (
              <HighlightedInput
                value={inputText}
                onChange={handleInputChange}
                tags={tags}
                placeholder="Add Task"
                disabled={disabled}
                onKeyPress={handleKeyPress}
                confidence={confidence}
                showConfidence={showConfidence}
                className="pl-10 pr-12 border-input"
              />
            )
          ) : (
            <input
              type="text"
              id="legacy-task-input"
              name="legacy-task-input"
              placeholder="Add Task"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled}
              className={cn(
                'w-full pl-10 pr-12 border-input rounded-md',
                'px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
              aria-label="New task input"
            />
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={disabled || !inputText.trim()}
            size="sm"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            aria-label="Add task"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>

          {/* Loading indicator */}
          {isLoading && enableSmartParsing && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 z-10">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </form>
      )}

      {/* Parsed Tags Display */}
      {showTags && (
        <ParsedTags
          tags={tags}
          removable={false}
          onRemoveTag={handleRemoveTag}
          onTagClick={handleTagClick}
          showConfidence={showConfidence}
          maxTags={maxDisplayTags}
          className="px-1"
        />
      )}

      {/* Error Display */}
      {error && enableSmartParsing && (
        <div className="text-sm text-red-500 px-1">Parsing error: {error}</div>
      )}

      {/* Conflicts Warning */}
      {hasConflicts && enableSmartParsing && showConfidence && (
        <div className="text-sm text-yellow-600 px-1 flex items-center gap-1">
          {/* Simple marker without importing the full icon set dynamically */}
          <span className="w-3 h-3 inline-block rounded-full bg-yellow-500" />
          Some tags may overlap. Using highest confidence matches.
        </div>
      )}
    </div>
  );
};

export default SmartTaskInput;
