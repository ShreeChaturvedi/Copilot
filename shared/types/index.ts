/**
 * Shared type definitions barrel export
 * 
 * This file provides clean import paths for all shared types
 * across frontend and backend components.
 */

// Common utility types
export * from './common';

// Authentication and user types
export * from './auth';

// Task management types
export * from './tasks';

// Calendar and event types
export * from './calendars';
export * from './events';

// API request/response types
export * as ApiTypes from './api';

// Database model types
export * from './database';

// Service layer types
export * from './services';

// Legacy Web Speech API types (for backward compatibility)
export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechRecognition: new () => SpeechRecognition;
  }
}

// Legacy type aliases for backward compatibility
export type { Task as EnhancedTask } from './tasks';

/**
 * Application settings (legacy compatibility)
 */
export interface AppSettings {
  /** Current theme mode */
  theme: 'light' | 'dark' | 'system';
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
 * Local storage schema for type safety (legacy compatibility)
 */
export interface StorageSchema {
  /** Stored tasks */
  tasks: import('./tasks').Task[];
  /** Stored calendar events */
  events: import('./events').CalendarEvent[];
  /** Calendar configurations */
  calendars: import('./calendars').Calendar[];
  /** Application settings */
  settings: AppSettings;
  /** Google authentication state */
  googleAuth: import('./auth').GoogleAuthState;
}

// Re-export commonly used types with aliases
export type {
  Task,
  TaskList,
  TaskTag,
  Priority,
  TaskFilters,
  TaskSortOptions,
  TaskEventHandlers,
  TaskItemProps
} from './tasks';

export type {
  Calendar,
  CalendarStats
} from './calendars';

export type {
  CalendarEvent,
  EventFilters,
  EventSortOptions,
  LocationResult,
  CalendarEventHandlers,
  CalendarViewProps,
  EventModalProps
} from './events';

export type {
  User,
  UserProfile,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  GoogleAuthState,
  ThemeMode
} from './auth';

export type {
  ApiResponse,
  ApiError,
  ValidationError,
  PaginatedResponse,
  PaginationMeta,
  PaginationParams
} from './api';

export type {
  BaseEntity,
  UserOwnedEntity,
  ID,
  Timestamp,
  ColorHex,
  Result,
  Optional,
  CreateType,
  UpdateType
} from './common';