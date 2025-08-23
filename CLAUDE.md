# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TickrTime is a modern earnings tracking dashboard for technology stocks built with Next.js 15, TypeScript, and Tailwind CSS. It provides real-time earnings data for 2,246+ tech companies using the Finnhub API and is deployed on Cloudflare Pages with Edge Runtime.

## Development Commands

### Core Development
- `npm run dev` - Start development server at http://localhost:3000
- `npm run build` - Build for production
- `npm run build:cf` - Build for Cloudflare Pages deployment
- `npm run start` - Start production server

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run type-check` - Run TypeScript type checking without emitting files

### Testing
- `npm test` - Run Jest tests
- `npm test:watch` - Run Jest in watch mode
- `npm test:coverage` - Run tests with coverage report

### Data Management
- `npm run build:tech-universe` - Update tech companies database from Finnhub API
- `npm run build:symbols` - Fetch all stock symbols

### Utilities
- `npm run clean` - Clean build artifacts (.next, out, dist, .vercel)
- `npm run analyze` - Analyze bundle size

## Architecture

### Data Flow
The application uses a dual KV storage system:
- **Production**: Cloudflare KV namespace (`TICKRTIME_KV`)
- **Development**: Local in-memory storage via `lib/kv-dev-edge.ts`

The `lib/kv-factory.ts` automatically detects the environment and provides the appropriate KV interface.

### API Structure
All API routes are in `app/api/` and use Edge Runtime:
- Time-based endpoints: `/earnings-today`, `/earnings-tomorrow`, `/earnings-next-30-days`, `/earnings-previous-30-days`
- Generic search: `/earnings?symbol=AAPL&year=2024&quarter=1`
- Auth endpoints: `/auth/login`, `/auth/signup`, `/auth/verify-email`

### Component Architecture
- **UI Components**: shadcn/ui components in `components/ui/`
- **Feature Components**: Main components like `earnings-table.tsx`, `earnings-dashboard.tsx`
- **Hooks**: Custom React hooks in `hooks/` for table sorting, watchlist management, theming
- **Auth**: Authentication components in `components/auth/`

### Key Files
- `data/tech_tickers.json` - Database of 2,246+ tech companies
- `lib/kv-factory.ts` - KV storage abstraction layer
- `lib/auth.ts` - Authentication utilities with JWT
- `lib/email.ts` - Email service using Resend API
- `wrangler.toml` - Cloudflare Workers configuration

## Environment Setup

Required environment variables:
- `FINNHUB_API_KEY` - For earnings data
- `RESEND_API_KEY` - For email verification

## Testing Strategy

The codebase uses Jest with React Testing Library:
- Component tests in `components/__tests__/`
- API route tests in `app/api/*/\_\_tests\_\_/`
- Hook tests in `hooks/__tests__/`
- Test configuration in `jest.config.js` and `jest.setup.js`

## Deployment Notes

The application is optimized for Cloudflare Pages:
- Uses Edge Runtime for API routes
- KV namespace binding for data persistence
- Wrangler configuration for different environments (dev, preview, production)
- Node.js compatibility enabled for server-side functionality

## Git Workflow

**MANDATORY**: Always follow these git best practices:
- **Never work directly on `main`** - Always create feature branches
- **Branch naming**: Use descriptive names like `feature/add-dark-mode`, `fix/auth-redirect`, `refactor/kv-storage`
- **Atomic commits**: Each commit should represent a single logical change
- **Commit messages**: Use clear, descriptive messages in present tense ("Add dark mode toggle", "Fix auth redirect issue")

### Development Process:
1. **Create feature branch**: `git checkout -b feature/descriptive-name`
2. **Push feature branch**: `git push -u origin feature/descriptive-name` (mirrors local workflow on GitHub)
3. **Make changes and commit**: Atomic commits with descriptive messages
4. **CRITICAL: Test FULLY before completing**:
   - Test all functionality affected by changes
   - Verify on both mobile and desktop (use dev tools)
   - Test in both light and dark themes if UI changes
   - Manually verify the specific issue/feature is resolved
   - Run `npm run dev` and interact with the application
   - **NEVER mark a task as complete without thorough manual testing**
5. **Run quality checks**: `npm run lint` and `npm run type-check`
6. **Merge to main**: `git checkout main && git merge feature/branch-name`
7. **Push main**: `git push origin main`
8. **Clean up**: `git branch -d feature/branch-name && git push origin --delete feature/branch-name`

**Commit Message Format**:
- Use clear, descriptive messages in present tense
- Focus on the "why" and "what" of the change
- Do NOT include "Generated with Claude Code" lines
- Keep commit messages professional and focused

**Testing Requirements**: 
- Testing is NOT optional - it's mandatory before any merge
- Development server compiling ≠ feature working correctly
- Always verify the actual user experience, not just technical functionality

## Development Patterns

- **Type Safety**: Strict TypeScript with comprehensive type definitions in `types/index.ts`
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks and context for theme and auth state
- **Data Fetching**: Server-side rendering with Edge Runtime API routes
- **Authentication**: JWT-based auth with email verification
- **Logging**: Use `logger` from `lib/logger.ts` (never console.log directly)