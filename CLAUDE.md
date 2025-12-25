# CLAUDE.md

<system_context>
TickrTime is a modern earnings tracking dashboard for technology stocks built with Next.js 15, TypeScript, and Tailwind CSS. It provides real-time earnings data for 2,246+ tech companies using the Finnhub API and is deployed on Cloudflare Pages with Edge Runtime.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
</system_context>

<file_map>
## FILE MAP
- `/app/api/` - Edge Runtime API routes for earnings data and authentication
- `/app/profile/page.tsx` - User profile and preferences management
- `/components/earnings-dashboard.tsx` - Main dashboard orchestrator
- `/components/earnings-table.tsx` - Responsive table with hover actions
- `/components/ui/` - shadcn/ui components library
- `/hooks/` - Custom React hooks (watchlist, table sorting, media queries)
- `/lib/kv-factory.ts` - KV storage abstraction (Cloudflare KV + dev fallback)
- `/lib/auth.ts` - JWT authentication utilities
- `/lib/utils.ts` - Date formatting, currency formatting, utility functions
- `/types/index.ts` - Comprehensive TypeScript definitions
- `/data/tech_tickers.json` - Database of 2,246+ tech companies
- `wrangler.toml` - Cloudflare Workers configuration
</file_map>

<paved_path>
## ARCHITECTURE (PAVED PATH)

### Data Flow Architecture
**MUST follow this pattern for all data operations:**

1. **KV Storage Pattern**: Use `lib/kv-factory.ts` for ALL storage operations
   - Production: Cloudflare KV namespace (`TICKRTIME_KV`)
   - Development: Local in-memory storage via `lib/kv-dev-edge.ts`
   - Factory automatically detects environment

2. **API Route Pattern**: All API routes MUST use Edge Runtime
   ```typescript
   export const runtime = "edge"; // Required for Cloudflare compatibility
   ```

3. **Component Architecture**:
   - **Dashboard** → **Table** → **Cards** (responsive hierarchy)
   - **Context providers** wrap the entire app for shared state
   - **Custom hooks** handle complex logic (sorting, watchlist, media queries)

### Authentication Flow
**JWT-based auth with email verification:**
1. User signs up → Email verification sent
2. User verifies → JWT token issued
3. Token stored in localStorage as `tickrtime-auth-token`
4. API routes validate JWT on protected endpoints

### Preferences System
**localStorage-based with planned context integration:**
- Settings saved to `tickrtime-preferences` key
- Profile page manages preference state
- **TODO**: Context provider to share preferences across components
</paved_path>

<patterns>
## PATTERNS

### API Response Pattern
```typescript
// GOOD: Consistent API response structure
interface EarningsResponse {
  earnings: EarningsData[];
  date?: string;
  totalFound?: number;
  error?: string;
}

// Usage in API routes
return NextResponse.json({
  earnings: filteredResults,
  date: todayStr,
  totalFound: filteredResults.length,
});
```

### Component Props Pattern
```typescript
// GOOD: Extend base props for consistency
interface TableProps extends BaseComponentProps {
  data: EarningsData[];
  loading?: boolean;
  error?: string | null;
  onRowAction?: (action: string, symbol: string) => void;
  watchlistedItems?: Set<string>;
  onToggleWatchlist?: (symbol: string) => boolean | Promise<boolean>;
}
```

### State Management Pattern
```typescript
// GOOD: Custom hooks with clear return types
export interface UseWatchlistReturn {
  watchlist: WatchlistState;
  addToWatchlist: (symbol: string) => Promise<boolean>;
  removeFromWatchlist: (symbol: string) => Promise<boolean>;
  isInWatchlist: (symbol: string) => boolean;
  toggleWatchlist: (symbol: string) => Promise<boolean>;
  getWatchedSymbols: () => string[];
  count: number;
  loading: boolean;
  error: string | null;
}
```

### Date Handling Pattern
```typescript
// GOOD: Consistent date formatting with timezone awareness
export function formatRelativeDate(dateString: string): { 
  formattedDate: string; 
  relativeText: string 
} {
  const date = new Date(dateString);
  const today = new Date();
  // ... formatting logic
}
```
</patterns>

<critical_notes>
## CRITICAL NOTES

- **Code with elegance** - Write clean, maintainable, and elegant code that follows established patterns
- **Follow the paved path** - CRITICAL: The paved path is the PREFERRED way of doing things. When you encounter paved path in any documentation, this indicates the canonical approach that MUST be followed
- **Type safety is mandatory** - NEVER use any types. If you believe any is necessary, PAUSE and request explicit user approval, even in auto-accept mode
- **Git workflow** - CRITICAL: Always follow git best practices and NEVER work on main
- **Design and UI** - CRITICAL: Always follow design best practices for all development, irrespective of web, mobile, or app
- **Clarify ambiguity** - Favor asking follow-up questions to ensure clear understanding of requirements before implementation
- **Preserve existing functionality** - NEVER reduce the scope of existing features/behaviors unless explicitly instructed to do so
- **CLAUDE.md as living documentation** - CRITICAL: Treat all CLAUDE.md files as living API documentation for your future self. Always check for relevant CLAUDE.md files and update them when changes impact their accuracy
- **Edge Runtime MANDATORY** - All API routes must use `export const runtime = "edge"`
- **localStorage keys are standardized** - `tickrtime-auth-token`, `tickrtime-preferences`, `tickrtime-watchlist`
- **Tech ticker filtering** - Always filter API results using `techTickers.map(t => t.symbol)` Set
- **Responsive design** - Mobile-first with card layout, desktop with table layout
- **Error boundaries** - Handle API failures gracefully with user-friendly messages
- **Timezone inconsistency** - Server uses UTC for "today", client uses local timezone for display
- **Testing is MANDATORY** - Never merge without full manual testing (mobile + desktop + themes)
</critical_notes>

<workflow>
## DEVELOPMENT WORKFLOW

### Commands
```bash
# Development
npm run dev              # Start dev server at http://localhost:3000
npm run build           # Production build
npm run build:cf        # Cloudflare Pages build

# Quality Assurance
npm run lint            # ESLint
npm run lint:fix        # ESLint with auto-fix
npm run type-check      # TypeScript validation
npm test                # Jest tests
npm test:watch          # Jest watch mode
npm test:coverage       # Coverage report

# Data Management
npm run build:tech-universe  # Update tech companies database
npm run build:symbols      # Fetch stock symbols

# Utilities
npm run clean          # Clean build artifacts
npm run analyze        # Bundle size analysis
```

### Environment Variables
```bash
FINNHUB_API_KEY=your_key_here    # Required for earnings data
RESEND_API_KEY=your_key_here     # Required for email verification
```

### Feature Development Process
1. **Create feature branch**: `git checkout -b feature/descriptive-name`
2. **Push tracking branch**: `git push -u origin feature/descriptive-name`
3. **Develop with atomic commits**: Present tense commit messages
4. **CRITICAL: Full testing**:
   - Test affected functionality
   - Verify mobile + desktop responsive behavior
   - Test light + dark themes for UI changes
   - Manual verification of actual user experience
   - Run `npm run dev` and interact with application
5. **Quality checks**: `npm run lint && npm run type-check`
6. **Merge to main**: `git checkout main && git merge feature/branch-name`
7. **Push and cleanup**: `git push origin main && git branch -d feature/branch-name`
</workflow>

### Deployment
- **Target**: Cloudflare Pages with Edge Runtime
- **KV namespace**: `TICKRTIME_KV` for production data persistence
- **Configuration**: `wrangler.toml` manages environments (dev, preview, production)
- **Node.js compatibility**: Enabled for server-side functionality

### Claude MD Best Practices
- **Living brain**: CLAUDE.md files are your persistent memory across sessions
- **API documentation**: Write for your future self as an expert coding agent
- **Token-aware**: Keep concise while preserving critical information
- **Current state only**: Document what IS, not what WAS (no changelogs)