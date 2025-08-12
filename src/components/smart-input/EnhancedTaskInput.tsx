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

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { ArrowUp } from 'lucide-react';
//

import { Button } from '@/components/ui/Button';
import { useTextParser } from './hooks/useTextParser';
import { SmartTaskData } from './SmartTaskInput';
import { EnhancedTaskInputLayout } from './components/EnhancedTaskInputLayout';
import { SmartParsingToggle } from './components/SmartParsingToggle';
import { TaskGroupCombobox } from './components/TaskGroupCombobox';
import { VoiceInputButton } from './components/VoiceInputButton';
import { FileUploadButton } from './components/FileUploadButton';
import { CompactFilePreview } from './components/CompactFilePreview';
import { UploadedFile } from './components/FileUploadZone';
type TaskGroup = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
};
import { cn } from '@/lib/utils';

export interface EnhancedTaskInputProps {
  onAddTask: (title: string, groupId?: string, smartData?: SmartTaskData) => void;
  onAddTaskWithFiles?: (title: string, groupId?: string, smartData?: SmartTaskData, files?: UploadedFile[]) => void;
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
  /** Callback when files are attached */
  onFilesAdded?: (files: UploadedFile[]) => void;
  /** Maximum number of files allowed */
  maxFiles?: number;
  /** Whether file upload is enabled */
  enableFileUpload?: boolean;
}

/**
 * Enhanced Task Input component with chat-interface design
 */
export const EnhancedTaskInput: React.FC<EnhancedTaskInputProps> = ({
  onAddTask,
  onAddTaskWithFiles,
  taskGroups = [],
  activeTaskGroupId,
  onCreateTaskGroup,
  onSelectTaskGroup,
  disabled = false,
  className = '',
  enableSmartParsing = true,
  showConfidence = false,
  // maxDisplayTags = 5,
  placeholder = "What would you like to work on?",
  onFilesAdded,
  maxFiles = 5,
  enableFileUpload = true
}) => {
  const [inputText, setInputText] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [smartParsingEnabled, setSmartParsingEnabled] = useState(enableSmartParsing);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [, setIsFocused] = useState(false); // State maintained for potential future focus styling
  const baseTextRef = useRef('');
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  // Track tags the user dismissed (we hide these without modifying the input text)
  const [dismissedTagSignatures, setDismissedTagSignatures] = useState<Set<string>>(new Set());

  // Initialize text parser
  const {
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
    emoji: '📋',
    color: '#3b82f6',
    description: 'Default task group'
  };

  // Get current active task group
  const activeTaskGroup = taskGroups.find(group => group.id === activeTaskGroupId) || 
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Handle voice transcript (final results)
  const handleVoiceTranscript = useCallback((transcript: string) => {
    const newText = baseTextRef.current ? `${baseTextRef.current} ${transcript}` : transcript;
    setInputText(newText);
  }, []);

  // Handle interim voice transcript (real-time feedback)
  const handleInterimTranscript = useCallback((interim: string) => {
    const newText = baseTextRef.current ? `${baseTextRef.current} ${interim}` : interim;
    setInputText(newText);
  }, []);

  // Handle recording state changes
  const handleRecordingStateChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
    if (recording) {
      baseTextRef.current = inputText.trim();
    }
  }, [inputText]);

  // Handle file uploads
  const handleFilesAdded = useCallback(async (files: File[]) => {
    const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const newUploadedFiles: UploadedFile[] = await Promise.all(
      files.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'completed' as const,
        // Use data URL for all files so backend can persist a URL immediately
        preview: await readAsDataUrl(file),
      }))
    );

    setUploadedFiles((prev) => {
      const updated = [...prev, ...newUploadedFiles];
      // Notify parent component if callback provided
      if (onFilesAdded) onFilesAdded(updated);
      return updated;
    });
  }, [onFilesAdded]);

  // Handle file removal
  const handleFileRemove = useCallback((fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(file => file.id !== fileId);
      
      // Clean up object URLs for removed image previews
      const removedFile = prev.find(file => file.id === fileId);
      if (removedFile?.preview && removedFile.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removedFile.preview);
      }
      
      // Notify parent component if callback provided
      if (onFilesAdded) {
        onFilesAdded(updated);
      }
      
      return updated;
    });
  }, [onFilesAdded]);

  // Create a stable signature for a tag to support dismissal without changing input text
  const makeTagSignature = useCallback((t: { type: string; originalText: string; startIndex: number }) => {
    return `${t.type}|${t.originalText}|${t.startIndex}`;
  }, []);

  // Derived: tags after applying user dismissals (used for highlighting, UI, and submission)
  const filteredTags = useMemo(() => {
    if (!tags || dismissedTagSignatures.size === 0) return tags;
    return tags.filter((t) => !dismissedTagSignatures.has(makeTagSignature(t)));
  }, [tags, dismissedTagSignatures, makeTagSignature]);

  // Handle form submission
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    
    const titleToUse = inputText.trim();
    
    if (titleToUse) {
      // Capitalize first letter
      const capitalizedTitle = titleToUse.charAt(0).toUpperCase() + titleToUse.slice(1);
      
      // Extract smart data if parsing is enabled
      let smartData: SmartTaskData | undefined;
      if (smartParsingEnabled && filteredTags.length > 0) {
        const priorityTag = filteredTags.find(tag => tag.type === 'priority');
        const priority = priorityTag?.value as 'low' | 'medium' | 'high' | undefined;
        
        const dateTag = filteredTags.find(tag => tag.type === 'date' || tag.type === 'time');
        const scheduledDate = dateTag?.value as Date | undefined;
        
        smartData = {
          title: capitalizedTitle,
          originalInput: inputText,
          priority,
          scheduledDate,
          tags: filteredTags,
          confidence,
        };
      }
      
      // Prefer file-aware callback if provided
      if (onAddTaskWithFiles) {
        onAddTaskWithFiles(capitalizedTitle, activeTaskGroup.id, smartData, uploadedFiles);
      } else {
        onAddTask(capitalizedTitle, activeTaskGroup.id, smartData);
      }
      
      // Clear input and parsing state
      setInputText('');
      setDescriptionText('');
      setUploadedFiles([]);
      clear();
      setDismissedTagSignatures(new Set());
    }
  }, [inputText, smartParsingEnabled, filteredTags, confidence, onAddTask, onAddTaskWithFiles, uploadedFiles, activeTaskGroup.id, clear]);

  // Handle key press in title field: Enter sends; Shift+Enter focuses description
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      // Only focus description when enabled (after user typed in title)
      if (inputText.trim().length > 0) {
        descriptionInputRef.current?.focus();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, inputText]);

  // Handle key press in description field: Enter sends
  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Check if we have content to submit (only finalized text, not interim)
  const hasContent = inputText.trim().length > 0;
  const showTags = smartParsingEnabled && filteredTags.length > 0 && hasContent;
  
  // File preview component
  const filePreview = useMemo(() => (
    uploadedFiles.length > 0 ? (
      <CompactFilePreview
        files={uploadedFiles}
        onFileRemove={handleFileRemove}
        disabled={disabled}
      />
    ) : null
  ), [uploadedFiles, handleFileRemove, disabled]);

  // Task Group Selector using Combobox
  const taskGroupSelector = (
    <TaskGroupCombobox
      taskGroups={taskGroups as any}
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
      
      {/* File Upload Button */}
      {enableFileUpload && (
        <FileUploadButton
          files={uploadedFiles}
          onFilesAdded={handleFilesAdded}
          onFileRemove={handleFileRemove}
          maxFiles={maxFiles}
          disabled={disabled}
          size="sm"
        />
      )}

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
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded">⇧</kbd>
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded ml-0.5">⏎</kbd>
          <span className="ml-1">for description</span>
        </div>
      )}
      
      {/* Voice Input Button - moved to right side next to send button */}
      <VoiceInputButton
        onTranscriptChange={handleVoiceTranscript}
        onInterimTranscript={handleInterimTranscript}
        onRecordingStateChange={handleRecordingStateChange}
        disabled={disabled}
        continuous={false} // Use non-continuous mode for single task input
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

  // Remove a tag visually (do not alter input text). Hide tag and its highlight.
  const handleRemoveInlineTag = useCallback((tagId: string) => {
    const tagToRemove = tags.find((t) => t.id === tagId);
    if (!tagToRemove) return;
    setDismissedTagSignatures((prev) => {
      const next = new Set(prev);
      next.add(makeTagSignature(tagToRemove));
      return next;
    });
  }, [tags, makeTagSignature]);

  return (
    <div className={cn('max-w-2xl mx-auto', className)}>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <EnhancedTaskInputLayout
          value={inputText}
          onChange={setInputText}
          tags={filteredTags}
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
          // Force one-line height for title field
          minHeight="28px"
          maxHeight="28px"
          isRecording={isRecording}
          filePreview={filePreview}
          showInlineTags={showTags}
          inlineTagsRemovable={true}
          onInlineTagRemove={handleRemoveInlineTag}
          // Visual-only description field
          secondaryValue={descriptionText}
          onSecondaryChange={setDescriptionText}
          secondaryPlaceholder="description"
          onSecondaryKeyDown={handleDescriptionKeyDown}
          secondaryInputRef={descriptionInputRef}
          secondaryEnabled={hasContent}
        />
      </form>

      {/* External tag display removed; tags shown inline under textarea to prevent layout shift */}

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
            <span className="w-3 h-3 inline-block rounded-full bg-yellow-500" />
            Some tags may overlap. Using highest confidence matches.
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTaskInput;