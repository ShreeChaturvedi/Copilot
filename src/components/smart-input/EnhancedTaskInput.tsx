/**
 * EnhancedTaskInput - Chat-interface-style task input with advanced features
 * 
 * Professional, spacious input interface inspired by modern chat applications.
 * Features multi-line input, file attachments, voice input, and smart parsing,
 * all contained within a beautiful card-based container.
 * 
 * Key improvements over SmartTaskInput:
 * - Much larger, more spacious design (120px+ min height)
 * - Card-based container with proper shadows and borders
 * - Multi-line textarea that auto-expands
 * - File upload zone with drag-and-drop
 * - Voice input button
 * - All controls contained within the bordered area
 */

import React, { useState, useCallback, useRef } from 'react';
import { ArrowUp, Plus, Paperclip } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useTextParser } from './hooks/useTextParser';
import { SmartTaskData } from './SmartTaskInput';
import { EnhancedTaskInputLayout } from './components/EnhancedTaskInputLayout';
import { SmartParsingToggle } from './components/SmartParsingToggle';
import { TaskGroupCombobox } from './components/TaskGroupCombobox';
import { VoiceInputButton } from './components/VoiceInputButton';
import { TaskGroup } from '../tasks/TaskInput';
import { cn } from '@/lib/utils';

export interface EnhancedTaskInputProps {
  onAddTask: (title: string, groupId?: string, smartData?: SmartTaskData) => void;
  taskGroups?: TaskGroup[];
  activeTaskGroupId?: string;
  onCreateTaskGroup?: () => void;
  onSelectTaskGroup?: (groupId: string) => void;
  disabled?: boolean;
  className?: string;
  enableSmartParsing?: boolean;
  showConfidence?: boolean;
  maxDisplayTags?: number;
  placeholder?: string;
}

/**
 * Enhanced Task Input component with chat-interface design
 */
export const EnhancedTaskInput: React.FC<EnhancedTaskInputProps> = ({
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
  placeholder = "What would you like to work on?"
}) => {
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [smartParsingEnabled, setSmartParsingEnabled] = useState(enableSmartParsing);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Initialize text parser
  const {
    isLoading,
    error,
    tags,
    confidence,
    hasConflicts,
    clear,
  } = useTextParser(inputText, {
    enabled: smartParsingEnabled,
    debounceMs: 100,
    minLength: 2,
  });

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    iconId: 'CheckSquare',
    color: '#3b82f6',
    description: 'Default task group'
  };

  // Get current active task group
  const activeTaskGroup = taskGroups.find(group => group.id === activeTaskGroupId) || 
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setInputText(value);
  }, []);

  // Handle voice transcript (final results)
  const handleVoiceTranscript = useCallback((transcript: string) => {
    // Append voice transcript to existing input text
    const currentText = inputText.trim();
    const newText = currentText 
      ? `${currentText} ${transcript}` 
      : transcript;
    
    setInputText(newText);
    setVoiceTranscript('');
  }, [inputText]);

  // Handle interim voice transcript (real-time feedback)
  const handleInterimTranscript = useCallback((interim: string) => {
    setVoiceTranscript(interim);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    
    const titleToUse = inputText.trim();
    
    if (titleToUse) {
      // Capitalize first letter
      const capitalizedTitle = titleToUse.charAt(0).toUpperCase() + titleToUse.slice(1);
      
      // Extract smart data if parsing is enabled
      let smartData: SmartTaskData | undefined;
      if (smartParsingEnabled && tags.length > 0) {
        const priorityTag = tags.find(tag => tag.type === 'priority');
        const priority = priorityTag?.value as 'low' | 'medium' | 'high' | undefined;
        
        const dateTag = tags.find(tag => tag.type === 'date' || tag.type === 'time');
        const scheduledDate = dateTag?.value as Date | undefined;
        
        smartData = {
          title: capitalizedTitle,
          originalInput: inputText,
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
  }, [inputText, enableSmartParsing, tags, confidence, onAddTask, activeTaskGroup.id, clear]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Get the icon component for the active task group
  const ActiveGroupIcon = (LucideIcons as any)[activeTaskGroup.iconId] || (LucideIcons as any)['CheckSquare'];

  // Check if we have content to submit
  const hasContent = inputText.trim().length > 0;
  const showTags = smartParsingEnabled && tags.length > 0 && hasContent;

  // Task Group Selector using Combobox
  const taskGroupSelector = (
    <TaskGroupCombobox
      taskGroups={taskGroups}
      activeTaskGroupId={activeTaskGroup.id}
      onSelectTaskGroup={onSelectTaskGroup}
      onCreateTaskGroup={onCreateTaskGroup}
      disabled={disabled}
    />
  );

  // Left side controls
  const leftControls = (
    <>
      {taskGroupSelector}
      
      {/* File Attachment Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Attach files</p>
        </TooltipContent>
      </Tooltip>

      {/* Smart Parsing Toggle */}
      <SmartParsingToggle
        pressed={smartParsingEnabled}
        onPressedChange={setSmartParsingEnabled}
        disabled={disabled}
      />
    </>
  );

  // Right side controls - voice input moved here to be next to send button
  const rightControls = (
    <>
      {hasContent && (
        <div className="text-sm text-muted-foreground">
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">⌘</kbd>
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded ml-0.5">⏎</kbd>
          <span className="ml-1">to send</span>
        </div>
      )}
      
      {/* Voice Input Button - moved to right side next to send button */}
      <VoiceInputButton
        onTranscriptChange={handleVoiceTranscript}
        onInterimTranscript={handleInterimTranscript}
        disabled={disabled}
        continuous={false} // Use non-continuous mode to avoid multiple permission requests
        size="sm"
      />
      
      <Button
        type="submit"
        disabled={disabled || !hasContent}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleSubmit}
        aria-label="Add task"
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
    </>
  );

  return (
    <div className={cn('max-w-2xl mx-auto', className)}>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <EnhancedTaskInputLayout
          value={inputText}
          onChange={(value) => setInputText(value)}
          tags={tags}
          placeholder={placeholder}
          disabled={disabled}
          onKeyPress={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          confidence={confidence}
          showConfidence={showConfidence}
          enableSmartParsing={smartParsingEnabled}
          leftControls={leftControls}
          rightControls={rightControls}
          minHeight="60px"
          maxHeight="150px"
          voiceTranscript={voiceTranscript}
        />
      </form>

      {/* Parsed Tags Display - Below the input */}
      {showTags && (
        <div className="mt-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Detected:</span>
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, maxDisplayTags).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={cn(
                    "text-xs h-5 px-2 gap-1 border-border/50",
                    tag.color && `border-[${tag.color}]/30 text-[${tag.color}]`
                  )}
                  style={tag.color ? { 
                    borderColor: `${tag.color}30`, 
                    color: tag.color 
                  } : undefined}
                >
                  {tag.displayText}
                </Badge>
              ))}
              {tags.length > maxDisplayTags && (
                <Badge variant="outline" className="text-xs h-5 px-2">
                  +{tags.length - maxDisplayTags} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && smartParsingEnabled && (
        <div className="mt-2 px-1">
          <div className="text-sm text-destructive">
            Parsing error: {error}
          </div>
        </div>
      )}

      {/* Conflicts Warning */}
      {hasConflicts && smartParsingEnabled && showConfidence && (
        <div className="mt-2 px-1">
          <div className="text-sm text-yellow-600 flex items-center gap-1">
            <LucideIcons.AlertTriangle className="w-3 h-3" />
            Some tags may overlap. Using highest confidence matches.
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTaskInput;