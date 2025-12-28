/**
 * Local development backend server
 * Serves API routes using the lib/services layer connected to PostgreSQL
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Dev user context (simulates authenticated user)
const devUser = {
  id: 'dev-user-id',
  email: 'dev@example.com',
  name: 'Dev User',
};

const devContext = {
  userId: devUser.id,
  requestId: 'dev-request',
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Dynamic import of services (ESM compatible)
type ServicesModule = typeof import('../../../lib/services/index.js');
let getAllServices: ServicesModule['getAllServices'];

async function initServices() {
  try {
    // Dynamic import from lib/services
    const servicesModule = await import('../../../lib/services/index.js');
    getAllServices = servicesModule.getAllServices;
    console.log('✅ Services initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    return false;
  }
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'development',
    },
  });
});

// Tasks routes
app.get('/api/tasks', async (_req, res) => {
  try {
    const { task: taskService } = getAllServices();
    const tasks = await taskService.findAll({}, devContext);
    res.json({ success: true, data: tasks });
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('POST /api/tasks error:', error);
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
  } catch (error: unknown) {
    console.error('PATCH /api/tasks error:', error);
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
  } catch (error: unknown) {
    console.error('DELETE /api/tasks error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Task Lists routes
app.get('/api/task-lists', async (_req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const lists = await taskListService.findAll({}, devContext);
    res.json({ success: true, data: lists });
  } catch (error: unknown) {
    console.error('GET /api/task-lists error:', error);
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
  } catch (error: unknown) {
    console.error('POST /api/task-lists error:', error);
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
  } catch (error: unknown) {
    console.error('PATCH /api/task-lists/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

app.delete('/api/task-lists/:id', async (req, res) => {
  try {
    const { taskList: taskListService } = getAllServices();
    const success = await taskListService.delete(req.params.id, devContext);
    if (!success) {
      return res
        .status(404)
        .json({ success: false, error: { message: 'Task list not found' } });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: unknown) {
    console.error('DELETE /api/task-lists/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Calendars routes
app.get('/api/calendars', async (req, res) => {
  try {
    const { calendar: calendarService } = getAllServices();
    const withEventCounts = req.query.withEventCounts === 'true';
    const calendars = await calendarService.findAll(
      { withEventCounts },
      devContext
    );
    res.json({ success: true, data: calendars });
  } catch (error: unknown) {
    console.error('GET /api/calendars error:', error);
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
  } catch (error: unknown) {
    console.error('POST /api/calendars error:', error);
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('PUT /api/calendars/:id error:', error);
    const message = getErrorMessage(error);
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res
        .status(400)
        .json({
          success: false,
          error: { message: message.replace('VALIDATION_ERROR: ', '') },
        });
    }
    res.status(500).json({ success: false, error: { message } });
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
  } catch (error: unknown) {
    console.error('PATCH /api/calendars/:id error:', error);
    const message = getErrorMessage(error);
    if (message.startsWith('VALIDATION_ERROR:')) {
      return res
        .status(400)
        .json({
          success: false,
          error: { message: message.replace('VALIDATION_ERROR: ', '') },
        });
    }
    res.status(500).json({ success: false, error: { message } });
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
  } catch (error: unknown) {
    console.error('DELETE /api/calendars/:id error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Events routes
app.get('/api/events', async (_req, res) => {
  try {
    const { event: eventService } = getAllServices();
    const events = await eventService.findAll({}, devContext);
    res.json({ success: true, data: events });
  } catch (error: unknown) {
    console.error('GET /api/events error:', error);
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
  } catch (error: unknown) {
    console.error('POST /api/events error:', error);
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
  } catch (error: unknown) {
    console.error('PATCH /api/events error:', error);
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
  } catch (error: unknown) {
    console.error('DELETE /api/events error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Tags routes
app.get('/api/tags', async (_req, res) => {
  try {
    const { tag: tagService } = getAllServices();
    const tags = await tagService.findAll({}, devContext);
    res.json({ success: true, data: tags });
  } catch (error: unknown) {
    console.error('GET /api/tags error:', error);
    res
      .status(500)
      .json({ success: false, error: { message: getErrorMessage(error) } });
  }
});

// Start server
async function start() {
  const servicesOk = await initServices();
  if (!servicesOk) {
    console.error(
      '⚠️  Server starting without service layer - API routes will fail'
    );
  }

  app.listen(PORT, () => {
    console.log(`
🚀 Local backend server running on port ${PORT}
   Health: http://localhost:${PORT}/health
   API:    http://localhost:${PORT}/api
   
   Make sure PostgreSQL is running (docker-compose up -d)
   `);
  });
}

start();
