/**
 * Core data type definitions for the calendar application
 */

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
  /** Optional scheduled date for the task (stored in UTC) */
  scheduledDate?: Date;
  /** Optional priority level */
  priority?: 'low' | 'medium' | 'high';
  /** Task group ID this task belongs to */
  groupId?: string;
  /** Optional tags extracted from smart parsing */
  tags?: TaskTag[];
  /** Optional metadata from smart parsing */
  parsedMetadata?: {
    originalInput: string;
    cleanTitle: string;
  };
}

/**
 * Represents a calendar event
 */
export interface CalendarEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event title */
  title: string;
  /** Event start date/time (stored in UTC) */
  start: Date;
  /** Event end date/time (stored in UTC) */
  end: Date;
  /** Optional event description */
  description?: string;
  /** Optional event location */
  location?: string;
  /** Name of the calendar this event belongs to */
  calendarName: string;
  /** Optional rich text notes (HTML content) */
  notes?: string;
  /** Optional color override for this event */
  color?: string;
  /** Whether this is an all-day event */
  allDay?: boolean;
  /** Optional recurrence rule */
  recurrence?: string;
}

/**
 * Smart Parsing System Types
 */

/**
 * Represents a tag/label extracted from task input
 */
export interface TaskTag {
  /** Unique identifier for the tag */
  id: string;
  /** Type of tag */
  type: 'date' | 'time' | 'priority' | 'location' | 'person' | 'label' | 'project';
  /** Parsed value (typed based on tag type) */
  value: string | Date | 'low' | 'medium' | 'high';
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
 * Represents a calendar configuration
 */
export interface Calendar {
  /** Calendar name/identifier */
  name: string;
  /** Display color for the calendar */
  color: string;
  /** Whether the calendar is currently visible */
  visible: boolean;
  /** Whether this is the default calendar for new events */
  isDefault?: boolean;
  /** Optional description */
  description?: string;
}

/**
 * Theme configuration options
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Application settings
 */
export interface AppSettings {
  /** Current theme mode */
  theme: ThemeMode;
  /** Width of the left pane in pixels */
  leftPaneWidth: number;
  /** Whether to show completed tasks */
  showCompletedTasks: boolean;
  /** Default calendar for new events */
  defaultCalendar: string;
  /** Whether to show notes editor by default */
  showNotesEditor: boolean;
}

/**
 * Google Calendar integration state
 */
export interface GoogleAuthState {
  /** OAuth2 access token */
  accessToken?: string;
  /** OAuth2 refresh token */
  refreshToken?: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Location autocomplete result
 */
export interface LocationResult {
  /** Display name of the location */
  name: string;
  /** Full formatted address */
  address: string;
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Place ID for future reference */
  placeId?: string;
}

/**
 * Form validation error
 */
export interface ValidationError {
  /** Field name that has the error */
  field: string;
  /** Error message */
  message: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;
  /** Whether the request was successful */
  success: boolean;
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Local storage schema for type safety
 */
export interface StorageSchema {
  /** Stored tasks */
  tasks: Task[];
  /** Stored calendar events */
  events: CalendarEvent[];
  /** Calendar configurations */
  calendars: Calendar[];
  /** Application settings */
  settings: AppSettings;
  /** Google authentication state */
  googleAuth: GoogleAuthState;
}

/**
 * Event handler types for common operations
 */
export type TaskEventHandlers = {
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string, date?: Date) => void;
};

export type CalendarEventHandlers = {
  onEventClick: (event: CalendarEvent) => void;
  onEventCreate: (event: Partial<CalendarEvent>) => void;
  onEventUpdate: (event: CalendarEvent) => void;
  onEventDelete: (id: string) => void;
};

/**
 * Component prop types for reusable components
 */
export interface TaskItemProps {
  task: Task;
  handlers: TaskEventHandlers;
}

export interface CalendarViewProps {
  events: CalendarEvent[];
  calendars: Calendar[];
  handlers: CalendarEventHandlers;
}

export interface EventModalProps {
  isOpen: boolean;
  event?: CalendarEvent;
  calendars: Calendar[];
  onSave: (event: CalendarEvent) => void;
  onClose: () => void;
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
  /** When the task list was created */
  createdAt: Date;
  /** When the task list was last updated */
  updatedAt: Date;
}

/**
 * Enhanced Task with rich features
 */
export interface EnhancedTask extends Task {
  /** File attachments associated with the task */
  attachments?: FileAttachment[];
  /** Voice note attachment */
  voiceNote?: VoiceAttachment;
  /** Rich text description with HTML content */
  richDescription?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** ID of the task list this task belongs to */
  taskListId?: string;
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
}
