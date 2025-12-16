import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE, REDIS } from '@juanie/core/tokens'
import { generateId } from '@juanie/core/utils'
import type { CreateUserFromOAuthInput, OAuthUrlResponse } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GitHub, GitLab } from 'arctic'
import { eq, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type Redis from 'ioredis'

@Injectable()
export class AuthService {
  private github: GitHub
  private gitlab: GitLab

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private redis: Redis,
    private readonly logger: Logger,
    config: ConfigService,
  ) {
    this.logger.setContext(AuthService.name)
    // 初始化 Arctic OAuth providers
    this.github = new GitHub(
      config.get('GITHUB_CLIENT_ID')!,
      config.get('GITHUB_CLIENT_SECRET')!,
      config.get('GITHUB_REDIRECT_URI') || `${config.get('APP_URL')}/auth/github/callback`,
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
    // 请求所有必要的权限
    const url = this.github.createAuthorizationURL(state, [
      'user:email', // 获取用户邮箱
      'repo', // 完整的仓库访问权限（读写公开和私有仓库）
      'workflow', // 管理 GitHub Actions workflows
      'admin:repo_hook', // 管理仓库 webhooks
      'delete_repo', // 删除仓库
    ])

    // 存储 state 到 Redis（10 分钟过期），标记为 github
    await this.redis.setex(`oauth:github:${state}`, 600, 'github')

    return { url: url.toString(), state }
  }

  // 统一的 OAuth 回调处理（自动判断 provider）
  async handleOAuthCallback(code: string, state: string) {
    // 先检查是 GitHub 还是 GitLab
    const githubState = await this.redis.get(`oauth:github:${state}`)
    const gitlabState = await this.redis.get(`oauth:gitlab:${state}`)

    if (githubState) {
      return await this.handleGitHubCallback(code, state)
    } else if (gitlabState) {
      return await this.handleGitLabCallback(code, state)
    } else {
      throw new Error('Invalid or expired state')
    }
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
      email: string | null
      name: string
      avatar_url: string
    }

    // 如果 email 为空，从 /user/emails 获取
    let email = githubUser.email
    if (!email) {
      this.logger.info('[GitHub OAuth] email 为空，尝试从 /user/emails 获取')
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      })

      if (!emailsResponse.ok) {
        this.logger.error(
          `[GitHub OAuth] 获取邮箱列表失败: ${emailsResponse.status} ${emailsResponse.statusText}`,
        )
        throw new Error('无法获取 GitHub 邮箱列表，请确保授权了 user:email 权限')
      }

      const emails = (await emailsResponse.json()) as Array<{
        email: string
        primary: boolean
        verified: boolean
      }>

      this.logger.info('[GitHub OAuth] 获取到邮箱列表', { count: emails.length })

      // 优先使用 primary + verified 的邮箱
      const primaryEmail = emails.find((e) => e.primary && e.verified)
      email =
        primaryEmail?.email || emails.find((e) => e.verified)?.email || emails[0]?.email || null

      if (!email) {
        throw new Error('无法获取 GitHub 邮箱，请确保至少有一个已验证的邮箱')
      }

      this.logger.info('[GitHub OAuth] 使用邮箱', { email })
    } else {
      this.logger.info('[GitHub OAuth] 从用户信息获取到邮箱', { email })
    }

    // 创建或更新用户
    const user = await this.findOrCreateUser({
      email,
      username: githubUser.login,
      displayName: githubUser.name || githubUser.login,
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
    // 请求所有必要的权限
    const url = this.gitlab.createAuthorizationURL(state, [
      'api', // 完整 API 访问（包含所有操作）
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

      let isNewUser = false
      if (!user) {
        isNewUser = true
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

      // 如果是新用户，自动创建个人组织
      if (isNewUser) {
        // slug 使用时间戳 + 随机数，用户不可见
        const orgSlug = `org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

        const [org] = await tx
          .insert(schema.organizations)
          .values({
            name: `${data.displayName || data.username}'s Organization`,
            slug: orgSlug,
            displayName: data.displayName || data.username,
            billing: { plan: 'free' },
          })
          .returning()

        if (!org) {
          throw new Error('组织创建失败')
        }

        // 将用户加入组织（owner 角色）
        await tx.insert(schema.organizationMembers).values({
          organizationId: org.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
        })

        this.logger.info(`[Auth] 为新用户 ${user.username} 创建了组织: ${org.name}`)
      }

      // 创建或更新 OAuth 账号（保存完整的 token 信息）
      // 注意：使用新的唯一约束 (user_id, provider, server_url)
      const serverUrl =
        data.provider === 'github'
          ? 'https://github.com'
          : process.env.GITLAB_BASE_URL || 'https://gitlab.com'

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
          serverUrl: serverUrl.replace(/\/+$/, ''), // 移除尾部斜杠
          serverType: 'cloud',
        })
        .onConflictDoUpdate({
          target: [
            schema.oauthAccounts.userId,
            schema.oauthAccounts.provider,
            schema.oauthAccounts.serverUrl,
          ],
          set: {
            providerAccountId: sql`excluded.provider_account_id`,
            accessToken: sql`excluded.access_token`,
            refreshToken: sql`excluded.refresh_token`,
            expiresAt: sql`excluded.expires_at`,
            status: sql`excluded.status`,
            updatedAt: sql`now()`,
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
        serverUrl: 'https://github.com',
        serverType: 'cloud',
      })
      .onConflictDoUpdate({
        target: [
          schema.oauthAccounts.userId,
          schema.oauthAccounts.provider,
          schema.oauthAccounts.serverUrl,
        ],
        set: {
          providerAccountId: sql`excluded.provider_account_id`,
          accessToken: sql`excluded.access_token`,
          status: sql`excluded.status`,
          updatedAt: sql`now()`,
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
        serverUrl: gitlabBase,
        serverType: 'cloud',
      })
      .onConflictDoUpdate({
        target: [
          schema.oauthAccounts.userId,
          schema.oauthAccounts.provider,
          schema.oauthAccounts.serverUrl,
        ],
        set: {
          providerAccountId: sql`excluded.provider_account_id`,
          accessToken: sql`excluded.access_token`,
          refreshToken: sql`excluded.refresh_token`,
          expiresAt: sql`excluded.expires_at`,
          status: sql`excluded.status`,
          updatedAt: sql`now()`,
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
      // 连接账户时也请求完整权限
      const url = this.github.createAuthorizationURL(state, [
        'user:email',
        'repo',
        'workflow',
        'admin:repo_hook',
        'delete_repo',
      ])
      // 存储 state 和 userId 的关联
      await this.redis.setex(`oauth:github:connect:${state}`, 600, userId)
      return { url: url.toString(), state }
    } else {
      const url = this.gitlab.createAuthorizationURL(state, [
        'api', // 完整 API 访问
        'read_user',
        'read_repository',
        'write_repository',
        'read_registry',
        'write_registry',
        'sudo',
      ])
      await this.redis.setex(`oauth:gitlab:connect:${state}`, 600, userId)
      return { url: url.toString(), state }
    }
  }
}
