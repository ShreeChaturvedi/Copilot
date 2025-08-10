/**
 * API request/response type definitions
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  /** Response data */
  data: T;
  /** Whether the request was successful */
  success: boolean;
  /** Error message if unsuccessful */
  error?: string;
  /** Additional error details */
  details?: any;
  /** Request timestamp */
  timestamp: string;
  /** Unique request ID for tracking */
  requestId?: string;
}

/**
 * API error response
 */
export interface ApiError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: any;
  /** Field-specific validation errors */
  fieldErrors?: ValidationError[];
  /** HTTP status code */
  statusCode: number;
  /** Request timestamp */
  timestamp: string;
  /** Unique request ID for tracking */
  requestId?: string;
}

/**
 * Form validation error
 */
export interface ValidationError {
  /** Field name that has the error */
  field: string;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Offset for cursor-based pagination */
  offset?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
  /** Next page cursor (for cursor-based pagination) */
  nextCursor?: string;
  /** Previous page cursor (for cursor-based pagination) */
  prevCursor?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination metadata */
  meta: PaginationMeta;
}

/**
 * Sorting parameters
 */
export interface SortParams {
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search parameters
 */
export interface SearchParams {
  /** Search query */
  q?: string;
  /** Fields to search in */
  fields?: string[];
}

/**
 * Base query parameters
 */
export interface BaseQueryParams extends PaginationParams, SortParams, SearchParams {
  /** Additional filters */
  [key: string]: any;
}

/**
 * Authentication request types
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

/**
 * Authentication response types
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

/**
 * Task API request types
 */
export interface CreateTaskRequest {
  title: string;
  taskListId?: string;
  scheduledDate?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: Array<{
    type: string;
    value: string;
    displayText: string;
    iconName: string;
    color?: string;
  }>;
  parsedMetadata?: {
    originalInput: string;
    cleanTitle: string;
  };
}

export interface UpdateTaskRequest {
  title?: string;
  completed?: boolean;
  scheduledDate?: string;
  priority?: 'low' | 'medium' | 'high';
  taskListId?: string;
  richDescription?: string;
  estimatedDuration?: number;
}

export interface TaskQueryParams extends BaseQueryParams {
  taskListId?: string;
  completed?: boolean;
  scheduledDate?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

/**
 * Task List API request types
 */
export interface CreateTaskListRequest {
  name: string;
  color: string;
  icon: string;
  description?: string;
}

export interface UpdateTaskListRequest {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  isVisible?: boolean;
}

/**
 * Calendar API request types
 */
export interface CreateCalendarRequest {
  name: string;
  color: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateCalendarRequest {
  name?: string;
  color?: string;
  description?: string;
  visible?: boolean;
  isDefault?: boolean;
}

export interface CalendarQueryParams extends BaseQueryParams {
  visible?: boolean;
  isDefault?: boolean;
}

/**
 * Event API request types
 */
export interface CreateEventRequest {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendarId: string;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
}

export interface UpdateEventRequest {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  calendarId?: string;
  notes?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string;
}

export interface EventQueryParams extends BaseQueryParams {
  calendarId?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
}

/**
 * File upload request types
 */
export interface FileUploadRequest {
  file: File;
  taskId?: string;
}

export interface FileUploadResponse {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * Bulk operation request types
 */
export interface BulkUpdateRequest<T> {
  ids: string[];
  updates: Partial<T>;
}

export interface BulkDeleteRequest {
  ids: string[];
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
  cache?: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: string;
  userId?: string;
}

export interface TaskUpdateMessage extends WebSocketMessage {
  type: 'task:created' | 'task:updated' | 'task:deleted';
  data: {
    taskId: string;
    task?: any;
    userId: string;
  };
}

export interface EventUpdateMessage extends WebSocketMessage {
  type: 'event:created' | 'event:updated' | 'event:deleted';
  data: {
    eventId: string;
    event?: any;
    userId: string;
  };
}

export interface CalendarUpdateMessage extends WebSocketMessage {
  type: 'calendar:created' | 'calendar:updated' | 'calendar:deleted';
  data: {
    calendarId: string;
    calendar?: any;
    userId: string;
  };
}