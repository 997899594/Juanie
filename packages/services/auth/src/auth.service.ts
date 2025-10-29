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

    this.gitlab = new GitLab(
      'https://gitlab.com',
      config.get('GITLAB_CLIENT_ID')!,
      config.get('GITLAB_CLIENT_SECRET')!,
      `${config.get('APP_URL')}/auth/gitlab/callback`,
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
    const url = this.gitlab.createAuthorizationURL(state, ['read_user'])

    await this.redis.setex(`oauth:gitlab:${state}`, 600, 'pending')

    return { url: url.toString(), state }
  }

  async handleGitLabCallback(code: string, state: string) {
    const storedState = await this.redis.get(`oauth:gitlab:${state}`)
    if (!storedState) {
      throw new Error('Invalid state')
    }

    const tokens = await this.gitlab.validateAuthorizationCode(code)

    const response = await fetch('https://gitlab.com/api/v4/user', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    })
    const gitlabUser = (await response.json()) as {
      id: number
      username: string
      email: string
      name: string
      avatar_url: string
    }

    const user = await this.findOrCreateUser({
      email: gitlabUser.email,
      username: gitlabUser.username,
      displayName: gitlabUser.name,
      avatarUrl: gitlabUser.avatar_url,
      provider: 'gitlab',
      providerAccountId: gitlabUser.id.toString(),
      accessToken: tokens.accessToken(),
    })

    await this.redis.del(`oauth:gitlab:${state}`)

    return user
  }

  // 创建或更新用户
  private async findOrCreateUser(data: CreateUserFromOAuthInput) {
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

      // 创建或更新 OAuth 账号
      await tx
        .insert(schema.oauthAccounts)
        .values({
          userId: user.id,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.accessToken,
        })
        .onConflictDoUpdate({
          target: [schema.oauthAccounts.provider, schema.oauthAccounts.providerAccountId],
          set: { accessToken: data.accessToken },
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
}
