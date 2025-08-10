/**
 * Authentication and user-related type definitions
 */

/**
 * User profile information
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Optional avatar URL */
  avatarUrl?: string;
  /** User's timezone */
  timezone?: string;
  /** When the user account was created */
  createdAt: Date;
  /** When the user account was last updated */
  updatedAt: Date;
}

/**
 * User profile with additional metadata
 */
export interface UserProfile extends User {
  /** Optional bio/description */
  bio?: string;
  /** User preferences */
  preferences?: UserPreferences;
}

/**
 * User preferences and settings
 */
export interface UserPreferences {
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
 * Theme configuration options
 */
export type ThemeMode = 'light' | 'dark' | 'system';

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
 * JWT token payload
 */
export interface JWTPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** Token issued at timestamp */
  iat: number;
  /** Token expiration timestamp */
  exp: number;
}

/**
 * Authentication tokens
 */
export interface AuthTokens {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** Access token expiration timestamp */
  expiresAt: number;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  /** User email */
  email: string;
  /** User password */
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  /** User email */
  email: string;
  /** User password */
  password: string;
  /** User display name */
  name: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  /** User email */
  email: string;
}

/**
 * Password reset data
 */
export interface PasswordResetData {
  /** Reset token */
  token: string;
  /** New password */
  password: string;
}