import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request context interface
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  userEmail?: string;
  startTime: number;
  ip: string;
  userAgent?: string;
  method: string;
  path: string;
}

/**
 * Extended Request interface with context
 */
export interface RequestWithContext extends Request {
  context?: RequestContext;
}

/**
 * Log data structure
 */
export interface LogData {
  [key: string]: unknown;
}

/**
 * Async local storage for request context
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get current user from request context
 */
export function getCurrentUser(): { id: string; email: string } | undefined {
  const context = getRequestContext();
  if (context?.userId && context?.userEmail) {
    return {
      id: context.userId,
      email: context.userEmail
    };
  }
  return undefined;
}

/**
 * Get current request ID
 */
export function getRequestId(): string | undefined {
  const context = getRequestContext();
  return context?.requestId;
}

/**
 * Run function with request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Create request context from Express request
 */
type RequestWithUser = Request & { user?: { id: string; email: string }; connection?: { remoteAddress?: string } };

export function createRequestContext(req: RequestWithUser): RequestContext {
  return {
    requestId: generateRequestId(),
    userId: req.user?.id,
    userEmail: req.user?.email,
    startTime: Date.now(),
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Middleware to inject request context
 */
export function requestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = createRequestContext(req);
    
    // Add request ID to response headers for debugging
    res.setHeader('X-Request-ID', context.requestId);
    
    // Store context in request for later access
    (req as RequestWithContext).context = context;
    
    // Run the rest of the request in this context
    runWithContext(context, () => {
      next();
    });
  };
}

/**
 * Update request context with user information (called after authentication)
 */
export function updateContextWithUser(userId: string, userEmail: string): void {
  const context = getRequestContext();
  if (context) {
    context.userId = userId;
    context.userEmail = userEmail;
  }
}

/**
 * Get request duration in milliseconds
 */
export function getRequestDuration(): number {
  const context = getRequestContext();
  if (context) {
    return Date.now() - context.startTime;
  }
  return 0;
}

/**
 * Enhanced logging with request context
 */
export function logWithContext(level: 'info' | 'warn' | 'error', message: string, data?: LogData): void {
  const context = getRequestContext();
  const logData = {
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId: context?.requestId,
    userId: context?.userId,
    duration: context ? Date.now() - context.startTime : undefined,
    ...data
  };
  
  console.log(JSON.stringify(logData));
}