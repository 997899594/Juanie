# Requirements Document: Authentication Refactoring

## Introduction

本规范旨在全面重构项目的认证架构，解决代码冗余、安全隐患、架构混乱等问题。

## Glossary

- **System**: 整个认证系统
- **AuthService**: 用户认证服务
- **GitConnectionsService**: Git 连接管理服务
- **EncryptionService**: 加密服务
- **Token**: OAuth Access Token 或 Refresh Token
- **Session**: 用户会话
- **Git_Connection**: Git 平台连接记录

## Requirements

### Requirement 1: 删除冗余的 OAuth 服务

**User Story:** 作为开发者，我希望删除未使用的 OAuth 服务，以降低代码复杂度和维护成本。

#### Acceptance Criteria

1. THE System SHALL delete GitHubOAuthService file
2. THE System SHALL delete GitLabOAuthService file
3. THE System SHALL remove GitHubOAuthService and GitLabOAuthService from git-accounts.module.ts
4. THE System SHALL remove GitHubOAuthService and GitLabOAuthService exports from index.ts
5. THE System SHALL ensure no code references these deleted services

### Requirement 2: 统一 Token 加密

**User Story:** 作为系统管理员，我希望所有 Token 都加密存储，以提高系统安全性。

#### Acceptance Criteria

1. WHEN AuthService creates or updates a Git Connection, THE System SHALL encrypt the access token before storing
2. WHEN AuthService creates or updates a Git Connection with refresh token, THE System SHALL encrypt the refresh token before storing
3. THE System SHALL add ENCRYPTION_KEY to .env.example
4. THE System SHALL add encryption/decryption methods to GitConnectionsService
5. THE System SHALL create a data migration script to encrypt existing plaintext tokens

### Requirement 3: 合并重复的 Git Connection 服务

**User Story:** 作为开发者，我希望只有一个 Git Connection 服务，以避免功能重复和混淆。

#### Acceptance Criteria

1. THE System SHALL merge GitAccountLinkingService functionality into GitConnectionsService
2. THE System SHALL update git-sync router to use GitConnectionsService
3. THE System SHALL delete GitAccountLinkingService file
4. THE System SHALL delete git-accounts.module.ts file
5. THE System SHALL remove GitAccountLinkingService exports from index.ts
6. THE System SHALL ensure all tests pass after migration

### Requirement 4: 添加 Rate Limiting

**User Story:** 作为系统管理员，我希望添加请求频率限制，以防止暴力破解和 DDoS 攻击。

#### Acceptance Criteria

1. THE System SHALL add rate limiting middleware to tRPC adapter
2. THE System SHALL use Redis to store rate limit counters
3. THE System SHALL limit login attempts to 5 per minute per IP
4. THE System SHALL limit API requests to 100 per minute per user
5. WHEN rate limit is exceeded, THE System SHALL return 429 Too Many Requests error

### Requirement 5: 添加审计日志

**User Story:** 作为系统管理员，我希望记录所有认证操作，以便安全审计和问题排查。

#### Acceptance Criteria

1. THE System SHALL create auth_audit_logs table
2. WHEN user logs in, THE System SHALL log the event with IP address and user agent
3. WHEN user logs out, THE System SHALL log the event
4. WHEN OAuth token is refreshed, THE System SHALL log the event
5. WHEN Git connection is created/updated/deleted, THE System SHALL log the event
6. THE System SHALL provide API to query audit logs

### Requirement 6: 添加 Session 管理

**User Story:** 作为用户，我希望能够查看和管理我的活跃会话，以提高账户安全性。

#### Acceptance Criteria

1. THE System SHALL create sessions table in database
2. WHEN user logs in, THE System SHALL create session record in both Redis and database
3. THE System SHALL provide API to list user's active sessions
4. THE System SHALL provide API to revoke specific session
5. THE System SHALL provide API to revoke all sessions except current
6. WHEN session expires in Redis, THE System SHALL mark session as expired in database

### Requirement 7: 清理 git-sync router

**User Story:** 作为开发者，我希望删除永远不会被调用的 API endpoint，以保持代码简洁。

#### Acceptance Criteria

1. THE System SHALL delete linkGitAccount endpoint from git-sync router
2. THE System SHALL update API documentation to reflect the change
3. THE System SHALL ensure OAuth flow in AuthService handles all Git connection creation

### Requirement 8: 添加 Token 自动刷新

**User Story:** 作为用户，我希望系统自动刷新过期的 GitLab token，以避免手动重新授权。

#### Acceptance Criteria

1. WHEN GitLab token is expired, THE System SHALL automatically refresh it using refresh token
2. THE System SHALL update the refreshed token in database
3. THE System SHALL log token refresh events
4. IF refresh fails, THE System SHALL mark connection status as 'expired'
5. THE System SHALL notify user when connection status changes to 'expired'

### Requirement 9: 统一查询方式

**User Story:** 作为开发者，我希望所有数据库查询使用统一的方式，以提高代码一致性。

#### Acceptance Criteria

1. THE System SHALL use Drizzle ORM query builder (where, and, eq) for all queries
2. THE System SHALL avoid using query API (findFirst, findMany)
3. THE System SHALL update all existing queries to use query builder
4. THE System SHALL add code style guide for database queries

### Requirement 10: 添加多服务器支持测试

**User Story:** 作为开发者，我希望验证系统支持多个 GitLab 服务器，以确保功能正常。

#### Acceptance Criteria

1. THE System SHALL add test for connecting multiple GitLab servers
2. THE System SHALL verify unique constraint (userId, provider, serverUrl) works correctly
3. THE System SHALL verify user can connect to both gitlab.com and private GitLab server
4. THE System SHALL verify queries correctly filter by serverUrl

### Requirement 11: 添加安全最佳实践文档

**User Story:** 作为开发者，我希望有清晰的安全最佳实践文档，以指导未来的开发。

#### Acceptance Criteria

1. THE System SHALL create security best practices document
2. THE Document SHALL include Token encryption guidelines
3. THE Document SHALL include Rate limiting configuration
4. THE Document SHALL include Audit logging requirements
5. THE Document SHALL include Session management guidelines

### Requirement 12: 添加数据迁移脚本

**User Story:** 作为系统管理员，我希望有安全的数据迁移脚本，以加密现有的明文 Token。

#### Acceptance Criteria

1. THE System SHALL create migration script to encrypt plaintext tokens
2. THE Script SHALL backup data before migration
3. THE Script SHALL verify ENCRYPTION_KEY is set
4. THE Script SHALL encrypt all access_token and refresh_token in git_connections table
5. THE Script SHALL verify encrypted data can be decrypted correctly
6. THE Script SHALL provide rollback mechanism if migration fails
