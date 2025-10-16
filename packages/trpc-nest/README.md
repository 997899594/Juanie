# @trpc/nest

tRPC integration for NestJS with decorators and dependency injection support.

## Features

- 🎯 **Decorator-based API**: Use familiar NestJS decorators to define tRPC procedures
- 🔄 **Dependency Injection**: Full support for NestJS DI system
- 🛡️ **Type Safety**: End-to-end type safety with TypeScript
- 🔐 **Authentication & Authorization**: Built-in auth and permission decorators
- 🎨 **Flexible Configuration**: Support for both sync and async module configuration
- 🔍 **Auto Discovery**: Automatically discover and register tRPC routers

## Installation

```bash
npm install @trpc/nest @trpc/server @nestjs/common @nestjs/core
# or
yarn add @trpc/nest @trpc/server @nestjs/common @nestjs/core
# or
bun add @trpc/nest @trpc/server @nestjs/common @nestjs/core
```

## Quick Start

### 1. Configure the Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { TrpcModule } from '@trpc/nest'
import { initTRPC } from '@trpc/server'

const t = initTRPC.create()

@Module({
  imports: [
    TrpcModule.forRoot({
      trpc: t,
      createContext: ({ req, res }) => ({ req, res }),
      development: true,
    }),
  ],
})
export class AppModule {}
```

### 2. Create a tRPC Router

```typescript
// user.router.ts
import { Injectable } from '@nestjs/common'
import { TrpcRouter, TrpcQuery, TrpcMutation } from '@trpc/nest'
import { z } from 'zod'

@TrpcRouter({ name: 'user' })
@Injectable()
export class UserRouter {
  @TrpcQuery({
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string() })
  })
  async getUser(input: { id: string }) {
    return { id: input.id, name: 'John Doe' }
  }

  @TrpcMutation({
    input: z.object({ name: z.string(), email: z.string().email() }),
    requireAuth: true
  })
  async createUser(input: { name: string; email: string }) {
    return { id: '1', name: input.name, email: input.email }
  }
}
```

### 3. Register the Router

```typescript
// user.module.ts
import { Module } from '@nestjs/common'
import { UserRouter } from './user.router'

@Module({
  providers: [UserRouter],
})
export class UserModule {}
```

## API Reference

### Decorators

#### `@TrpcRouter(config?)`

Marks a class as a tRPC router.

```typescript
@TrpcRouter({ 
  name: 'user',      // Router name (default: class name without 'Router' suffix)
  path: '/users',    // Router path (default: /name)
  middleware: true   // Enable middleware (default: true)
})
```

#### `@TrpcQuery(options?)`

Defines a tRPC query procedure.

```typescript
@TrpcQuery({
  name: 'getUser',           // Procedure name (default: method name)
  input: z.object({...}),    // Input validation schema
  output: z.object({...}),   // Output validation schema
  description: 'Get user',   // Procedure description
  requireAuth: true,         // Require authentication
  permissions: ['read'],     // Required permissions
  middleware: ['logging'],   // Custom middleware
  meta: { cache: true }      // Custom metadata
})
```

#### `@TrpcMutation(options?)`

Defines a tRPC mutation procedure.

```typescript
@TrpcMutation({
  input: z.object({...}),
  requireAuth: true,
  permissions: ['write']
})
```

#### `@Input(schema)`

Adds input validation to a procedure.

```typescript
@Input(z.object({ id: z.string() }))
```

#### `@Output(schema)`

Adds output validation to a procedure.

```typescript
@Output(z.object({ success: z.boolean() }))
```

#### `@RequireAuth()`

Requires authentication for a procedure.

```typescript
@RequireAuth()
```

#### `@RequirePermissions(...permissions)`

Requires specific permissions for a procedure.

```typescript
@RequirePermissions('user:read', 'user:write')
```

### Module Configuration

#### Synchronous Configuration

```typescript
TrpcModule.forRoot({
  trpc: t,                           // tRPC instance
  createContext: (req, res) => ({}), // Context creator
  useGlobalPrefix: false,            // Use global prefix
  prefix: 'trpc',                    // Route prefix
  development: true                  // Development mode
})
```

#### Asynchronous Configuration

```typescript
TrpcModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    trpc: initTRPC.create(),
    createContext: ({ req, res }) => ({ req, res, config }),
    development: config.get('NODE_ENV') === 'development'
  })
})
```

### Service API

```typescript
// Inject TrpcService to access routers programmatically
constructor(private readonly trpcService: TrpcService) {}

// Get the main app router
const appRouter = this.trpcService.getAppRouter()

// Get a specific router
const userRouter = this.trpcService.getRouter('user')

// Get all routers
const allRouters = this.trpcService.getAllRouters()

// Register a router manually
this.trpcService.registerRouter('custom', customRouter)

// Get statistics
const stats = this.trpcService.getStats()
```

## Advanced Usage

### Custom Context

```typescript
interface CustomContext {
  user?: User
  db: Database
}

TrpcModule.forRoot({
  trpc: t,
  createContext: async ({ req }): Promise<CustomContext> => {
    const user = await getUserFromToken(req.headers.authorization)
    return { user, db: getDatabase() }
  }
})
```

### Middleware

```typescript
@TrpcRouter()
@Injectable()
export class UserRouter {
  @TrpcQuery({
    middleware: ['auth', 'logging']
  })
  async getUser() {
    // This procedure will use auth and logging middleware
  }
}
```

### Nested Routers

```typescript
@TrpcRouter({ name: 'admin' })
@Injectable()
export class AdminRouter {
  @TrpcQuery()
  async getUsers() {
    return []
  }
}

// Results in: trpc.admin.getUsers()
```

## License

MIT