<p align="center">
  <img src="docs/assets/banner-light.svg#gh-light-mode-only" width="800" alt="Taskflow Calendar">
  <img src="docs/assets/banner-dark.svg#gh-dark-mode-only" width="800" alt="Taskflow Calendar">
</p>

<h1 align="center">Taskflow Calendar</h1>

<p align="center">
  <strong>A production-ready full-stack calendar and task management platform with intelligent NLP, multi-calendar support, and real-time conflict detection.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#testing">Testing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-738%20passing-brightgreen" alt="Tests">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-19.1-61dafb" alt="React">
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## Overview

Taskflow Calendar is a comprehensive task and calendar management application built with modern full-stack technologies. It features natural language processing for smart task input, multi-pane task management, drag-and-drop scheduling, and a robust serverless API architecture.

### Key Highlights

- **Smart Input System** — Natural language parsing with chrono-node and compromise for intelligent date/time extraction
- **Multi-Pane Layout** — Resizable 1-3 pane task management with independent filtering per pane
- **Full-Stack TypeScript** — End-to-end type safety from database to UI
- **Serverless Architecture** — Vercel-optimized API with PostgreSQL and connection pooling
- **Comprehensive Testing** — 738 tests across frontend, backend, and integration suites
- **Performance Optimized** — Code splitting, database indexing, and smart caching

---

## Features

### Task Management

<p align="center">
  <em><!-- GIF placeholder: task-management-demo.gif --></em>
</p>

- **Multi-Pane Layout**: 1-3 resizable vertical panes with independent filtering
- **Dual View Modes**: Folder grid view with hover previews or traditional list view
- **Kanban Board**: Drag-and-drop status columns
- **Smart Grouping**: Organize by task list, due date, or priority
- **File Attachments**: Upload and preview images, PDFs, and documents
- **Task Analytics**: Visual dashboard with completion metrics

### Smart Input with NLP

<p align="center">
  <em><!-- GIF placeholder: smart-input-demo.gif --></em>
</p>

The smart input system uses a multi-stage parsing pipeline:

```
"Meet John tomorrow at 3pm for project review #high-priority"
     ↓
┌─────────────────────────────────────────────────────────┐
│  ChronoDateParser    → "tomorrow at 3pm" → Date object  │
│  PriorityParser      → "#high-priority" → PRIORITY tag  │
│  CompromiseNLPParser → "John" → PERSON entity           │
│  Conflict Resolution → Overlapping spans resolved       │
└─────────────────────────────────────────────────────────┘
     ↓
Clean task: "Meet John for project review"
+ Metadata: { date: Date, priority: HIGH, person: "John" }
```

**Capabilities**:

- Natural language date/time: "next Friday", "in 2 hours", "tomorrow morning"
- Priority detection: "urgent", "high priority", "low"
- Entity recognition: People, locations, projects
- Real-time syntax highlighting with confidence indicators
- Voice input support via Web Speech API

### Calendar & Events

<p align="center">
  <em><!-- GIF placeholder: calendar-demo.gif --></em>
</p>

- **Multi-Calendar Support**: Separate calendars with color coding and visibility toggles
- **Conflict Detection**: Intelligent overlap checking for event scheduling
- **Recurring Events**: rrule-based patterns (daily, weekly, monthly, custom)
- **Drag & Drop**: Schedule tasks directly onto the calendar
- **Multiple Views**: Day grid, time grid, and agenda list

---

## Architecture

### System Overview

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React 19)"]
        UI[UI Components]
        Zustand[Zustand Stores]
        TanStack[TanStack Query]
    end

    subgraph API["API Layer (Vercel Serverless)"]
        Routes[API Routes]
        Middleware[Middleware Pipeline]
    end

    subgraph Services["Service Layer"]
        TaskSvc[TaskService]
        EventSvc[EventService]
        CalSvc[CalendarService]
        TagSvc[TagService]
        AttachSvc[AttachmentService]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL)]
        Cache[In-Memory Cache]
        Blob[Vercel Blob]
    end

    UI --> Zustand
    UI --> TanStack
    TanStack --> Routes
    Routes --> Middleware
    Middleware --> Services
    Services --> PG
    Services --> Cache
    AttachSvc --> Blob
```

### Middleware Pipeline

Every API request passes through a composable middleware chain:

```mermaid
flowchart LR
    A[Request] --> B[CORS]
    B --> C[Request ID]
    C --> D[Rate Limit]
    D --> E[Auth]
    E --> F[Validation]
    F --> G[Handler]
    G --> H[Response]

    style A fill:#e1f5fe
    style H fill:#c8e6c9
```

| Middleware     | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| **CORS**       | Cross-origin request handling with configurable origins |
| **Request ID** | UUID generation for request tracking and logging        |
| **Rate Limit** | Configurable presets (read: 100/min, write: 30/min)     |
| **Auth**       | JWT verification with access/refresh token rotation     |
| **Validation** | Zod schema validation for request body, query, params   |

### State Management

The application uses a hybrid state management approach:

```mermaid
flowchart TB
    subgraph Client["Client State (Zustand)"]
        UI[uiStore<br/>Modals, Layout]
        Theme[themeStore<br/>Dark/Light Mode]
        Auth[authStore<br/>User Session]
    end

    subgraph Server["Server State (TanStack Query)"]
        Tasks[useTasks<br/>CRUD + Optimistic]
        Events[useEvents<br/>Calendar Data]
        Calendars[useCalendars<br/>Visibility]
    end

    subgraph Features
        Optimistic[Optimistic Updates]
        Cache[5min Stale Time]
        Invalidation[Structured Query Keys]
    end

    Server --> Features
```

### Database Schema

```mermaid
erDiagram
    users ||--o{ tasks : owns
    users ||--o{ calendars : owns
    users ||--o{ task_lists : owns

    tasks ||--o{ task_tags : has
    tasks ||--o{ attachments : has

    calendars ||--o{ events : contains

    task_lists ||--o{ tasks : groups

    tags ||--o{ task_tags : references

    users {
        uuid id PK
        string email UK
        string name
        string passwordHash
        timestamp createdAt
    }

    tasks {
        uuid id PK
        uuid userId FK
        uuid taskListId FK
        string title
        text description
        enum priority
        boolean completed
        timestamp scheduledDate
    }

    events {
        uuid id PK
        uuid calendarId FK
        string title
        timestamp start
        timestamp end
        string recurrence
    }
```

**Performance Indexes** (10 strategic indexes):

- `tasks_priority_idx` — Priority-based filtering
- `tasks_scheduledDate_priority_idx` — Calendar view queries
- `events_calendarId_start_end_idx` — Date range lookups
- Composite indexes ordered by cardinality for optimal query planning

---

## Tech Stack

### Frontend

| Category      | Technologies                                      |
| ------------- | ------------------------------------------------- |
| **Framework** | React 19.1, TypeScript 5.8, Vite 5.4              |
| **State**     | Zustand 5.0 (client), TanStack Query 5.8 (server) |
| **UI**        | Tailwind CSS v4, Radix UI, shadcn/ui              |
| **Calendar**  | FullCalendar 6.1 (daygrid, timegrid, interaction) |
| **NLP**       | chrono-node 2.8, compromise 14.14                 |
| **DnD**       | react-dnd 16.0, @dnd-kit/core 6.3                 |
| **Forms**     | react-hook-form 7.6, Zod 3.25                     |
| **Animation** | Framer Motion 12.2                                |

### Backend

| Category         | Technologies                  |
| ---------------- | ----------------------------- |
| **Runtime**      | Node.js 20, Vercel Serverless |
| **Database**     | PostgreSQL 15, pg 8.16        |
| **Auth**         | JWT, bcryptjs, Google OAuth   |
| **Validation**   | Zod (shared with frontend)    |
| **File Storage** | Vercel Blob                   |

### Infrastructure

| Category       | Technologies                          |
| -------------- | ------------------------------------- |
| **Deployment** | Vercel (serverless + static)          |
| **Database**   | PostgreSQL with connection pooling    |
| **Caching**    | In-memory with TTL, Redis (local dev) |
| **CI/CD**      | GitHub Actions                        |

---

## Performance

### Bundle Optimization

| Strategy           | Implementation                                 |
| ------------------ | ---------------------------------------------- |
| **Code Splitting** | Route-based with React.lazy()                  |
| **Manual Chunks**  | Calendar, NLP, analytics, PDF viewer separated |
| **Tree Shaking**   | Enabled with Terser minification               |
| **Lazy Loading**   | Heavy features loaded on demand                |

**Bundle Analysis**:

- Core bundle: ~180KB (React, router, state management)
- Calendar chunk: ~120KB (loaded on calendar view)
- NLP chunk: ~150KB (loaded when smart input focused)

### Database Performance

| Optimization             | Impact                                |
| ------------------------ | ------------------------------------- |
| **10 Strategic Indexes** | 40-60% faster queries                 |
| **Connection Pooling**   | Max 10 connections, 10s timeout       |
| **Smart Caching**        | 5-minute TTL for task lists           |
| **Query Optimization**   | Composite indexes for common patterns |

### Caching Architecture

```typescript
// In-memory cache with automatic cleanup
const cache = new InMemoryCache({
  maxSize: 500,
  defaultTTL: 300000, // 5 minutes
  cleanupInterval: 60000,
});

// Pattern-based invalidation
cache.invalidatePattern('tasks:*');
```

---

## Testing

### Coverage Summary

| Area         | Test Files | Test Cases |
| ------------ | ---------- | ---------- |
| **Frontend** | 58         | 634        |
| **Backend**  | 5          | 82         |
| **Shared**   | 4          | 22         |
| **Total**    | **67**     | **738**    |

### Test Categories

- **Unit Tests**: Component isolation, service methods
- **Integration Tests**: API endpoints, middleware chain
- **E2E Tests**: Complete user workflows
- **Accessibility Tests**: ARIA compliance, keyboard navigation

### Running Tests

```bash
# All tests
npm run test:all

# Frontend only (watch mode)
npm run test:frontend

# Backend only
npm run test:backend

# With coverage
npm run test:backend:coverage
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (via Docker or local)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/taskflow-calendar.git
cd taskflow-calendar

# Install dependencies
npm install

# Start database services
npm run docker:up

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

The application will be available at `http://localhost:5173` (frontend) and `http://localhost:3000` (API).

### Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/calendar

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# File Storage
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### Available Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Start frontend + backend in development |
| `npm run build`     | Build all packages for production       |
| `npm run test:all`  | Run complete test suite                 |
| `npm run lint`      | Run ESLint across all workspaces        |
| `npm run docker:up` | Start PostgreSQL and Redis              |

---

## Project Structure

```
taskflow-calendar/
├── src/                      # Frontend React application
│   ├── components/           # UI components (180+ files)
│   │   ├── calendar/         # Calendar views and controls
│   │   ├── tasks/            # Task management components
│   │   ├── smart-input/      # NLP-powered input system
│   │   ├── dialogs/          # Modal dialogs
│   │   └── ui/               # Base UI primitives
│   ├── hooks/                # Custom hooks + TanStack Query
│   ├── stores/               # Zustand state stores
│   └── services/api/         # API client layer
│
├── api/                      # Vercel serverless functions
│   ├── tasks/                # Task CRUD endpoints
│   ├── events/               # Event management
│   ├── calendars/            # Calendar operations
│   └── auth/                 # Authentication
│
├── lib/                      # Backend utilities
│   ├── services/             # Business logic layer
│   ├── middleware/           # Request pipeline
│   └── config/               # Database & environment
│
├── packages/
│   ├── backend/              # Express server
│   └── shared/               # Shared types & validation
│
└── docker/                   # Docker configuration
```

---

## Technical Decisions

### Why Pure SQL over Prisma?

After initially using Prisma, we migrated to pure SQL with the `pg` library for:

- **Performance**: Direct control over queries, no ORM overhead
- **Flexibility**: Complex joins and aggregations without workarounds
- **Serverless**: Reduced cold start time, smaller bundle size
- **Transparency**: SQL queries are explicit and debuggable

### Hybrid State Management

Separating client and server state provides:

- **Zustand**: Minimal bundle (~2KB), instant updates for UI state
- **TanStack Query**: Built-in caching, optimistic updates, background sync
- **Best of both**: Simple client state + powerful server state management

### Middleware Pipeline vs Express

Custom composable middleware for Vercel provides:

- **Lightweight**: No Express overhead in serverless environment
- **Type-safe**: Full TypeScript integration with request/response types
- **Modular**: Each middleware testable in isolation
- **Flexible**: Easy to add, remove, or reorder middleware

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with React, TypeScript, and PostgreSQL
</p>
