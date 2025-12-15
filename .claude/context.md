# SecureBank - Bug Fix Challenge Context

## Project Overview
NextJS TypeScript banking application with reported bugs to investigate and fix within 24 hours.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, React, Tailwind CSS
- **Backend**: tRPC (type-safe APIs)
- **Database**: SQLite with Drizzle ORM
- **Auth**: JWT-based sessions
- **Forms**: React Hook Form
- **Testing**: Vitest + Testing Library

## Application Features
- User registration (multi-step form)
- User authentication (login/logout)
- Account management (checking/savings)
- Fund accounts (card/bank transfer)
- Transaction history

## Important Commands

### Database
```bash
npm run db:list-users      # List all users
npm run db:list-sessions   # List all sessions
npm run db:clear          # Clear all data
npm run db:delete-user    # Delete specific user
```

### Testing
```bash
npm test                   # Run tests in watch mode
npm run test:run          # Run tests once
npm run test:ui           # Run tests with UI dashboard
```

## Reported Issues
See [CHALLENGE.md](../CHALLENGE.md) for complete list of 25 bugs categorized by priority.

## Testing Setup

### ⚠️ IMPORTANT: PostCSS Workaround
The PostCSS config has an issue that blocks Vitest. To run tests:

1. **Before running tests**:
   ```bash
   mv postcss.config.mjs postcss.config.mjs.disabled
   npm test
   ```

2. **Before running dev server**:
   ```bash
   mv postcss.config.mjs.disabled postcss.config.mjs
   npm run dev
   ```

**Current Status**: `postcss.config.mjs` is currently DISABLED (renamed to `.disabled`)

### Test Files
- `__tests__/validation/` - Backend Zod schema validation tests
- `__tests__/components/` - Frontend React component tests
- `__tests__/README.md` - Complete testing documentation

## Project Documentation Files
- **CHALLENGE.md** - Original bug challenge details
- **DOCUMENTATION.md** - Bug fix tracking and documentation
- **MEMORY.md** - Cross-session notes and discoveries
- **.claude/context.md** - This file (quick reference)

## Key Files to Investigate
- `app/signup/page.tsx` - Multi-step registration form
- `server/routers/auth.ts` - Authentication tRPC router
- `lib/db/schema.ts` - Database schema
- `app/dashboard/page.tsx` - Main dashboard
