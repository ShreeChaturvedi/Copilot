// Core shared types used across frontend and backend
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Calendar
export interface Calendar {
  id?: string;
  name: string;
  color: string;
  visible: boolean;
  isDefault?: boolean;
  description?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Events
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  calendarId?: string;
  calendarName?: string;
  userId?: string;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
  exceptions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  occurrenceInstanceStart?: Date;
  occurrenceInstanceEnd?: Date;
}

// Tasks
export type Priority = 'low' | 'medium' | 'high';

export interface TaskTag {
  id: string;
  type: 'date' | 'time' | 'priority' | 'location' | 'person' | 'label' | 'project';
  value: string | Date | Priority;
  displayText: string;
  iconName: string;
  color?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  thumbnailUrl?: string;
  taskId: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  /** Frontend canonical task status (mirrors backend status). Derived default when absent: 'not_started' if not completed; 'done' if completed */
  status?: 'not_started' | 'in_progress' | 'done';
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
  scheduledDate?: Date;
  priority?: Priority;
  taskListId?: string;
  userId?: string;
  tags?: TaskTag[];
  parsedMetadata?: { originalInput: string; cleanTitle: string };
  attachments?: FileAttachment[];
}

// Validation
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// App settings and auth state
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  leftPaneWidth: number;
  showCompletedTasks: boolean;
  defaultCalendar: string;
  showNotesEditor: boolean;
  /** Controls how dates are displayed inside tags */
  dateDisplayMode: 'relative' | 'absolute';
}

export interface GoogleAuthState {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  isAuthenticated: boolean;
}

// Smart parsing types
export type TagType = 'date' | 'time' | 'priority' | 'location' | 'person' | 'label' | 'project';

export interface ParsedTag extends TaskTag {
  startIndex: number;
  endIndex: number;
  originalText: string;
  confidence: number; // 0..1
  source: string; // parser id/name
}

export interface Conflict {
  startIndex: number;
  endIndex: number;
  tags: ParsedTag[];
  resolved?: ParsedTag;
}

export interface ParseResult {
  cleanText: string;
  tags: ParsedTag[];
  confidence: number;
  conflicts: Conflict[];
}

export interface Parser {
  id: string;
  name: string;
  priority: number;
  test: (text: string) => boolean;
  parse: (text: string) => ParsedTag[];
}

// Task-focused view helper types
export interface TaskFolder {
  id: string;
  name: string;
  color: string;
  iconId: string;
  taskCount: number;
  completedCount: number;
  tasks: Task[];
  description?: string;
  userId: string;
}

export interface TaskPaneData {
  id: string;
  title: string;
  tasks: Task[];
  grouping: 'taskList' | 'dueDate' | 'priority';
  filterValue?: string;
  isEmpty: boolean;
  showCompleted: boolean;
}

// Local storage schema used by legacy/local fallback utilities
export interface StorageSchema {
  tasks: Task[];
  events: CalendarEvent[];
  calendars: Calendar[];
  settings: AppSettings;
  googleAuth: GoogleAuthState;
}