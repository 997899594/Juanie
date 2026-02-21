# Juanie - AI DevOps Platform

This document provides coding guidelines and conventions for agentic coding agents working in this repository.

## Project Overview

Juanie is a modern AI-driven DevOps platform built with:
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth.js (GitHub/GitLab OAuth)
- **UI**: Tailwind CSS + Radix UI components
- **K8s SDK**: @kubernetes/client-node
- **GitOps**: Flux CD
- **Runtime**: Bun

## Build/Lint/Test Commands

```bash
# Development
bun run dev              # Start dev server on port 3001

# Build
bun run build            # Build for production

# Linting & Formatting
bun run lint             # Run Biome linter
bun run format           # Format code with Biome

# Database
bun run db:generate      # Generate Drizzle migrations
bun run db:push          # Push schema changes to database
```

**Note**: No test framework is currently configured. When adding tests, prefer Vitest and update this document.

## Code Style Guidelines

### Formatting (Biome)

- **Indent**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Single quotes for strings
- **Trailing commas**: ES5 style
- **Imports**: Auto-organized by Biome

### TypeScript

- Strict mode is enabled
- Prefer explicit return types for exported functions
- Use `interface` for object types, `type` for unions/intersections
- Avoid `any`; use `unknown` when type is truly unknown
- Use type assertions sparingly (`as`)

### Imports

Order your imports as follows (Biome auto-organizes):

```typescript
// 1. External packages
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// 2. Internal imports with @ alias
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

// 3. Relative imports (avoid when possible)
```

Use `@/*` alias for imports from `src/`:

```typescript
// Correct
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Avoid
import { Button } from '../../../components/ui/button'
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase.tsx | `Button.tsx` |
| Files (utilities) | camelCase.ts | `utils.ts` |
| Files (routes) | lowercase/route.ts | `api/users/route.ts` |
| React components | PascalCase | `UserProfile` |
| Functions | camelCase | `getUserById` |
| Constants | camelCase or SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `defaultTimeout` |
| Database tables | camelCase (plural) | `users`, `teamMembers` |
| Types/Interfaces | PascalCase | `User`, `DeploymentStatus` |
| Enums | camelCase values | `'pending'`, `'deployed'` |

### React Components

- Use function components with arrow functions
- Use `React.forwardRef` for UI components that need ref forwarding
- Add `displayName` for forwardRef components
- Use `cn()` utility for conditional class names

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
```

- Use `'use client'` directive for client components (hooks, providers, interactive components)
- Server components are the default (no directive needed)

### API Routes (Next.js App Router)

- Export async functions for HTTP methods: `GET`, `POST`, `PUT`, `DELETE`
- Always authenticate requests using `auth()` from `@/lib/auth`
- Return `NextResponse.json()` for JSON responses
- Include proper HTTP status codes

```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... logic

  return NextResponse.json(data)
}
```

### Error Handling

- Return JSON error responses with appropriate status codes
- Use `try/catch` for async operations that may fail
- Log errors but don't expose internal details to clients

```typescript
// API route error handling
if (!resource) {
  return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
}

// Async operation error handling
try {
  await createNamespace(name)
} catch (e: any) {
  if (e.response?.statusCode === 404) {
    // Handle 404 specifically
  } else {
    throw e
  }
}
```

### Database (Drizzle ORM)

- Schema is defined in `src/lib/db/schema.ts`
- Use `db.query.*` for queries with relations
- Use `db.select()`, `db.insert()`, `db.update()`, `db.delete()` for direct operations

```typescript
// Query with relations
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
})

// Direct select with join
const result = await db
  .select({ project: projects, teamName: teams.name })
  .from(projects)
  .innerJoin(teams, eq(teams.id, projects.teamId))
```

- Tables use singular table names in Drizzle but are exported as plural variables
- Foreign keys should use `onDelete: 'cascade'` for dependent records

### Environment Variables

- All env vars should be typed in `src/env.d.ts`
- Access via `process.env.VARIABLE_NAME`
- Never commit `.env` files; use `.env.example` as template

### Authentication

- Use `auth()` from `@/lib/auth` to get session
- Check `session?.user?.id` for authentication
- Session includes `user.id`, `user.email`, `user.name`, `user.image`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── login/             # Login page
│   ├── projects/          # Project pages
│   ├── teams/             # Team pages
│   ├── settings/          # Settings pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── providers.tsx      # Client providers
│   └── globals.css        # Global styles
├── components/
│   └── ui/                # Radix UI + Tailwind components
├── hooks/                 # Custom React hooks
├── lib/                   # Core libraries
│   ├── db/                # Drizzle ORM setup & schema
│   ├── auth.ts            # NextAuth configuration
│   ├── k8s.ts             # Kubernetes client
│   ├── flux.ts            # Flux CD integration
│   ├── github.ts          # GitHub API
│   ├── utils.ts           # Utility functions (cn)
│   └── ...                # Other modules
└── types/                 # TypeScript type augmentations
```

## Key Patterns

### Server-Sent Events (SSE)

For real-time updates (deployments), use EventSource in hooks:

```typescript
const eventSource = new EventSource(`/api/events/deployments?projectId=${projectId}`)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Handle data
}
```

### Kubernetes Client

Initialize before use:

```typescript
initK8sClient(kubeconfigPath)  // Call once
const { core, apps, custom } = getK8sClient()
```

### GitOps with Flux

Create GitRepository and Kustomization resources:

```typescript
await createGitRepository(name, namespace, { url, ref: { branch }, secretRef })
await createKustomization(name, namespace, { sourceRef, path, prune, interval })
```

## Development Workflow

1. **Before starting**: Run `bun install` to ensure dependencies are installed
2. **Database changes**: Edit `src/lib/db/schema.ts`, then run `bun run db:generate && bun run db:push`
3. **Before committing**: Run `bun run lint` to check for issues, `bun run format` to fix formatting
4. **Testing locally**: Run `bun run dev` and test at http://localhost:3001
