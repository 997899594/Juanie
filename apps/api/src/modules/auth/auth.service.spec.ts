import { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthService } from './auth.service'

describe('AuthService', () => {
  let authService: AuthService
  let mockDb: any
  let mockRedis: any
  let mockConfig: ConfigService

  beforeEach(() => {
    // Mock 数据库
    mockDb = {
      transaction: vi.fn(),
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    }

    // Mock Redis
    mockRedis = {
      setex: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    }

    // Mock ConfigService
    mockConfig = {
      get: vi.fn((key: string) => {
        const config: Record<string, string> = {
          GITHUB_CLIENT_ID: 'test-github-id',
          GITHUB_CLIENT_SECRET: 'test-github-secret',
          GITLAB_CLIENT_ID: 'test-gitlab-id',
          GITLAB_CLIENT_SECRET: 'test-gitlab-secret',
          APP_URL: 'http://localhost:3001',
        }
        return config[key]
      }),
    } as any

    authService = new AuthService(mockDb, mockRedis, mockConfig)
  })

  describe('getGitHubAuthUrl', () => {
    it('should generate GitHub OAuth URL and store state', async () => {
      mockRedis.setex.mockResolvedValue('OK')

      const result = await authService.getGitHubAuthUrl()

      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('state')
      expect(result.url).toContain('github.com')
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('oauth:github:'),
        600,
        'pending',
      )
    })
  })

  describe('getGitLabAuthUrl', () => {
    it('should generate GitLab OAuth URL and store state', async () => {
      mockRedis.setex.mockResolvedValue('OK')

      const result = await authService.getGitLabAuthUrl()

      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('state')
      expect(result.url).toContain('gitlab.com')
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('oauth:gitlab:'),
        600,
        'pending',
      )
    })
  })

  describe('handleGitHubCallback', () => {
    it('should throw error if state is invalid', async () => {
      mockRedis.get.mockResolvedValue(null)

      await expect(authService.handleGitHubCallback('test-code', 'invalid-state')).rejects.toThrow(
        'Invalid state',
      )
    })

    it('should validate state from Redis', async () => {
      mockRedis.get.mockResolvedValue('pending')

      // Mock GitHub API 会失败，但我们只测试 state 验证
      await expect(authService.handleGitHubCallback('test-code', 'valid-state')).rejects.toThrow()

      expect(mockRedis.get).toHaveBeenCalledWith('oauth:github:valid-state')
    })
  })

  describe('handleGitLabCallback', () => {
    it('should throw error if state is invalid', async () => {
      mockRedis.get.mockResolvedValue(null)

      await expect(authService.handleGitLabCallback('test-code', 'invalid-state')).rejects.toThrow(
        'Invalid state',
      )
    })
  })

  describe('createSession', () => {
    it('should create session and store in Redis', async () => {
      mockRedis.setex.mockResolvedValue('OK')

      const userId = 'test-user-id'
      const sessionId = await authService.createSession(userId)

      expect(sessionId).toBeTruthy()
      expect(typeof sessionId).toBe('string')
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        7 * 24 * 60 * 60,
        expect.stringContaining(userId),
      )
    })
  })

  describe('validateSession', () => {
    it('should return null if session not found', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await authService.validateSession('invalid-session')

      expect(result).toBeNull()
    })

    it('should return user if session is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      }

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ userId: mockUser.id, createdAt: Date.now() }),
      )

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      })

      const result = await authService.validateSession('valid-session')

      expect(result).toEqual(mockUser)
      expect(mockRedis.get).toHaveBeenCalledWith('session:valid-session')
    })
  })

  describe('deleteSession', () => {
    it('should delete session from Redis', async () => {
      mockRedis.del.mockResolvedValue(1)

      await authService.deleteSession('test-session')

      expect(mockRedis.del).toHaveBeenCalledWith('session:test-session')
    })
  })
})
