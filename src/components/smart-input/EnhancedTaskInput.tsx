/**
 * EnhancedTaskInput - Chat-interface-style task input with advanced features
 *
 * Professional, spacious input interface inspired by modern chat applications.
 * Features multi-line input, file attachments, voice input, and smart parsing,
 * all contained within a beautiful card-based container.
 *
 * Key improvements over SmartTaskInput:
 * - Much larger, more spacious design (120px+ min height)
 * - Floating-tier container with proper shadow and machined edge
 * - Multi-line textarea that auto-expands
 * - File upload zone with drag-and-drop
 * - Voice input button
 * - All controls contained within the bordered area
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { ArrowUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { ALL_ACCEPTED_FILES } from '@shared/config/fileTypes';
//

import { Button } from '@/components/ui/Button';
import { Keycap } from '@/components/ui/Keycap';
import { useTextParser } from './hooks/useTextParser';
import { SmartTaskData } from './SmartTaskInput';
import { EnhancedTaskInputLayout } from './components/EnhancedTaskInputLayout';
import { SmartParsingToggle } from './components/SmartParsingToggle';
import { TaskGroupCombobox } from './components/TaskGroupCombobox';
import { VoiceInputButton } from './components/VoiceInputButton';
import { FileUploadButton } from './components/FileUploadButton';
import { CompactFilePreview } from './components/CompactFilePreview';
import { UploadedFile } from './components/FileUploadZone';
import { DEFAULT_PRESET_COLOR } from '@/constants/colors';
type TaskGroup = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
};
import { cn } from '@/lib/utils';
import { DueDateBadge } from '@/components/tasks/DueDateBadge';
import {
  buildAttachmentPreview,
  compressImageIfNeeded,
} from './lib/attachmentPreview';

export interface EnhancedTaskInputProps {
  onAddTask: (
    title: string,
    groupId?: string,
    smartData?: SmartTaskData
  ) => void;
  onAddTaskWithFiles?: (
    title: string,
    groupId?: string,
    smartData?: SmartTaskData,
    files?: UploadedFile[]
  ) => void;
  taskGroups?: TaskGroup[];
  activeTaskGroupId?: string;
  onCreateTaskGroup?: () => void;
  onSelectTaskGroup?: (groupId: string) => void;
  disabled?: boolean;
  className?: string;
  enableSmartParsing?: boolean;
  /**
   * @deprecated The confidence-dot/conflict-banner UI this once gated has
   * been retired. Kept only so existing callers stay source-compatible; no
   * longer read.
   */
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
  // maxDisplayTags = 5,
  placeholder = 'What would you like to work on?',
  onFilesAdded,
  maxFiles = 5,
  enableFileUpload = true,
}) => {
  const [inputText, setInputText] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [smartParsingEnabled, setSmartParsingEnabled] =
    useState(enableSmartParsing);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const baseTextRef = useRef('');
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  // Track tags the user dismissed (we hide these without modifying the input text)
  const [dismissedTagSignatures, setDismissedTagSignatures] = useState<
    Set<string>
  >(new Set());
  // Manual due date state for this input session
  const [manualDueDate, setManualDueDate] = useState<Date | undefined>(
    undefined
  );

  // Initialize text parser
  const {
    tags: parsedTags,
    confidence,
    clear,
  } = useTextParser(inputText, {
    // If manual due date is set, suppress date/time detection but allow other tags
    enabled: smartParsingEnabled,
    debounceMs: 100,
    minLength: 2,
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

  // Handle voice transcript (final results)
  const handleVoiceTranscript = useCallback((transcript: string) => {
    const newText = baseTextRef.current
      ? `${baseTextRef.current} ${transcript}`
      : transcript;
    setInputText(newText);
  }, []);

  // Handle interim voice transcript (real-time feedback)
  const handleInterimTranscript = useCallback((interim: string) => {
    const newText = baseTextRef.current
      ? `${baseTextRef.current} ${interim}`
      : interim;
    setInputText(newText);
  }, []);

  // Handle recording state changes
  const handleRecordingStateChange = useCallback(
    (recording: boolean) => {
      setIsRecording(recording);
      if (recording) {
        baseTextRef.current = inputText.trim();
      }
    },
    [inputText]
  );

  // Handle file uploads
  const handleFilesAdded = useCallback(
    async (files: File[]) => {
      const processed = await Promise.all(
        files.map(async (f) => await compressImageIfNeeded(f))
      );

      const newUploadedFiles: UploadedFile[] = await Promise.all(
        processed.map(async (file) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'completed' as const,
          preview: await buildAttachmentPreview(file),
        }))
      );

      setUploadedFiles((prev) => {
        const updated = [...prev, ...newUploadedFiles];
        if (onFilesAdded) onFilesAdded(updated);
        return updated;
      });
    },
    [onFilesAdded]
  );

  // Handle file removal
  const handleFileRemove = useCallback(
    (fileId: string) => {
      setUploadedFiles((prev) => {
        const updated = prev.filter((file) => file.id !== fileId);

        // Clean up object URLs for removed image previews
        const removedFile = prev.find((file) => file.id === fileId);
        if (removedFile?.preview && removedFile.preview.startsWith('blob:')) {
          URL.revokeObjectURL(removedFile.preview);
        }

        // Notify parent component if callback provided
        if (onFilesAdded) {
          onFilesAdded(updated);
        }

        return updated;
      });
    },
    [onFilesAdded]
  );

  // Drop-to-attach on the composer card itself. Chat-style composers are
  // expected to accept a file dropped anywhere on them; the paperclip/dialog
  // stays for click-to-browse. noClick/noKeyboard so this only handles drops
  // and never intercepts typing or focus, reusing handleFilesAdded + limits.
  const dropDisabled =
    disabled || !enableFileUpload || uploadedFiles.length >= maxFiles;
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: (accepted: File[]) => {
        if (accepted.length > 0) handleFilesAdded(accepted);
      },
      accept: ALL_ACCEPTED_FILES,
      maxFiles: maxFiles - uploadedFiles.length,
      disabled: dropDisabled,
      noClick: true,
      noKeyboard: true,
    });

  // Create a stable signature for a tag to support dismissal without changing input text
  const makeTagSignature = useCallback(
    (t: { type: string; originalText: string; startIndex: number }) => {
      return `${t.type}|${t.originalText}|${t.startIndex}`;
    },
    []
  );

  // Derived: tags after applying user dismissals (used for highlighting, UI, and submission)
  const filteredTags = useMemo(() => {
    // Always hide date/time tags from the inline tag list; the Due Date badge replaces them
    const base = (parsedTags || []).filter(
      (t) => t.type !== 'date' && t.type !== 'time'
    );
    if (dismissedTagSignatures.size === 0) return base;
    return base.filter((t) => !dismissedTagSignatures.has(makeTagSignature(t)));
  }, [parsedTags, dismissedTagSignatures, makeTagSignature]);

  // Tags for the inline highlight overlay: keep date/time (so the typed date
  // lights up aqua under the text, matching the Due Date badge) while the chip
  // row keeps using the date-stripped `filteredTags`.
  const highlightTags = useMemo(() => {
    const base = parsedTags || [];
    if (dismissedTagSignatures.size === 0) return base;
    return base.filter((t) => !dismissedTagSignatures.has(makeTagSignature(t)));
  }, [parsedTags, dismissedTagSignatures, makeTagSignature]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      const titleToUse = inputText.trim();

      if (titleToUse) {
        // Capitalize first letter
        const capitalizedTitle =
          titleToUse.charAt(0).toUpperCase() + titleToUse.slice(1);

        // Free-text description entered in the secondary field.
        const description = descriptionText.trim() || undefined;

        // Extract smart data if parsing is enabled
        let smartData: SmartTaskData | undefined;
        if (smartParsingEnabled && filteredTags.length > 0) {
          const priorityTag = filteredTags.find(
            (tag) => tag.type === 'priority'
          );
          const priority = priorityTag?.value as
            | 'low'
            | 'medium'
            | 'high'
            | undefined;

          const parsedDateTag = parsedTags?.find(
            (tag) => tag.type === 'date' || tag.type === 'time'
          );
          const scheduledDate =
            manualDueDate || (parsedDateTag?.value as Date | undefined);

          smartData = {
            title: capitalizedTitle,
            description,
            originalInput: inputText,
            priority,
            scheduledDate,
            tags: filteredTags,
            confidence,
          };
        } else if (description) {
          // No parsed tags but the user typed a description -- still carry it
          // through so it persists.
          smartData = {
            title: capitalizedTitle,
            description,
            originalInput: inputText,
            tags: [],
            confidence: 0,
          };
        }

        // Prefer file-aware callback if provided
        if (onAddTaskWithFiles) {
          onAddTaskWithFiles(
            capitalizedTitle,
            activeTaskGroup.id,
            smartData,
            uploadedFiles
          );
        } else {
          onAddTask(capitalizedTitle, activeTaskGroup.id, smartData);
        }

        // Clear input and parsing state
        setInputText('');
        setDescriptionText('');
        setUploadedFiles([]);
        clear();
        setDismissedTagSignatures(new Set());
        setManualDueDate(undefined);

        // Return focus to the title field so rapid keyboard entry continues.
        // Submitting from the description field otherwise drops focus to
        // <body> (that field goes aria-hidden/tabIndex -1 once the text
        // clears), stalling the next keystroke.
        requestAnimationFrame(() => {
          document.getElementById('enhanced-task-input-textarea')?.focus();
        });
      }
    },
    [
      inputText,
      descriptionText,
      smartParsingEnabled,
      filteredTags,
      confidence,
      onAddTask,
      onAddTaskWithFiles,
      uploadedFiles,
      activeTaskGroup.id,
      clear,
      parsedTags,
      manualDueDate,
    ]
  );

  // Handle key press in title field: Enter sends; Shift+Enter focuses description
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [handleSubmit, inputText]
  );

  // Handle key press in description field: Enter sends
  const handleDescriptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Check if we have content to submit (only finalized text, not interim)
  const hasContent = inputText.trim().length > 0;
  const showTags = smartParsingEnabled && filteredTags.length > 0 && hasContent;

  // Compute auto-detected due date (only if no manual due date)
  const autoDueTag = useMemo(() => {
    if (manualDueDate) return undefined;
    const dt = parsedTags?.find((t) => t.type === 'date' || t.type === 'time');
    return dt;
  }, [parsedTags, manualDueDate]);

  // Normalize auto-detected date to midnight when it's a date-only tag (no explicit time)
  const effectiveDueDate = useMemo(() => {
    if (manualDueDate) return manualDueDate;
    if (!autoDueTag) return undefined;
    const raw = autoDueTag.value as Date | undefined;
    if (!raw) return undefined;
    if (autoDueTag.type === 'date') {
      const normalized = new Date(raw);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    }
    return raw;
  }, [manualDueDate, autoDueTag]);

  // File preview component
  const filePreview = useMemo(
    () =>
      uploadedFiles.length > 0 ? (
        <CompactFilePreview
          files={uploadedFiles}
          onFileRemove={handleFileRemove}
          disabled={disabled}
        />
      ) : null,
    [uploadedFiles, handleFileRemove, disabled]
  );

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

  // Left side controls: list picker, then a hairline divider, then the
  // attach/parse pair -- "which list" and "how you're attaching/parsing"
  // are two different clusters, not one undifferentiated group.
  const leftControls = (
    <>
      {taskGroupSelector}

      <span className="w-px self-stretch my-1 bg-hairline" aria-hidden="true" />

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
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Keycap>⇧</Keycap>
          <Keycap>⏎</Keycap>
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
  const handleRemoveInlineTag = useCallback(
    (tagId: string) => {
      const tagToRemove = filteredTags.find((t) => t.id === tagId);
      if (!tagToRemove) return;
      setDismissedTagSignatures((prev) => {
        const next = new Set(prev);
        next.add(makeTagSignature(tagToRemove));
        return next;
      });
    },
    [filteredTags, makeTagSignature]
  );

  return (
    <div
      {...getRootProps({
        className: cn(
          'max-w-2xl mx-auto rounded-2xl transition-colors',
          isDragActive &&
            !isDragReject &&
            'ring-2 ring-aqua ring-offset-2 ring-offset-transparent bg-aqua-film-04',
          isDragReject && 'ring-2 ring-destructive',
          className
        ),
      })}
    >
      <input {...getInputProps()} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <EnhancedTaskInputLayout
          value={inputText}
          onChange={setInputText}
          tags={filteredTags}
          highlightTags={highlightTags}
          placeholder={placeholder}
          disabled={disabled}
          onKeyPress={handleKeyDown}
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
          customTagRow={
            <DueDateBadge
              taskId="new-task"
              date={effectiveDueDate}
              onChange={(next) => {
                setManualDueDate(next);
              }}
              emptyLabel="Due Date"
            />
          }
        />
      </form>

      {/* External tag display removed; tags shown inline under textarea to prevent layout shift */}

      {/* Announce parse results to screen readers. The chips are a purely
          visual signal; this sr-only live region speaks what was detected as
          the user types so the feature's core affordance isn't sight-only. */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {smartParsingEnabled && hasContent && highlightTags.length > 0
          ? `${highlightTags.length} tag${highlightTags.length === 1 ? '' : 's'} detected: ${highlightTags
              .map((t) => t.displayText)
              .join(', ')}`
          : ''}
      </div>
    </div>
  );
};

export default EnhancedTaskInput;
