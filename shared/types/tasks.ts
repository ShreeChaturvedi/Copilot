/**
 * Task management type definitions
 */

/**
 * Priority levels for tasks
 */
export type Priority = 'low' | 'medium' | 'high';

/**
 * Task completion status
 */
export type TaskStatus = 'pending' | 'completed' | 'cancelled';

/**
 * Represents a task in the to-do system
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;
  /** Task title/description */
  title: string;
  /** Whether the task is completed */
  completed: boolean;
  /** When the task was created (stored in UTC) */
  createdAt: Date;
  /** When the task was last updated */
  updatedAt?: Date;
  /** When the task was completed */
  completedAt?: Date;
  /** Optional scheduled date for the task (stored in UTC) */
  scheduledDate?: Date;
  /** Optional priority level */
  priority?: Priority;
  /** Task list ID this task belongs to */
  taskListId?: string;
  /** User ID who owns this task */
  userId?: string;
  /** Optional tags extracted from smart parsing */
  tags?: TaskTag[];
  /** Optional metadata from smart parsing */
  parsedMetadata?: ParsedMetadata;
  /** File attachments associated with the task */
  attachments?: FileAttachment[];
  /** Voice note attachment */
  voiceNote?: VoiceAttachment;
  /** Rich text description with HTML content */
  richDescription?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
}

/**
 * Task List - Organizational container for tasks
 */
export interface TaskList {
  /** Unique identifier for the task list */
  id: string;
  /** Display name of the task list */
  name: string;
  /** Color associated with the task list */
  color: string;
  /** Icon identifier (lucide icon name) */
  icon: string;
  /** Number of tasks in this list */
  taskCount: number;
  /** Whether this task list is visible in the UI */
  isVisible: boolean;
  /** Optional description */
  description?: string;
  /** User ID who owns this task list */
  userId: string;
  /** When the task list was created */
  createdAt: Date;
  /** When the task list was last updated */
  updatedAt: Date;
}

/**
 * Smart Parsing System Types
 */

/**
 * Tag types for categorizing parsed content
 */
export type TagType = 'date' | 'time' | 'priority' | 'location' | 'person' | 'label' | 'project';

/**
 * Represents a tag/label extracted from task input
 */
export interface TaskTag {
  /** Unique identifier for the tag */
  id: string;
  /** Type of tag */
  type: TagType;
  /** Parsed value (typed based on tag type) */
  value: string | Date | Priority;
  /** Display text for the tag */
  displayText: string;
  /** Lucide icon name for the tag */
  iconName: string;
  /** Optional color for the tag */
  color?: string;
}

/**
 * Represents a parsed tag with position information
 */
export interface ParsedTag extends TaskTag {
  /** Start position in original text */
  startIndex: number;
  /** End position in original text */
  endIndex: number;
  /** Original text that was parsed */
  originalText: string;
  /** Parser confidence (0-1) */
  confidence: number;
  /** Which parser detected this tag */
  source: string;
}

/**
 * Parsed metadata from smart parsing
 */
export interface ParsedMetadata {
  /** Original input text */
  originalInput: string;
  /** Cleaned title after parsing */
  cleanTitle: string;
  /** Parsing confidence score */
  confidence?: number;
  /** Parser that processed this input */
  parsedBy?: string;
}

/**
 * Result of parsing task input text
 */
export interface ParseResult {
  /** Text with parsed elements removed */
  cleanText: string;
  /** Detected tags with positions */
  tags: ParsedTag[];
  /** Overall parsing confidence */
  confidence: number;
  /** Overlapping detections that need resolution */
  conflicts: Conflict[];
}

/**
 * Represents a conflict between overlapping parsers
 */
export interface Conflict {
  /** Start position of conflict */
  startIndex: number;
  /** End position of conflict */
  endIndex: number;
  /** Conflicting tags */
  tags: ParsedTag[];
  /** Resolved tag (highest confidence wins) */
  resolved?: ParsedTag;
}

/**
 * Base interface for all parsers
 */
export interface Parser {
  /** Unique identifier for the parser */
  id: string;
  /** Human-readable name */
  name: string;
  /** Priority for conflict resolution (higher = more important) */
  priority: number;
  /** Test if this parser can handle the text */
  test: (text: string) => boolean;
  /** Parse the text and return detected tags */
  parse: (text: string) => ParsedTag[];
}

/**
 * Configuration for text highlighting
 */
export interface HighlightConfig {
  /** CSS class for highlighting */
  className: string;
  /** Confidence threshold for highlighting (0-1) */
  confidenceThreshold: number;
  /** Whether to show confidence indicators */
  showConfidence: boolean;
}

/**
 * File attachment for tasks
 */
export interface FileAttachment {
  /** Unique identifier for the attachment */
  id: string;
  /** Original filename */
  name: string;
  /** MIME type of the file */
  type: string;
  /** File size in bytes */
  size: number;
  /** URL to access the file */
  url: string;
  /** When the file was uploaded */
  uploadedAt: Date;
  /** Optional thumbnail URL for images */
  thumbnailUrl?: string;
  /** Task ID this attachment belongs to */
  taskId: string;
}

/**
 * Voice note attachment for tasks
 */
export interface VoiceAttachment {
  /** Unique identifier for the voice note */
  id: string;
  /** Duration in seconds */
  duration: number;
  /** Optional transcription text */
  transcription?: string;
  /** URL to access the audio file */
  url: string;
  /** When the voice note was recorded */
  recordedAt: Date;
  /** Optional waveform data for visualization */
  waveformData?: number[];
  /** Task ID this voice note belongs to */
  taskId: string;
}

/**
 * Task folder representation for folder view
 */
export interface TaskFolder {
  /** Unique identifier for the task folder */
  id: string;
  /** Display name of the folder */
  name: string;
  /** Color associated with the folder */
  color: string;
  /** Icon identifier (lucide icon name) */
  iconId: string;
  /** Total number of tasks in the folder */
  taskCount: number;
  /** Number of completed tasks in the folder */
  completedCount: number;
  /** Preview tasks for hover display */
  tasks: Task[];
  /** Optional description */
  description?: string;
  /** User ID who owns this folder */
  userId: string;
}

/**
 * Task pane data for multi-pane view
 */
export interface TaskPaneData {
  /** Unique identifier for the pane */
  id: string;
  /** Display title for the pane */
  title: string;
  /** Filtered tasks for this pane */
  tasks: Task[];
  /** Grouping method used for this pane */
  grouping: 'taskList' | 'dueDate' | 'priority';
  /** Filter value applied to this pane */
  filterValue?: string;
  /** Whether this pane has no tasks */
  isEmpty: boolean;
  /** Whether to show completed tasks in this pane */
  showCompleted: boolean;
}

/**
 * Task filters for querying
 */
export interface TaskFilters {
  /** Filter by task list ID */
  taskListId?: string;
  /** Filter by completion status */
  completed?: boolean;
  /** Filter by scheduled date */
  scheduledDate?: Date;
  /** Filter by priority */
  priority?: Priority;
  /** Filter by tags */
  tags?: string[];
  /** Filter by user ID */
  userId?: string;
  /** Search query for title/description */
  search?: string;
}

/**
 * Task sorting options
 */
export interface TaskSortOptions {
  /** Field to sort by */
  field: 'createdAt' | 'updatedAt' | 'scheduledDate' | 'priority' | 'title';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Event handler types for task operations
 */
export type TaskEventHandlers = {
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string, date?: Date) => void;
};

/**
 * Component prop types for task components
 */
export interface TaskItemProps {
  task: Task;
  handlers: TaskEventHandlers;
}