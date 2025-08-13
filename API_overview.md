### API overview
- All endpoints return the standard response wrapper:
  - success: true, data: …
  - success: false, error: { code, message, details? }
- Auth: routes are marked requireAuth; in dev, a mock user is injected so calls work without a token.
- Dates: send/receive ISO strings; services store UTC.

### Tasks
- GET /api/tasks
  - Query: completed, taskListId, priority (LOW|MEDIUM|HIGH), search, overdue (true), scheduledDateFrom, scheduledDateTo, tags (multi), sortBy (createdAt|updatedAt|scheduledDate|priority|title), sortOrder (asc|desc), page, limit
  - Returns list or { data, pagination }
- POST /api/tasks
  - Body: { title, taskListId?, scheduledDate?, priority?, tags?, originalInput?, cleanTitle? }
- GET /api/tasks/:id
- PUT /api/tasks/:id
  - Body: any of { title, completed, scheduledDate, priority, taskListId, originalInput, cleanTitle }
- PATCH /api/tasks/:id?action=toggle
  - Toggles completion
- DELETE /api/tasks/:id
- GET /api/tasks/stats
  - Returns totals, completed, pending, overdue, etc.
- POST /api/tasks/bulk (if used): bulk updates/deletes (shape follows service helpers)

### Task lists
- GET /api/task-lists
  - Query: search, withTaskCount=true
- POST /api/task-lists
  - Body: { name, color, icon?, description? }
- GET /api/task-lists/:id
- PUT /api/task-lists/:id
  - Body: any of { name, color, icon, description }
- PATCH /api/task-lists/:id
  - Body: same as PUT
  - Or Query: action=set-default
- DELETE /api/task-lists/:id
- GET /api/task-lists/stats

### Calendars
- GET /api/calendars
  - Query: withEventCounts=true
- POST /api/calendars
  - Body: { name, color, description? }
- GET /api/calendars/:id
- PUT /api/calendars/:id
  - Body: any of { name, color, description, isVisible?, isDefault? }
- PATCH /api/calendars/:id
  - Body: same as PUT
- DELETE /api/calendars/:id

### Events
- GET /api/events
  - Query: start, end (ISO) for range; other filters supported (calendarId, search, allDay, hasRecurrence)
- POST /api/events
  - Body: { title, start, end, calendarId, description?, location?, notes?, allDay?, recurrence? }
- GET /api/events/:id
- PUT /api/events/:id
  - Body: any of { title, start, end, description, location, notes, allDay, recurrence, calendarId }
- PATCH /api/events/:id
  - Body: same as PUT
- DELETE /api/events/:id
- GET /api/events/conflicts
  - Query: start, end, calendarId?, excludeId?
  - Returns overlapping events window

### Tags
- GET /api/tags
  - Query: search?
- POST /api/tags
  - Body: { name, type?, color? }
- GET /api/tags/:id
- PUT /api/tags/:id
  - Body: any of { name, type, color }
- PATCH /api/tags/:id
  - Body: same as PUT
- DELETE /api/tags/:id
- POST /api/tags/merge
  - Body: { sourceId, targetId }
- POST /api/tags/cleanup
  - No body or { dryRun? }

### Attachments
- GET /api/attachments
  - Query: by taskId/category if implemented
- POST /api/attachments
  - Body: { fileName, fileType, fileSize, fileUrl, taskId? }
- GET /api/attachments/:id
- DELETE /api/attachments/:id
- GET /api/attachments/stats
- POST /api/attachments/cleanup
  - No body or { dryRun? }

### Auth and health
- POST /api/auth/login
  - Body depends on auth mode (email/password or OAuth handoff)
- GET /api/health
  - Returns { status: 'ok', timestamp, environment, version }

### Known API issues

1. Event creation is optimistic: so creating an event and immediately proceeding to edit it (e.g. dragging somewhere) causes "Event not found" error.