# Contributing to Taskflow Calendar

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/taskflow-calendar.git
   cd taskflow-calendar
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development environment:
   ```bash
   npm run docker:up
   npm run dev
   ```

## Code Standards

### TypeScript

- Use strict TypeScript - no `any` types unless absolutely necessary
- Define interfaces for all data structures
- Use proper type imports: `import type { Foo } from './types'`

### Code Style

- Run `npm run lint` before committing
- Run `npm run format` to format code with Prettier
- Follow existing patterns in the codebase

### Commits

- Use conventional commit messages:
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation changes
  - `test:` - Test additions/modifications
  - `refactor:` - Code refactoring
  - `perf:` - Performance improvements
  - `chore:` - Maintenance tasks

### Testing

- Write tests for new features
- Maintain existing test coverage
- Run the full test suite before submitting:
  ```bash
  npm run test:all
  ```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure all tests pass: `npm run test:all`
4. Ensure code is properly formatted: `npm run lint && npm run format`
5. Submit a pull request with a clear description

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows project style guidelines
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions
- [ ] No unnecessary files included

## Project Structure

```
src/                  # Frontend React application
├── components/       # UI components
├── hooks/           # Custom React hooks
├── stores/          # Zustand state stores
└── services/api/    # API client

api/                 # Vercel serverless functions
lib/                 # Backend utilities and services
packages/shared/     # Shared types and validation
```

## Questions?

Open an issue for questions or discussions about contributing.
