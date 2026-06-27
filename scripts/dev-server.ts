/**
 * Local development API server
 * Run with: npx tsx scripts/dev-server.ts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load env files before importing anything else
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      }
    }
  }
}
loadEnv();

import express from 'express';
import cors from 'cors';
import { getAllServices, initServices } from '../lib/services/index';
import { authService } from '../packages/backend/src/services/AuthService';
import { refreshTokenService } from '../packages/backend/src/services/RefreshTokenService';
import { googleOAuthService } from '../packages/backend/src/services/GoogleOAuthService';
import {
  extractTokenFromHeader,
  verifyToken,
} from '../packages/backend/src/utils/jwt';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Dev user context
const devContext = {
  userId: 'dev-user-id',
  requestId: 'dev-request',
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
});

// Tasks
app.get('/api/tasks', async (_req, res) => {
  try {
    const { task: taskService } = getAllServices();
    const tasks = await taskService.findAll({}, devContext);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { task: taskService } = getAllServices();
    const task = await taskService.create(req.body, devContext);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { task: taskService } = getAllServices();
    const task = await taskService.update(req.params.id, req.body, devContext);
    res.json({ success: true, data: task });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// PUT route for task updates (frontend uses PUT)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { task: taskService } = getAllServices();
    const task = await taskService.update(req.params.id, req.body, devContext);
    res.json({ success: true, data: task });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { task: taskService } = getAllServices();
    await taskService.delete(req.params.id, devContext);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Task Lists
app.get('/api/task-lists', async (_req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const lists = await taskListService.findAll({}, devContext);
    res.json({ success: true, data: lists });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.get('/api/task-lists/default', async (_req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const lists = await taskListService.findAll({}, devContext);
    // Return first list as default
    const defaultList =
      lists[0] ||
      (await taskListService.create({ name: 'Default' }, devContext));
    res.json({ success: true, data: defaultList });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.post('/api/task-lists', async (req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const list = await taskListService.create(req.body, devContext);
    res.status(201).json({ success: true, data: list });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.patch('/api/task-lists/:id', async (req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const list = await taskListService.update(
      req.params.id,
      req.body,
      devContext
    );
    if (!list) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Task list not found' } });
    }
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('PATCH /api/task-lists/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.put('/api/task-lists/:id', async (req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const list = await taskListService.update(
      req.params.id,
      req.body,
      devContext
    );
    if (!list) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Task list not found' } });
    }
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('PUT /api/task-lists/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.delete('/api/task-lists/:id', async (req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    await taskListService.delete(req.params.id, devContext);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Calendars
app.get('/api/calendars', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const withEventCounts = req.query.withEventCounts === 'true';
    const calendars = await calendarService.findAll(
      { withEventCounts },
      devContext
    );
    res.json({ success: true, data: calendars });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.post('/api/calendars', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const calendar = await calendarService.create(req.body, devContext);
    res.status(201).json({ success: true, data: calendar });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.get('/api/calendars/:id', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const calendar = await calendarService.findById(req.params.id, devContext);
    if (!calendar) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Calendar not found' } });
    }
    res.json({ success: true, data: calendar });
  } catch (error) {
    console.error('GET /api/calendars/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.put('/api/calendars/:id', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const calendar = await calendarService.update(
      req.params.id,
      req.body,
      devContext
    );
    if (!calendar) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Calendar not found' } });
    }
    res.json({ success: true, data: calendar });
  } catch (error) {
    console.error('PUT /api/calendars/:id error:', error);
    if (getErrorMessage(error)?.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({
        success: false,
        error: {
          message: getErrorMessage(error).replace('VALIDATION_ERROR: ', ''),
        },
      });
    }
    if (getErrorMessage(error)?.includes('AUTHORIZATION_ERROR')) {
      return res
        .status(403)
        .json({ success: false, error: { message: 'Access denied' } });
    }
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.patch('/api/calendars/:id', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const { action } = req.query;
    let result;

    switch (action) {
      case 'toggle-visibility':
        result = await calendarService.toggleVisibility(
          req.params.id,
          devContext
        );
        break;
      case 'set-default':
        result = await calendarService.setDefault(req.params.id, devContext);
        break;
      default:
        result = await calendarService.update(
          req.params.id,
          req.body,
          devContext
        );
    }

    if (!result) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Calendar not found' } });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('PATCH /api/calendars/:id error:', error);
    if (getErrorMessage(error)?.startsWith('VALIDATION_ERROR:')) {
      return res.status(400).json({
        success: false,
        error: {
          message: getErrorMessage(error).replace('VALIDATION_ERROR: ', ''),
        },
      });
    }
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.delete('/api/calendars/:id', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const success = await calendarService.delete(req.params.id, devContext);
    if (!success) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Calendar not found' } });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('DELETE /api/calendars/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Events
app.get('/api/events', async (_req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const events = await eventService.findAll({}, devContext);
    res.json({ success: true, data: events });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Conflict detection (must be registered before '/api/events/:id')
app.get('/api/events/conflicts', async (req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const { start, end, startTime, endTime, excludeEventId, calendarId } =
      req.query as Record<string, string>;
    const startParam = start || startTime;
    const endParam = end || endTime;
    if (!startParam || !endParam) {
      return res.status(400).json({
        success: false,
        error: { message: 'Start time and end time are required' },
      });
    }
    const conflicts = await eventService.getConflicts(
      {
        start: new Date(startParam),
        end: new Date(endParam),
        calendarId: calendarId || undefined,
      },
      excludeEventId || undefined,
      devContext
    );
    res.json({
      success: true,
      data: {
        conflicts,
        hasConflicts: conflicts.length > 0,
        count: conflicts.length,
      },
    });
  } catch (error) {
    console.error('GET /api/events/conflicts error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const event = await eventService.findById(req.params.id, devContext);
    if (!event) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Event not found' } });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const event = await eventService.create(req.body, devContext);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.patch('/api/events/:id', async (req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const event = await eventService.update(
      req.params.id,
      req.body,
      devContext
    );
    res.json({ success: true, data: event });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// PUT also supported since frontend uses PUT for updates
app.put('/api/events/:id', async (req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const event = await eventService.update(
      req.params.id,
      req.body,
      devContext
    );
    if (!event) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Event not found' } });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    console.error('PUT /api/events/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const { event: eventService } = getAllServices();
    await eventService.delete(req.params.id, devContext);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Tags
app.get('/api/tags', async (_req, res) => {
  try {
    const { tag: tagService } = getAllServices();
    const tags = await tagService.findAll({}, devContext);
    res.json({ success: true, data: tags });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// ========== Auth Routes ==========

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const authResult = await authService.registerUser(req.body);
    res.status(201).json({ success: true, data: authResult });
  } catch (error) {
    if (getErrorMessage(error) === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'User already exists',
        },
      });
    }
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const authResult = await authService.loginUser(req.body);
    res.json({ success: true, data: authResult });
  } catch (error) {
    if (getErrorMessage(error) === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        },
      });
    }
    if (getErrorMessage(error) === 'OAUTH_USER_NO_PASSWORD') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OAUTH_USER_NO_PASSWORD',
          message: 'Use Google OAuth to login',
        },
      });
    }
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const isTokenReuse =
      await refreshTokenService.detectTokenReuse(refreshToken);
    if (isTokenReuse) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          message: 'Token reuse detected',
        },
      });
    }
    const newTokenPair =
      await refreshTokenService.rotateRefreshToken(refreshToken);
    res.json({ success: true, data: newTokenPair });
  } catch (error) {
    res
      .status(401)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken, logoutAll } = req.body;
    if (logoutAll) {
      await refreshTokenService.invalidateAllUserTokens(devContext.userId);
    } else {
      await refreshTokenService.invalidateRefreshToken(refreshToken);
    }
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch {
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  }
});

// GET /api/auth/me
// Mirrors the serverless api/auth/me.ts: verify the bearer access token and
// return the real authenticated user (NOT a hardcoded dev user), so the auth
// guard's verification step behaves the same locally as in production.
app.get('/api/auth/me', async (req, res) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid token type' },
      });
    }

    const user = await authService.getUserById(decoded.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'User not found' } });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Google OAuth routes - mirror api/auth/google/index.ts. When Google OAuth is
// not configured (no GOOGLE_CLIENT_ID/SECRET) these return 503, matching prod.
app.get('/api/auth/google', async (_req, res) => {
  try {
    if (!googleOAuthService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          message: 'Google OAuth is not configured on this server',
        },
      });
    }
    res.json({
      success: true,
      data: { authUrl: googleOAuthService.getAuthUrl() },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!googleOAuthService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          message: 'Google OAuth is not configured on this server',
        },
      });
    }

    const { code } = req.body ?? {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AUTH_CODE',
          message: 'Authorization code is required',
        },
      });
    }

    const result = await googleOAuthService.handleCallback(code);
    res.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name ?? '',
          picture: result.user.avatarUrl,
        },
        googleTokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: result.tokens.expiresAt,
        },
        isNewUser: result.isNewUser,
      },
    });
  } catch (error) {
    if (getErrorMessage(error) === 'GOOGLE_OAUTH_FAILED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'GOOGLE_OAUTH_FAILED',
          message: 'Failed to authenticate with Google',
        },
      });
    }
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Start
console.log('Initializing services...');
initServices();

app.listen(PORT, () => {
  console.log(`
🚀 Dev API server on http://localhost:${PORT}
   Ensure PostgreSQL is running: docker-compose up -d
  `);
});
