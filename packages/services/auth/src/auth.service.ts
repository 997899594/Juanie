import * as schema from '@juanie/core-database/schemas'
import { DATABASE, REDIS } from '@juanie/core-tokens'
import type { CreateUserFromOAuthInput, OAuthUrlResponse } from '@juanie/core-types'
import { generateId } from '@juanie/core-utils/id'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GitHub, GitLab } from 'arctic'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type Redis from 'ioredis'

@Injectable()
export class AuthService {
  private github: GitHub
  private gitlab: GitLab

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private redis: Redis,
    config: ConfigService,
  ) {
    // 初始化 Arctic OAuth providers
    this.github = new GitHub(
      config.get('GITHUB_CLIENT_ID')!,
      config.get('GITHUB_CLIENT_SECRET')!,
      `${config.get('APP_URL')}/auth/github/callback`,
    )

    const gitlabBase = (config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com').replace(
      /\/+$/,
      '',
    )
    const gitlabCallback = config.get<string>('GITLAB_REDIRECT_URI') || ''

    this.gitlab = new GitLab(
      gitlabBase,
      config.get('GITLAB_CLIENT_ID')!,
      config.get('GITLAB_CLIENT_SECRET')!,
      gitlabCallback,
    )
  }

  // GitHub OAuth 流程
  async getGitHubAuthUrl(): Promise<OAuthUrlResponse> {
    const state = generateId()
    const url = this.github.createAuthorizationURL(state, ['user:email'])

    // 存储 state 到 Redis（10 分钟过期）
    await this.redis.setex(`oauth:github:${state}`, 600, 'pending')

    return { url: url.toString(), state }
  }

  async handleGitHubCallback(code: string, state: string) {
    // 验证 state
    const storedState = await this.redis.get(`oauth:github:${state}`)
    if (!storedState) {
      throw new Error('Invalid state')
    }

    // 交换 access token
    const tokens = await this.github.validateAuthorizationCode(code)

    // 获取用户信息
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    })
    const githubUser = (await response.json()) as {
      id: number
      login: string
      email: string
      name: string
      avatar_url: string
    }

    // 创建或更新用户
    const user = await this.findOrCreateUser({
      email: githubUser.email,
      username: githubUser.login,
      displayName: githubUser.name,
      avatarUrl: githubUser.avatar_url,
      provider: 'github',
      providerAccountId: githubUser.id.toString(),
      accessToken: tokens.accessToken(),
    })

    // 清理 state
    await this.redis.del(`oauth:github:${state}`)

    return user
  }

  // GitLab OAuth 流程
  async getGitLabAuthUrl(): Promise<OAuthUrlResponse> {
    const state = generateId()
    // 请求完整的 scopes 以支持仓库创建和管理
    const url = this.gitlab.createAuthorizationURL(state, [
      'api', // 完整 API 访问
      'read_user', // 读取用户信息
      'read_repository', // 读取仓库
      'write_repository', // 写入仓库（创建、推送等）
    ])

    await this.redis.setex(`oauth:gitlab:${state}`, 600, 'pending')

    return { url: url.toString(), state }
  }

  async handleGitLabCallback(code: string, state: string) {
    const storedState = await this.redis.get(`oauth:gitlab:${state}`)
    if (!storedState) {
      throw new Error('Invalid state')
    }

    const tokens = await this.gitlab.validateAuthorizationCode(code)

    // 根据配置的 GitLab 基址请求用户信息
    const gitlabBase = (process.env.GITLAB_BASE_URL || 'https://gitlab.com').replace(/\/+$/, '')
    const response = await fetch(`${gitlabBase}/api/v4/user`, {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    })
    const gitlabUser = (await response.json()) as {
      id: number
      username: string
      email: string
      name: string
      avatar_url: string
    }

    // 保存完整的 token 信息（包括 refresh token 和过期时间）
    const user = await this.findOrCreateUser({
      email: gitlabUser.email,
      username: gitlabUser.username,
      displayName: gitlabUser.name,
      avatarUrl: gitlabUser.avatar_url,
      provider: 'gitlab',
      providerAccountId: gitlabUser.id.toString(),
      accessToken: tokens.accessToken(),
      refreshToken: tokens.refreshToken(),
      expiresAt: tokens.accessTokenExpiresAt(),
    })

    await this.redis.del(`oauth:gitlab:${state}`)

    return user
  }

  // 创建或更新用户
  private async findOrCreateUser(
    data: CreateUserFromOAuthInput & {
      refreshToken?: string
      expiresAt?: Date
    },
  ) {
    return await this.db.transaction(async (tx) => {
      // 查找或创建用户
      let [user] = await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, data.email))
        .limit(1)

      if (!user) {
        ;[user] = await tx
          .insert(schema.users)
          .values({
            email: data.email,
            username: data.username,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
            lastLoginAt: new Date(),
          })
          .returning()
      } else {
        // 更新最后登录时间
        ;[user] = await tx
          .update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, user.id))
          .returning()
      }

      // 确保用户存在
      if (!user) {
        throw new Error('用户创建失败')
      }

      // 创建或更新 OAuth 账号（保存完整的 token 信息）
      await tx
        .insert(schema.oauthAccounts)
        .values({
          userId: user.id,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          status: 'active',
        })
        .onConflictDoUpdate({
          target: [schema.oauthAccounts.provider, schema.oauthAccounts.providerAccountId],
          set: {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            status: 'active',
            updatedAt: new Date(),
          },
        })

      return user
    })
  }

  // 创建会话
  async createSession(userId: string) {
    const sessionId = generateId()
    const sessionData = { userId, createdAt: Date.now() }

    // 存储到 Redis（7 天过期）
    await this.redis.setex(`session:${sessionId}`, 7 * 24 * 60 * 60, JSON.stringify(sessionData))

    return sessionId
  }

  // 验证会话
  async validateSession(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`)
    if (!data) return null

    const session = JSON.parse(data)

    // 获取用户信息
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1)

    return user || null
  }

  // 删除会话
  async deleteSession(sessionId: string) {
    await this.redis.del(`session:${sessionId}`)
  }

  // 连接 GitHub 账户（用于已登录用户）
  async connectGitHubAccount(userId: string, code: string, state: string) {
    // 验证 state
    const storedState = await this.redis.get(`oauth:github:connect:${state}`)
    if (!storedState || storedState !== userId) {
      throw new Error('Invalid state or user mismatch')
    }

    // 交换 access token
    const tokens = await this.github.validateAuthorizationCode(code)

    // 获取 GitHub 用户信息
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    })
    const githubUser = (await response.json()) as {
      id: number
      login: string
    }

    // 保存或更新 OAuth 账户
    await this.db
      .insert(schema.oauthAccounts)
      .values({
        userId,
        provider: 'github',
        providerAccountId: githubUser.id.toString(),
        accessToken: tokens.accessToken(),
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [schema.oauthAccounts.provider, schema.oauthAccounts.providerAccountId],
        set: {
          accessToken: tokens.accessToken(),
          status: 'active',
          updatedAt: new Date(),
        },
      })

    // 清理 state
    await this.redis.del(`oauth:github:connect:${state}`)

    return { success: true }
  }

  // 连接 GitLab 账户（用于已登录用户）
  async connectGitLabAccount(userId: string, code: string, state: string) {
    // 验证 state
    const storedState = await this.redis.get(`oauth:gitlab:connect:${state}`)
    if (!storedState || storedState !== userId) {
      throw new Error('Invalid state or user mismatch')
    }

    // 交换 access token
    const tokens = await this.gitlab.validateAuthorizationCode(code)

    // 获取 GitLab 用户信息
    const gitlabBase = (process.env.GITLAB_BASE_URL || 'https://gitlab.com').replace(/\/+$/, '')
    const response = await fetch(`${gitlabBase}/api/v4/user`, {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    })
    const gitlabUser = (await response.json()) as {
      id: number
      username: string
    }

    // 保存或更新 OAuth 账户（包含 refresh token）
    await this.db
      .insert(schema.oauthAccounts)
      .values({
        userId,
        provider: 'gitlab',
        providerAccountId: gitlabUser.id.toString(),
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken(),
        expiresAt: tokens.accessTokenExpiresAt(),
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [schema.oauthAccounts.provider, schema.oauthAccounts.providerAccountId],
        set: {
          accessToken: tokens.accessToken(),
          refreshToken: tokens.refreshToken(),
          expiresAt: tokens.accessTokenExpiresAt(),
          status: 'active',
          updatedAt: new Date(),
        },
      })

    // 清理 state
    await this.redis.del(`oauth:gitlab:connect:${state}`)

    return { success: true }
  }

  // 获取连接账户的授权 URL
  async getConnectAuthUrl(
    provider: 'github' | 'gitlab',
    userId: string,
  ): Promise<OAuthUrlResponse> {
    const state = generateId()

    if (provider === 'github') {
      const url = this.github.createAuthorizationURL(state, ['repo', 'user'])
      // 存储 state 和 userId 的关联
      await this.redis.setex(`oauth:github:connect:${state}`, 600, userId)
      return { url: url.toString(), state }
    } else {
      const url = this.gitlab.createAuthorizationURL(state, [
        'api',
        'read_user',
        'read_repository',
        'write_repository',
      ])
      await this.redis.setex(`oauth:gitlab:connect:${state}`, 600, userId)
      return { url: url.toString(), state }
    }
  }
}
