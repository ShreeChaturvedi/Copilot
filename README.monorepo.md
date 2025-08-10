# React Calendar App - Monorepo Setup

This project has been configured as a monorepo with the following structure:

## Project Structure

```
react-calendar-app/
├── src/                           # Frontend React application
├── api/                          # Vercel API routes (serverless functions)
├── lib/                          # Backend logic (imported by API routes)
├── shared/                       # Shared utilities (legacy, use packages/shared)
├── packages/
│   ├── shared/                   # Shared types, validation, and utilities
│   └── backend/                  # Backend services and logic
├── docker/                       # Docker configuration files
├── docker-compose.yml            # Local development environment
└── vercel.json                   # Vercel deployment configuration
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL (via Docker or local installation)

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start local development environment:**
   ```bash
   # Start PostgreSQL and Redis
   npm run docker:up
   
   # In another terminal, start the development servers
   npm run dev
   ```

3. **Environment setup:**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only the frontend (Vite)
- `npm run dev:backend` - Start only the backend server
- `npm run build` - Build all packages for production
- `npm run test` - Run tests across all packages
- `npm run lint` - Lint all packages
- `npm run format` - Format code with Prettier

### Docker Commands

- `npm run docker:up` - Start PostgreSQL and Redis containers
- `npm run docker:down` - Stop and remove containers
- `npm run docker:logs` - View container logs

### Database Commands

- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## Package Structure

### Frontend (`src/`)
The existing React application with minimal changes. Updated to use shared types and call backend APIs.

### Shared Package (`packages/shared/`)
- **Types**: TypeScript interfaces shared between frontend and backend
- **Validation**: Zod schemas for request/response validation
- **Utils**: Common utility functions

### Backend Package (`packages/backend/`)
- **Services**: Business logic and data access
- **Routes**: Express route handlers
- **Middleware**: Authentication, validation, error handling
- **Config**: Environment and database configuration

### API Routes (`api/`)
Vercel serverless functions that import logic from the backend package.

### Lib (`lib/`)
Backend utilities and services that can be imported by API routes.

## Deployment

### Development
```bash
npm run dev
```

### Production (Vercel)
```bash
npm run build
vercel deploy --prod
```

The application is configured for deployment on Vercel with:
- Frontend served as static files
- API routes as serverless functions
- Database on PlanetScale or Supabase
- File storage via Vercel Blob

## Environment Variables

See `.env.example` for all required environment variables. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `GOOGLE_CLIENT_ID/SECRET` - Google OAuth credentials
- `RESEND_API_KEY` - Email service API key
- `BLOB_READ_WRITE_TOKEN` - File storage token

## Next Steps

This setup provides the foundation for implementing:
1. Shared types and validation (Task 2)
2. Database schema with Prisma (Task 3)
3. Authentication system (Task 4)
4. API endpoints (Tasks 5-8)
5. Real-time features (Task 10)
6. Testing and deployment (Tasks 14-15)