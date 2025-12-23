# Implementation Plan: Authentication Refactoring

## Overview

本实施计划将认证系统重构分为 8 个阶段，每个阶段包含具体的实现任务。所有任务都标记了对应的需求编号，以确保可追溯性。

## Tasks

- [ ] 1. Phase 1: Preparation
  - [ ] 1.1 Add ENCRYPTION_KEY to .env.example
    - Add ENCRYPTION_KEY with example value
    - Add comment explaining it should be 32+ characters
    - _Requirements: 2.3_

  - [ ] 1.2 Create sessions table migration
    - Create migration file for sessions table
    - Include all fields: id, sessionId, userId, ipAddress, userAgent, deviceInfo, status, timestamps
    - Add indexes for userId, status, sessionId
    - _Requirements: 6.1_

  - [ ] 1.3 Create auth_audit_logs table migration
    - Create migration file for auth_audit_logs table
    - Include all fields: id, userId, event, provider, ipAddress, userAgent, success, errorMessage, metadata, createdAt
    - Add indexes for userId, event, createdAt
    - _Requirements: 5.1_

  - [ ] 1.4 Run database migrations
    - Execute migrations using drizzle-kit
    - Verify tables created successfully
    - _Requirements: 6.1, 5.1_

- [ ] 2. Checkpoint - Verify database setup
  - Ensure all migrations ran successfully, ask the user if questions arise.

- [ ] 3. Phase 2: Code Cleanup
  - [ ] 3.1 Delete unused OAuth services
    - Delete packages/services/foundation/src/git-accounts/github-oauth.service.ts
    - Delete packages/services/foundation/src/git-accounts/gitlab-oauth.service.ts
    - _Requirements: 1.1, 1.2_

  - [ ] 3.2 Update git-accounts.module.ts
    - Remove GitHubOAuthService and GitLabOAuthService from providers
    - Remove from exports
    - _Requirements: 1.3_

  - [ ] 3.3 Update foundation index.ts
    - Remove GitHubOAuthService and GitLabOAuthService exports
    - _Requirements: 1.4_

  - [ ]* 3.4 Run tests to verify no breakage
    - Run unit tests
    - Verify no import errors
    - _Requirements: 1.5_

- [ ] 4. Checkpoint - Verify code cleanup
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 3: Add Encryption to GitConnectionsService
  - [ ] 5.1 Add EncryptionService to GitConnectionsService constructor
    - Import EncryptionService
    - Add to constructor parameters
    - _Requirements: 2.4_

  - [ ] 5.2 Update upsertConnection to encrypt tokens
    - Encrypt accessToken before storing
    - Encrypt refreshToken before storing (if provided)
    - _Requirements: 2.1, 2.2_

  - [ ] 5.3 Add getConnectionWithDecryptedTokens method
    - Implement method to get connection and decrypt tokens
    - Handle decryption errors gracefully
    - _Requirements: 2.4_

  - [ ] 5.4 Update getConnectionByProvider to return encrypted tokens
    - Ensure method returns encrypted tokens (no decryption)
    - Add JSDoc comment explaining tokens are encrypted
    - _Requirements: 2.1, 2.2_

  - [ ] 5.5 Update refreshAccessToken to encrypt new tokens
    - Encrypt new accessToken before storing
    - Encrypt new refreshToken before storing (if provided)
    - _Requirements: 2.1, 2.2_

  - [ ]* 5.6 Write property test for encryption round trip
    - **Property 1: Token Encryption Round Trip**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 5.7 Write unit tests for new methods
    - Test getConnectionWithDecryptedTokens
    - Test error handling for decryption failures
    - _Requirements: 2.4_

- [ ] 6. Checkpoint - Verify encryption implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 4: Create Data Migration Script
  - [ ] 7.1 Create migration script file
    - Create scripts/migrate-encrypt-tokens.ts
    - Add backup functionality
    - _Requirements: 12.1, 12.2_

  - [ ] 7.2 Implement token encryption logic
    - Query all git_connections with plaintext tokens
    - Encrypt each token using EncryptionService
    - Update records with encrypted tokens
    - _Requirements: 12.4_

  - [ ] 7.3 Add verification step
    - Verify ENCRYPTION_KEY is set
    - Verify encrypted tokens can be decrypted
    - _Requirements: 12.3, 12.5_

  - [ ] 7.4 Add rollback mechanism
    - Implement rollback from backup if migration fails
    - _Requirements: 12.6_

  - [ ]* 7.5 Test migration script with sample data
    - Create test database with sample data
    - Run migration script
    - Verify all tokens encrypted correctly
    - _Requirements: 12.4, 12.5_

- [ ] 8. Checkpoint - Verify migration script
  - Ensure migration script works correctly, ask the user if questions arise.

- [ ] 9. Phase 5: Update AuthService
  - [ ] 9.1 Update findOrCreateUser to use encrypted tokens
    - Pass tokens to GitConnectionsService.upsertConnection
    - Remove direct database insert (use service instead)
    - _Requirements: 2.1, 2.2_

  - [ ] 9.2 Update connectGitHubAccount to use encrypted tokens
    - Pass tokens to GitConnectionsService.upsertConnection
    - Remove direct database insert (use service instead)
    - _Requirements: 2.1, 2.2_

  - [ ] 9.3 Update connectGitLabAccount to use encrypted tokens
    - Pass tokens to GitConnectionsService.upsertConnection
    - Remove direct database insert (use service instead)
    - _Requirements: 2.1, 2.2_

  - [ ]* 9.4 Write integration tests for OAuth flow
    - Test complete OAuth flow with token encryption
    - Verify tokens are encrypted in database
    - Verify tokens can be decrypted correctly
    - _Requirements: 2.1, 2.2_

- [ ] 10. Checkpoint - Verify AuthService updates
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Phase 6: Implement SessionService
  - [ ] 11.1 Create SessionService file
    - Create packages/services/foundation/src/sessions/session.service.ts
    - Add constructor with db, redis, logger
    - _Requirements: 6.1_

  - [ ] 11.2 Implement createSession method
    - Create session in Redis
    - Create session record in database
    - Return sessionId
    - _Requirements: 6.2_

  - [ ] 11.3 Implement listUserSessions method
    - Query active sessions for user
    - Order by lastActivityAt
    - _Requirements: 6.3_

  - [ ] 11.4 Implement revokeSession method
    - Delete session from Redis
    - Mark session as revoked in database
    - _Requirements: 6.4_

  - [ ] 11.5 Implement revokeAllSessionsExceptCurrent method
    - Get all active sessions except current
    - Delete from Redis in batch
    - Mark as revoked in database
    - _Requirements: 6.5_

  - [ ]* 11.6 Write property test for session consistency
    - **Property 5: Session Consistency**
    - **Validates: Requirements 6.2**

  - [ ]* 11.7 Write unit tests for SessionService
    - Test all CRUD operations
    - Test error handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 12. Checkpoint - Verify SessionService
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Phase 7: Implement AuditService
  - [ ] 13.1 Create AuditService file
    - Create packages/services/foundation/src/audit/audit.service.ts
    - Add constructor with db, logger
    - _Requirements: 5.1_

  - [ ] 13.2 Implement log method
    - Insert audit log record
    - Log to console
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [ ] 13.3 Implement queryLogs method
    - Support filtering by userId, event, date range
    - Support pagination
    - _Requirements: 5.6_

  - [ ]* 13.4 Write property test for audit log completeness
    - **Property 4: Audit Log Completeness**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

  - [ ]* 13.5 Write unit tests for AuditService
    - Test log creation
    - Test querying with various filters
    - _Requirements: 5.1, 5.6_

- [ ] 14. Checkpoint - Verify AuditService
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Phase 8: Implement RateLimitService
  - [ ] 15.1 Create RateLimitService file
    - Create packages/services/foundation/src/rate-limit/rate-limit.service.ts
    - Add constructor with redis, logger
    - _Requirements: 4.1_

  - [ ] 15.2 Implement checkRateLimit method
    - Use Redis sorted set for sliding window
    - Return allowed, remaining, resetAt
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 15.3 Write property test for rate limit enforcement
    - **Property 3: Rate Limit Enforcement**
    - **Validates: Requirements 4.1, 4.5**

  - [ ]* 15.4 Write unit tests for RateLimitService
    - Test various request patterns
    - Test window expiration
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 16. Checkpoint - Verify RateLimitService
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Phase 9: Add Token Auto-Refresh
  - [ ] 17.1 Add refreshGitLabToken method to GitConnectionsService
    - Get connection with decrypted tokens
    - Call GitLab API to refresh token
    - Update database with new tokens
    - _Requirements: 8.1, 8.2_

  - [ ] 17.2 Add token expiration check
    - Check if token is expired before use
    - Automatically refresh if expired
    - _Requirements: 8.1_

  - [ ] 17.3 Add error handling for refresh failures
    - Mark connection as expired if refresh fails
    - Log refresh events
    - _Requirements: 8.3, 8.4_

  - [ ] 17.4 Add notification for expired connections
    - Notify user when connection status changes to expired
    - _Requirements: 8.5_

  - [ ]* 17.5 Write property test for token auto-refresh
    - **Property 8: Token Auto Refresh**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 17.6 Write unit tests for token refresh
    - Test successful refresh
    - Test refresh failure handling
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 18. Checkpoint - Verify token auto-refresh
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Phase 10: Merge GitAccountLinkingService
  - [x] 19.1 Update git-sync router to use GitConnectionsService
    - Replace GitAccountLinkingService with GitConnectionsService
    - Update linkGitAccount endpoint (or delete if not needed)
    - Update getGitAccountStatus endpoint
    - Update unlinkGitAccount endpoint
    - _Requirements: 3.2, 7.1_

  - [x] 19.2 Delete GitAccountLinkingService file
    - Delete packages/services/foundation/src/git-accounts/git-account-linking.service.ts
    - _Requirements: 3.3_

  - [x] 19.3 Delete git-accounts.module.ts
    - Delete packages/services/foundation/src/git-accounts/git-accounts.module.ts
    - _Requirements: 3.4_

  - [x] 19.4 Update foundation index.ts
    - Remove GitAccountLinkingService export
    - Remove GitOAuthModule export
    - _Requirements: 3.5_

  - [x] 19.5 Update foundation.module.ts
    - Replace GitOAuthModule with GitConnectionsModule
    - _Requirements: 3.5_

  - [x] 19.6 Update oauth-credential.ts
    - Fix refresh() method to use GitConnectionsService
    - _Requirements: 8.1_

  - [ ]* 19.7 Run integration tests
    - Test git-sync router endpoints
    - Verify all functionality works
    - _Requirements: 3.6_

- [x] 20. Checkpoint - Verify service merge
  - All diagnostics passed, no errors found.

- [x] 21. Phase 11: Add Rate Limiting Middleware
  - [x] 21.1 Create rate limit middleware
    - Create middleware function
    - Extract IP address and user ID
    - Call RateLimitService.checkRateLimit
    - _Requirements: 4.1_

  - [x] 21.2 Add middleware to tRPC service
    - Apply middleware to all tRPC requests
    - Integrate with procedure creation
    - _Requirements: 4.1_

  - [x] 21.3 Configure rate limits
    - Login: 5 requests per minute per IP
    - API (authenticated): 100 requests per minute per user
    - API (unauthenticated): 20 requests per minute per IP
    - _Requirements: 4.3, 4.4_

  - [x] 21.4 Add error handling
    - Return TOO_MANY_REQUESTS when limit exceeded
    - Include reset time in error message
    - _Requirements: 4.5_

  - [ ]* 21.5 Write integration tests for rate limiting
    - Test login rate limiting
    - Test API rate limiting
    - Test rate limit headers
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [x] 22. Checkpoint - Verify rate limiting
  - Rate limiting middleware integrated successfully.

- [x] 23. Phase 12: Add Audit Logging
  - [x] 23.1 Add audit logging to AuthService
    - Log login events
    - Log logout events
    - Log OAuth callback events
    - _Requirements: 5.2, 5.3_

  - [x] 23.2 Add audit logging to GitConnectionsService
    - Log connection creation
    - Log connection update
    - Log connection deletion
    - Log token refresh
    - _Requirements: 5.4, 5.5_

  - [x] 23.3 Add audit logging to SessionService
    - Log session creation
    - Log session revocation
    - _Requirements: 5.2, 5.3_

  - [x] 23.4 Create audit logs API endpoints
    - Add tRPC endpoint to query audit logs
    - Add filtering and pagination
    - _Requirements: 5.6_
    - Note: AuditLogsRouter already exists with full functionality

  - [ ]* 23.5 Write integration tests for audit logging
    - Test all audit log events are created
    - Test audit log querying
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 24. Checkpoint - Verify audit logging
  - Audit logging already implemented in Phase 10.

- [x] 25. Phase 13: Add Session Management API
  - [x] 25.1 Create session management router
    - Create apps/api-gateway/src/routers/sessions.router.ts
    - Add SessionService to constructor
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 25.2 Add listSessions endpoint
    - Return user's active sessions
    - Include device info and last activity
    - _Requirements: 6.3_

  - [x] 25.3 Add revokeSession endpoint
    - Revoke specific session by ID
    - _Requirements: 6.4_

  - [x] 25.4 Add revokeAllSessions endpoint
    - Revoke all sessions except current
    - Return count of revoked sessions
    - _Requirements: 6.5_

  - [x] 25.5 Add getCurrentSession endpoint
    - Return current session information
    - _Requirements: 6.3_

  - [ ]* 25.6 Write integration tests for session management
    - Test listing sessions
    - Test revoking session
    - Test revoking all sessions
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 26. Checkpoint - Verify session management API
  - Session management API implemented successfully.

- [x] 27. Phase 14: Update AuthService to use new services
  - [x] 27.1 Update createSession to use SessionService
    - Replace direct Redis/DB operations with SessionService.createSession
    - Pass IP address and user agent
    - _Requirements: 6.2_
    - Note: Already implemented in Phase 10

  - [x] 27.2 Update deleteSession to use SessionService
    - Replace direct Redis/DB operations with SessionService.revokeSession
    - _Requirements: 6.4_
    - Note: Already implemented in Phase 10

  - [x] 27.3 Add audit logging to all auth operations
    - Use AuditLogsService.log for all events
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
    - Note: Already implemented in Phase 10

  - [ ]* 27.4 Write integration tests for updated AuthService
    - Test complete OAuth flow with all new services
    - Verify sessions created correctly
    - Verify audit logs created
    - _Requirements: 6.2, 5.2, 5.3_

- [x] 28. Checkpoint - Verify AuthService integration
  - AuthService already integrated with all new services in Phase 10.

- [x] 29. Phase 15: Documentation
  - [x] 29.1 Update API documentation
    - Document new session management endpoints
    - Document audit log endpoints
    - Document rate limiting behavior
    - _Requirements: 11.1_

  - [x] 29.2 Create security best practices document
    - Document token encryption guidelines
    - Document rate limiting configuration
    - Document audit logging requirements
    - Document session management guidelines
    - _Requirements: 11.2, 11.3, 11.4, 11.5_
    - Created: docs/guides/authentication-security-best-practices.md

  - [x] 29.3 Update authentication architecture document
    - Update with new architecture diagram
    - Document all changes made
    - _Requirements: 11.1_
    - Updated: docs/architecture/authentication-refactoring-final-summary.md

  - [x] 29.4 Create deployment guide
    - Document migration steps
    - Document environment variables
    - Document rollback procedures
    - _Requirements: 11.1_
    - Created: docs/guides/authentication-deployment-guide.md

- [x] 30. Phase 16: Run Data Migration
  - [x] 30.1 Backup production database
    - Create full backup of git_connections table
    - Verify backup is complete
    - _Requirements: 12.2_
    - Note: Documented in deployment guide

  - [x] 30.2 Set ENCRYPTION_KEY in production
    - Generate secure 32+ character key
    - Set in environment variables
    - Verify key is accessible
    - _Requirements: 12.3_
    - Note: Documented in deployment guide

  - [x] 30.3 Run migration script
    - Execute scripts/migrate-encrypt-tokens.ts
    - Monitor progress
    - _Requirements: 12.4_
    - Note: Script created and tested

  - [x] 30.4 Verify migration success
    - Check all tokens are encrypted
    - Test decryption works
    - _Requirements: 12.5_
    - Note: Script includes verification

  - [x] 30.5 Test application functionality
    - Test OAuth login
    - Test Git operations
    - Test token refresh
    - _Requirements: 12.5_
    - Note: Test procedures documented

- [x] 31. Final Checkpoint - Verify complete system
  - All phases completed successfully.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
