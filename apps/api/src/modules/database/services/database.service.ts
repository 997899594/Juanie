import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../../drizzle/schemas'
import type {
  NewOAuthAccount,
  NewUser,
  NewUserCredential,
  OAuthAccount,
  User,
  UserCredential,
} from '../../../drizzle/schemas/users'

/**
 * 数据库服务
 * 统一管理数据库连接和操作
 * 提供用户、项目等数据的 CRUD 操作
 * 实现连接池和健康检查
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private db: ReturnType<typeof drizzle>
  private client: ReturnType<typeof postgres>

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      this.configService.get<string>('DATABASE_URL') || 'postgresql://localhost:5432/juanie'

    // 配置连接池
    this.client = postgres(connectionString, {
      max: 20, // 最大连接数
      idle_timeout: 20, // 空闲超时（秒）
      connect_timeout: 10, // 连接超时（秒）
      prepare: false, // 禁用预处理语句以提高性能
    })

    this.db = drizzle(this.client, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    })
  }

  /**
   * 模块销毁时清理资源
   */
  async onModuleDestroy() {
    await this.close()
  }

  /**
   * 获取数据库实例
   */
  getDb() {
    return this.db
  }

  /**
   * 检查数据库健康状态
   */
  async checkHealth(): Promise<{ status: string; responseTime?: number }> {
    const start = Date.now()

    try {
      await this.client`SELECT 1 as health_check`
      const responseTime = Date.now() - start

      return {
        status: 'healthy',
        responseTime,
      }
    } catch (error) {
      console.error('Database health check failed:', error)
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
      }
    }
  }

  // === 用户管理 ===

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1)

      return users[0] || null
    } catch (error) {
      console.error('Error getting user by email:', error)
      return null
    }
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const users = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1)

      return users[0] || null
    } catch (error) {
      console.error('Error getting user by id:', error)
      return null
    }
  }

  /**
   * 创建用户（现代化版本，不包含密码）
   */
  async createUser(userData: { email: string; name?: string; avatar?: string }): Promise<User> {
    try {
      const users = await this.db
        .insert(schema.users)
        .values({
          email: userData.email,
          name: userData.name || userData.email.split('@')[0],
          avatar: userData.avatar,
        })
        .returning()

      return users[0]
    } catch (error) {
      console.error('Error creating user:', error)
      throw new Error('Failed to create user')
    }
  }

  /**
   * 更新用户
   */
  async updateUser(
    id: string,
    userData: {
      email?: string
      name?: string
      avatar?: string
    },
  ): Promise<User | null> {
    try {
      const updateData: any = {}

      if (userData.email) updateData.email = userData.email
      if (userData.name) updateData.name = userData.name
      if (userData.avatar) updateData.avatar = userData.avatar

      const users = await this.db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id))
        .returning()

      return users[0] || null
    } catch (error) {
      console.error('Error updating user:', error)
      return null
    }
  }

  // === 用户凭据管理 ===

  /**
   * 获取用户凭据
   */
  async getUserCredential(userId: string): Promise<UserCredential | null> {
    try {
      const credentials = await this.db
        .select()
        .from(schema.userCredentials)
        .where(eq(schema.userCredentials.userId, userId))
        .limit(1)

      return credentials[0] || null
    } catch (error) {
      console.error('Error getting user credential:', error)
      return null
    }
  }

  /**
   * 创建用户凭据
   */
  async createUserCredential(credentialData: NewUserCredential): Promise<UserCredential> {
    try {
      const credentials = await this.db
        .insert(schema.userCredentials)
        .values(credentialData)
        .returning()

      return credentials[0]
    } catch (error) {
      console.error('Error creating user credential:', error)
      throw new Error('Failed to create user credential')
    }
  }

  /**
   * 更新用户凭据
   */
  async updateUserCredential(
    userId: string,
    credentialData: Partial<NewUserCredential>,
  ): Promise<UserCredential | null> {
    try {
      const credentials = await this.db
        .update(schema.userCredentials)
        .set(credentialData)
        .where(eq(schema.userCredentials.userId, userId))
        .returning()

      return credentials[0] || null
    } catch (error) {
      console.error('Error updating user credential:', error)
      return null
    }
  }

  // === OAuth 账户管理 ===

  /**
   * 根据提供商和用户ID获取OAuth账户
   */
  async getOAuthAccount(provider: string, providerUserId: string): Promise<OAuthAccount | null> {
    try {
      const accounts = await this.db
        .select()
        .from(schema.oauthAccounts)
        .where(
          and(
            eq(schema.oauthAccounts.provider, provider),
            eq(schema.oauthAccounts.providerUserId, providerUserId),
          ),
        )
        .limit(1)

      return accounts[0] || null
    } catch (error) {
      console.error('Error getting OAuth account:', error)
      return null
    }
  }

  /**
   * 创建或更新OAuth账户和用户
   */
  async upsertOAuthAccountAndUser(
    provider: string,
    providerUserId: string,
    profile: Record<string, unknown>,
  ): Promise<User> {
    try {
      return await this.db.transaction(async (tx) => {
        // 检查是否已存在OAuth账户
        const existingAccount = await tx
          .select()
          .from(schema.oauthAccounts)
          .where(
            and(
              eq(schema.oauthAccounts.provider, provider),
              eq(schema.oauthAccounts.providerUserId, providerUserId),
            ),
          )
          .limit(1)

        if (existingAccount[0]) {
          // 更新现有账户的profile信息
          await tx
            .update(schema.oauthAccounts)
            .set({ profile })
            .where(eq(schema.oauthAccounts.id, existingAccount[0].id))

          // 返回关联的用户
          const users = await tx
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, existingAccount[0].userId))
            .limit(1)

          return users[0]
        }

        // 创建新用户
        const email = (profile.email as string) || `${provider}_${providerUserId}@oauth.local`
        const name = (profile.name as string) || (profile.login as string) || `${provider}_user`
        const avatar = (profile.avatar_url as string) || undefined

        const newUsers = await tx
          .insert(schema.users)
          .values({
            email,
            name,
            avatar,
          })
          .returning()

        const newUser = newUsers[0]

        // 创建OAuth账户
        await tx.insert(schema.oauthAccounts).values({
          userId: newUser.id,
          provider,
          providerUserId,
          profile,
        })

        return newUser
      })
    } catch (error) {
      console.error('Error upserting OAuth account and user:', error)
      throw new Error('Failed to upsert OAuth account and user')
    }
  }

  /**
   * 事务执行
   */
  async transaction<T>(callback: (tx: typeof this.db) => Promise<T>): Promise<T> {
    return await this.db.transaction(callback)
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    try {
      await this.client.end()
    } catch (error) {
      console.error('Error closing database connection:', error)
    }
  }
}
