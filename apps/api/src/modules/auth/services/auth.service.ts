import { Injectable } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { constantTimeEqual, generateId } from '@oslo/crypto'
import { decodeBase64, encodeBase64 } from '@oslo/encoding'
import { Argon2id } from '@oslo/password'
import { GitHub, GitLab } from 'arctic'
import { useStorage } from 'nitropack/runtime'
import type { User } from '../../../drizzle/schemas/users'
import type { DatabaseService } from '../../database/services/database.service'

export interface SessionData {
  userId: string
  createdAt: number
  expiresAt: number
  userAgent?: string
  ipAddress?: string
}

@Injectable()
export class AuthService {
  private readonly github: GitHub
  private readonly gitlab: GitLab
  private readonly argon2id = new Argon2id()

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.github = new GitHub(
      this.configService.get('GITHUB_CLIENT_ID')!,
      this.configService.get('GITHUB_CLIENT_SECRET')!,
      this.configService.get('GITHUB_REDIRECT_URI')!,
    )

    this.gitlab = new GitLab(
      this.configService.get('GITLAB_CLIENT_ID')!,
      this.configService.get('GITLAB_CLIENT_SECRET')!,
      this.configService.get('GITLAB_REDIRECT_URI')!,
    )
  }

  // === OAuth 2.0 流程 ===
  async createGitHubAuthorizationURL(): Promise<{ url: URL; state: string; codeVerifier: string }> {
    const state = generateId(40)
    const codeVerifier = generateId(128)
    const url = await this.github.createAuthorizationURL(state, {
      scopes: ['user:email'],
    })
    return { url, state, codeVerifier }
  }

  async createGitLabAuthorizationURL(): Promise<{ url: URL; state: string; codeVerifier: string }> {
    const state = generateId(40)
    const codeVerifier = generateId(128)
    const url = await this.gitlab.createAuthorizationURL(state, {
      scopes: ['read_user'],
    })
    return { url, state, codeVerifier }
  }

  async validateGitHubCallback(code: string, codeVerifier: string): Promise<any> {
    const tokens = await this.github.validateAuthorizationCode(code, codeVerifier)

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })

    return await response.json()
  }

  async validateGitLabCallback(code: string, codeVerifier: string): Promise<any> {
    const tokens = await this.gitlab.validateAuthorizationCode(code, codeVerifier)

    const response = await fetch('https://gitlab.com/api/v4/user', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })

    return await response.json()
  }

  // === 会话管理 ===
  async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const sessionId = generateId(40)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 天

    const sessionData: SessionData = {
      userId,
      createdAt: Date.now(),
      expiresAt,
      userAgent,
      ipAddress,
    }

    // 存储到 Redis
    const storage = useStorage('redis')
    await storage.setItem(`session:${sessionId}`, sessionData, {
      ttl: 7 * 24 * 60 * 60, // 7 天（秒）
    })

    return sessionId
  }

  async validateSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) return null

    const storage = useStorage('redis')
    const sessionData = await storage.getItem<SessionData>(`session:${sessionId}`)

    if (!sessionData) return null
    if (sessionData.expiresAt < Date.now()) {
      await this.destroySession(sessionId)
      return null
    }

    return sessionData
  }

  async destroySession(sessionId: string): Promise<void> {
    const storage = useStorage('redis')
    await storage.removeItem(`session:${sessionId}`)
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    const storage = useStorage('redis')
    const keys = await storage.getKeys('session:*')

    for (const key of keys) {
      const sessionData = await storage.getItem<SessionData>(key)
      if (sessionData?.userId === userId) {
        await storage.removeItem(key)
      }
    }
  }

  // === 密码认证 ===
  async hashPassword(password: string): Promise<string> {
    return await this.argon2id.hash(password)
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return await this.argon2id.verify(hash, password)
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.databaseService.getUserByEmail(email)
    if (!user) return null

    const credential = await this.databaseService.getUserCredential(user.id)
    if (!credential?.passwordHash) return null

    const isValid = await this.verifyPassword(credential.passwordHash, password)
    return isValid ? user : null
  }

  // === OAuth 账户管理 ===
  async upsertOAuthAccount(
    provider: 'github' | 'gitlab',
    providerUserId: string,
    profile: Record<string, unknown>,
  ): Promise<User> {
    return await this.databaseService.upsertOAuthAccountAndUser(provider, providerUserId, profile)
  }

  // === 安全工具 ===
  generateSecureToken(): string {
    return generateId(64)
  }

  constantTimeCompare(a: string, b: string): boolean {
    const bufferA = new TextEncoder().encode(a)
    const bufferB = new TextEncoder().encode(b)
    return constantTimeEqual(bufferA, bufferB)
  }

  // === 向后兼容方法（用于 TRPC 路由） ===
  async validateUser(email: string, password: string): Promise<User | null> {
    return await this.validateCredentials(email, password)
  }

  async getCurrentUser(sessionId: string): Promise<User | null> {
    const sessionData = await this.validateSession(sessionId)
    if (!sessionData) return null

    return await this.databaseService.getUserById(sessionData.userId)
  }

  async validateRequest(authHeader?: string): Promise<User | null> {
    // 这个方法现在主要用于向后兼容，实际会话验证在中间件中处理
    return null
  }
}
