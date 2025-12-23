# Design Document: Authentication Refactoring

## Overview

本设计文档描述了认证系统重构的详细方案，包括代码清理、安全增强、架构优化等方面。

## Architecture

### Current Architecture (Before Refactoring)

```
┌─────────────────────────────────────────────────────────────┐
│                     Authentication Layer                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ AuthService  │  │ GitHubOAuthService│  │GitLabOAuthService│
│  │  (Arctic)    │  │    (axios)       │  │    (axios)    │ │
│  │  ✅ Used     │  │  ❌ Unused       │  │  ❌ Unused    │ │
│  └──────────────┘  └──────────────────┘  └───────────────┘ │
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │GitConnectionsService │  │ GitAccountLinkingService     │ │
│  │  (No Encryption)     │  │  (With Encryption)           │ │
│  │  ✅ Used by Auth     │  │  ⚠️  Used by git-sync router │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  git_connections │
                    │  (Mixed: Plain   │
                    │   + Encrypted)   │
                    └──────────────────┘
```

### Target Architecture (After Refactoring)

```
┌─────────────────────────────────────────────────────────────┐
│                     Authentication Layer                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              AuthService (Arctic)                     │   │
│  │  - OAuth Login/Callback                               │   │
│  │  - Session Management                                 │   │
│  │  - Token Encryption ✅                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                                │
│                              ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         GitConnectionsService (Enhanced)              │   │
│  │  - CRUD Operations                                    │   │
│  │  - Token Encryption/Decryption ✅                     │   │
│  │  - Multi-Server Support ✅                            │   │
│  │  - Auto Token Refresh ✅                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              EncryptionService                        │   │
│  │  - AES-256-GCM Encryption                             │   │
│  │  - Secure Key Management                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  git_connections │
                    │  (All Encrypted) │
                    └──────────────────┘
                              │
                    ┌──────────────────┐
                    │     sessions     │
                    │  (DB + Redis)    │
                    └──────────────────┘
                              │
                    ┌──────────────────┐
                    │ auth_audit_logs  │
                    │  (All Events)    │
                    └──────────────────┘
```

## Components and Interfaces

### 1. Enhanced GitConnectionsService

```typescript
@Injectable()
export class GitConnectionsService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly encryptionService: EncryptionService,
    private readonly logger: Logger,
  ) {}

  /**
   * 创建或更新 Git 连接（加密 Token）
   */
  async upsertConnection(input: {
    userId: string
    provider: GitProvider
    providerAccountId: string
    username: string
    email?: string
    avatarUrl?: string
    accessToken: string  // 明文输入
    refreshToken?: string  // 明文输入
    expiresAt?: Date
    serverUrl: string
    serverType?: 'cloud' | 'self-hosted'
    purpose?: 'auth' | 'integration' | 'both'
    metadata?: Record<string, any>
  }): Promise<GitConnection> {
    // 加密 Token
    const encryptedAccessToken = await this.encryptionService.encrypt(input.accessToken)
    const encryptedRefreshToken = input.refreshToken
      ? await this.encryptionService.encrypt(input.refreshToken)
      : null

    // 检查是否已存在
    const existing = await this.getConnectionByProvider(
      input.userId,
      input.provider,
      input.serverUrl,
    )

    if (existing) {
      // 更新现有连接
      const [updated] = await this.db
        .update(schema.gitConnections)
        .set({
          providerAccountId: input.providerAccountId,
          username: input.username,
          email: input.email,
          avatarUrl: input.avatarUrl,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: input.expiresAt,
          status: 'active',
          purpose: input.purpose || 'both',
          metadata: input.metadata,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.gitConnections.id, existing.id))
        .returning()

      if (!updated) {
        throw new Error('Failed to update Git connection')
      }

      this.logger.info(`Updated Git connection for user ${input.userId} (${input.provider})`)
      return updated
    }

    // 创建新连接
    const [created] = await this.db
      .insert(schema.gitConnections)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        username: input.username,
        email: input.email,
        avatarUrl: input.avatarUrl,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: input.expiresAt,
        status: 'active',
        purpose: input.purpose || 'both',
        serverUrl: input.serverUrl,
        serverType: input.serverType || 'cloud',
        metadata: input.metadata,
        connectedAt: new Date(),
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create Git connection')
    }

    this.logger.info(`Created Git connection for user ${input.userId} (${input.provider})`)
    return created
  }

  /**
   * 获取 Git 连接（解密 Token）
   */
  async getConnectionWithDecryptedTokens(
    userId: string,
    provider: GitProvider,
    serverUrl?: string,
  ): Promise<GitConnection | null> {
    const connection = await this.getConnectionByProvider(userId, provider, serverUrl)
    
    if (!connection) {
      return null
    }

    // 解密 Token
    const decryptedAccessToken = await this.encryptionService.decrypt(connection.accessToken)
    const decryptedRefreshToken = connection.refreshToken
      ? await this.encryptionService.decrypt(connection.refreshToken)
      : null

    return {
      ...connection,
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    }
  }

  /**
   * 刷新 GitLab Access Token
   */
  async refreshGitLabToken(
    userId: string,
    provider: 'gitlab',
    serverUrl: string,
  ): Promise<void> {
    const connection = await this.getConnectionWithDecryptedTokens(userId, provider, serverUrl)
    
    if (!connection || !connection.refreshToken) {
      throw new Error('No refresh token available')
    }

    // 调用 GitLab API 刷新 Token
    const gitlabBase = serverUrl.replace(/\/+$/, '')
    const response = await fetch(`${gitlabBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      // 刷新失败，标记为过期
      await this.updateConnectionStatus(userId, provider, 'expired')
      throw new Error('Failed to refresh GitLab token')
    }

    const tokens = await response.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    // 更新 Token
    await this.refreshAccessToken(
      userId,
      provider,
      tokens.access_token,
      tokens.refresh_token,
      new Date(Date.now() + tokens.expires_in * 1000),
    )

    this.logger.info(`Refreshed GitLab token for user ${userId}`)
  }
}
```

### 2. Session Management

#### Database Schema

```typescript
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull().unique(), // Redis key
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    
    // Session 信息
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    deviceInfo: jsonb('device_info').$type<{
      browser?: string
      os?: string
      device?: string
    }>(),
    
    // 状态
    status: text('status').notNull().default('active'), // 'active' | 'expired' | 'revoked'
    
    // 时间戳
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [
    index('sessions_user_idx').on(table.userId),
    index('sessions_status_idx').on(table.status),
    index('sessions_session_id_idx').on(table.sessionId),
  ],
)
```

#### SessionService

```typescript
@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  /**
   * 创建会话（Redis + Database）
   */
  async createSession(input: {
    userId: string
    ipAddress?: string
    userAgent?: string
    deviceInfo?: Record<string, any>
  }): Promise<string> {
    const sessionId = generateId()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // 存储到 Redis
    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify({ userId: input.userId, createdAt: Date.now() }),
    )

    // 存储到 Database
    await this.db.insert(schema.sessions).values({
      sessionId,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceInfo: input.deviceInfo,
      status: 'active',
      expiresAt,
    })

    this.logger.info(`Created session for user ${input.userId}`)
    return sessionId
  }

  /**
   * 获取用户的所有活跃会话
   */
  async listUserSessions(userId: string): Promise<Session[]> {
    return await this.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, userId),
          eq(schema.sessions.status, 'active'),
        ),
      )
      .orderBy(desc(schema.sessions.lastActivityAt))
  }

  /**
   * 撤销指定会话
   */
  async revokeSession(sessionId: string): Promise<void> {
    // 从 Redis 删除
    await this.redis.del(`session:${sessionId}`)

    // 更新 Database 状态
    await this.db
      .update(schema.sessions)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(schema.sessions.sessionId, sessionId))

    this.logger.info(`Revoked session ${sessionId}`)
  }

  /**
   * 撤销用户的所有会话（除了当前会话）
   */
  async revokeAllSessionsExceptCurrent(
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    // 获取所有活跃会话
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, userId),
          eq(schema.sessions.status, 'active'),
          ne(schema.sessions.sessionId, currentSessionId),
        ),
      )

    // 批量删除 Redis
    const pipeline = this.redis.pipeline()
    for (const session of sessions) {
      pipeline.del(`session:${session.sessionId}`)
    }
    await pipeline.exec()

    // 批量更新 Database
    const result = await this.db
      .update(schema.sessions)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(
        and(
          eq(schema.sessions.userId, userId),
          eq(schema.sessions.status, 'active'),
          ne(schema.sessions.sessionId, currentSessionId),
        ),
      )

    this.logger.info(`Revoked ${sessions.length} sessions for user ${userId}`)
    return sessions.length
  }
}
```

### 3. Audit Logging

#### Database Schema

```typescript
export const authAuditLogs = pgTable(
  'auth_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    
    // 事件信息
    event: text('event').notNull(), // 'login', 'logout', 'token_refresh', 'connection_created', etc.
    provider: text('provider'), // 'github', 'gitlab', null
    
    // 请求信息
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    
    // 结果
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    
    // 元数据
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    
    // 时间戳
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('auth_audit_logs_user_idx').on(table.userId),
    index('auth_audit_logs_event_idx').on(table.event),
    index('auth_audit_logs_created_idx').on(table.createdAt),
  ],
)
```

#### AuditService

```typescript
@Injectable()
export class AuditService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly logger: Logger,
  ) {}

  /**
   * 记录审计日志
   */
  async log(input: {
    userId?: string
    event: string
    provider?: GitProvider
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.db.insert(schema.authAuditLogs).values(input)
    
    this.logger.info(`Audit log: ${input.event} - ${input.success ? 'success' : 'failed'}`)
  }

  /**
   * 查询审计日志
   */
  async queryLogs(input: {
    userId?: string
    event?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }): Promise<AuthAuditLog[]> {
    const conditions = []
    
    if (input.userId) {
      conditions.push(eq(schema.authAuditLogs.userId, input.userId))
    }
    
    if (input.event) {
      conditions.push(eq(schema.authAuditLogs.event, input.event))
    }
    
    if (input.startDate) {
      conditions.push(gte(schema.authAuditLogs.createdAt, input.startDate))
    }
    
    if (input.endDate) {
      conditions.push(lte(schema.authAuditLogs.createdAt, input.endDate))
    }

    return await this.db
      .select()
      .from(schema.authAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.authAuditLogs.createdAt))
      .limit(input.limit || 50)
      .offset(input.offset || 0)
  }
}
```

### 4. Rate Limiting

```typescript
@Injectable()
export class RateLimitService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  /**
   * 检查是否超过速率限制
   */
  async checkRateLimit(input: {
    key: string  // 例如: 'login:192.168.1.1' 或 'api:user-123'
    limit: number  // 例如: 5
    window: number  // 秒，例如: 60
  }): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const redisKey = `ratelimit:${input.key}`
    const now = Date.now()
    const windowMs = input.window * 1000

    // 使用 Redis sorted set 存储请求时间戳
    const pipeline = this.redis.pipeline()
    
    // 删除窗口外的记录
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs)
    
    // 添加当前请求
    pipeline.zadd(redisKey, now, `${now}`)
    
    // 获取窗口内的请求数
    pipeline.zcard(redisKey)
    
    // 设置过期时间
    pipeline.expire(redisKey, input.window)
    
    const results = await pipeline.exec()
    const count = results?.[2]?.[1] as number || 0

    const allowed = count <= input.limit
    const remaining = Math.max(0, input.limit - count)
    const resetAt = new Date(now + windowMs)

    if (!allowed) {
      this.logger.warn(`Rate limit exceeded for ${input.key}`)
    }

    return { allowed, remaining, resetAt }
  }
}
```

## Data Models

### Updated git_connections Schema

```typescript
export const gitConnections = pgTable(
  'git_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Git 平台信息
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),

    // Git 用户信息
    username: text('username').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),

    // OAuth 凭证（AES-256-GCM 加密存储）
    accessToken: text('access_token').notNull(), // 加密后的格式: iv:authTag:ciphertext
    refreshToken: text('refresh_token'), // 加密后的格式: iv:authTag:ciphertext
    expiresAt: timestamp('expires_at'),

    // 状态管理
    status: text('status').notNull().default('active'),

    // 用途标识
    purpose: text('purpose').notNull().default('both'),

    // Git 服务器配置
    serverUrl: text('server_url').notNull(),
    serverType: text('server_type').notNull().default('cloud'),

    // 元数据
    metadata: jsonb('metadata').$type<{
      serverVersion?: string
      serverName?: string
      scopes?: string[]
      [key: string]: any
    }>(),

    // 同步状态
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastSyncAt: timestamp('last_sync_at'),

    // 时间戳
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('git_connections_user_provider_server_unique').on(
      table.userId,
      table.provider,
      table.serverUrl,
    ),
    index('git_connections_user_idx').on(table.userId),
    index('git_connections_provider_idx').on(table.provider),
    index('git_connections_status_idx').on(table.status),
    index('git_connections_provider_account_idx').on(table.providerAccountId),
  ],
)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Encryption Round Trip
*For any* valid access token or refresh token, encrypting then decrypting should produce the original value.
**Validates: Requirements 2.1, 2.2**

### Property 2: All Tokens Are Encrypted
*For any* git_connection record in the database, the access_token field should be in encrypted format (iv:authTag:ciphertext).
**Validates: Requirements 2.1, 2.2**

### Property 3: Rate Limit Enforcement
*For any* IP address or user, when the number of requests exceeds the limit within the time window, subsequent requests should be rejected with 429 error.
**Validates: Requirements 4.1, 4.5**

### Property 4: Audit Log Completeness
*For any* authentication event (login, logout, token refresh, connection CRUD), an audit log entry should be created.
**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 5: Session Consistency
*For any* active session, it should exist in both Redis and database with consistent data.
**Validates: Requirements 6.2**

### Property 6: Session Revocation
*For any* revoked session, it should be removed from Redis and marked as 'revoked' in database.
**Validates: Requirements 6.4, 6.5**

### Property 7: Multi-Server Support
*For any* user, they should be able to connect to multiple GitLab servers (different serverUrl) simultaneously.
**Validates: Requirements 10.2, 10.3**

### Property 8: Token Auto Refresh
*For any* expired GitLab token with valid refresh token, the system should automatically refresh it and update the database.
**Validates: Requirements 8.1, 8.2**

## Error Handling

### Token Encryption Errors
- If ENCRYPTION_KEY is not set, throw clear error message
- If encryption fails, log error and throw exception
- If decryption fails, mark connection as 'expired' and notify user

### Rate Limit Errors
- Return 429 Too Many Requests with Retry-After header
- Include remaining quota in response headers
- Log rate limit violations for security monitoring

### Session Errors
- If session not found in Redis but exists in DB, mark as expired
- If session expired, return 401 Unauthorized
- If session revoked, return 401 Unauthorized with specific message

### Audit Log Errors
- If audit log write fails, log error but don't block main operation
- Implement retry mechanism for failed audit logs
- Alert admin if audit log system is down

## Testing Strategy

### Unit Tests
- Test EncryptionService encrypt/decrypt methods
- Test RateLimitService with various scenarios
- Test SessionService CRUD operations
- Test AuditService log creation and querying

### Property-Based Tests
- Test Token encryption round trip with random tokens (Property 1)
- Test Rate limit enforcement with random request patterns (Property 3)
- Test Session consistency between Redis and DB (Property 5)
- Test Multi-server support with random server URLs (Property 7)

### Integration Tests
- Test complete OAuth flow with token encryption
- Test rate limiting across multiple requests
- Test session management across login/logout
- Test audit logging for all auth events

### Migration Tests
- Test data migration script with sample data
- Test rollback mechanism
- Verify all tokens are encrypted after migration
- Verify decryption works correctly after migration

## Migration Plan

### Phase 1: Preparation (Day 1)
1. Add ENCRYPTION_KEY to .env.example
2. Create database migration for new tables (sessions, auth_audit_logs)
3. Run database migration
4. Verify tables created successfully

### Phase 2: Code Cleanup (Day 1-2)
1. Delete GitHubOAuthService and GitLabOAuthService
2. Update git-accounts.module.ts
3. Update index.ts exports
4. Run tests to ensure no breakage

### Phase 3: Add Encryption to GitConnectionsService (Day 2-3)
1. Add encryption/decryption methods
2. Update upsertConnection to encrypt tokens
3. Add getConnectionWithDecryptedTokens method
4. Update all callers to use new methods
5. Run tests

### Phase 4: Migrate Existing Data (Day 3)
1. Create backup of git_connections table
2. Run migration script to encrypt plaintext tokens
3. Verify all tokens encrypted correctly
4. Test decryption works

### Phase 5: Merge Services (Day 3-4)
1. Move GitAccountLinkingService functionality to GitConnectionsService
2. Update git-sync router to use GitConnectionsService
3. Delete GitAccountLinkingService
4. Delete git-accounts.module.ts
5. Run tests

### Phase 6: Add New Features (Day 4-5)
1. Implement SessionService
2. Implement AuditService
3. Implement RateLimitService
4. Add Token auto-refresh
5. Run tests

### Phase 7: Integration and Testing (Day 5-6)
1. Update AuthService to use new services
2. Add rate limiting middleware
3. Add audit logging to all auth operations
4. Run integration tests
5. Manual testing

### Phase 8: Documentation and Deployment (Day 6)
1. Update API documentation
2. Update security best practices document
3. Create deployment guide
4. Deploy to staging
5. Verify in staging
6. Deploy to production
