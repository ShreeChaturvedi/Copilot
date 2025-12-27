# Repository Guidelines

## Project Structure & Module Organization

- `src/` hosts the React frontend (`components/`, `pages/`, `services/`, `stores/`, `assets/`, `styles/`).
- `packages/backend/` contains backend services (`src/`) and database assets (`prisma/`).
- `packages/shared/` provides shared types, validation, and utilities.
- `api/` holds Vercel serverless routes; `lib/` contains backend helpers for API routes.
- `scripts/` holds local tooling (for example `scripts/dev-server.ts`); `test/` and `src/test/` contain Vitest setup; `docker/` and `docker-compose.yml` define local infrastructure.

## Build, Test, and Development Commands

- `npm install` installs workspace dependencies.
- `npm run dev` runs the Vite frontend and the local API dev server together.
- `npm run dev:vite` / `npm run dev:api` / `npm run dev:backend` run the frontend only, API dev script, or backend workspace server.
- `npm run build` builds shared, frontend, and backend packages.
- `npm run preview` serves the production Vite build locally.
- `npm run lint` / `npm run format` run ESLint and Prettier.
- `npm run test` / `npm run test:frontend` / `npm run test:backend` run the Vitest suites.

## Coding Style & Naming Conventions

- TypeScript + React; formatting is enforced by Prettier (`tabWidth: 2`, single quotes, semicolons, 80-column width).
- ESLint rules live in `eslint.config.js`; fix lint issues before merging.
- Import aliases from `tsconfig.json`: `@/`, `@shared/`, `@backend/`, `@api/`, `@lib/`.
- Follow existing file naming patterns per folder (kebab-case and PascalCase both appear); tests use `*.test.ts(x)` and `__tests__/`.

## Testing Guidelines

- Vitest is the test runner with Testing Library for UI tests; configs are `vitest.config.ts` (frontend) and `vitest.backend.config.ts` (backend).
- Tests are co-located (for example `src/App.test.tsx`, `src/components/**/__tests__`, `packages/backend/src/**/__tests__`).
- Shared setup lives in `src/test/setup.ts` and `test/backend-setup.ts`.

## Commit & Pull Request Guidelines

- Recent commits are short and descriptive in sentence case, with occasional `feat:` prefixes. Use an imperative summary and add context in the body if needed.
- PRs should include a concise description, testing notes (commands run), linked issues, and screenshots for UI changes.

## Environment & Configuration Tips

- Copy `.env.example` to `.env.local` for local development.
- Use `npm run docker:up` to start PostgreSQL/Redis via `docker-compose.yml`.
