import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { DrizzleService } from '../drizzle/drizzle.service'
import { oauthAccounts, users } from '../drizzle/schema'

/**
 * 数据库服务
 * 统一管理所有数据库操作
 * 提供高级的数据库查询和事务管理
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly drizzleService: DrizzleService) {}

  async updateUser(
    id: any,
    input: { name?: string | undefined; email?: string | undefined; password?: string | undefined },
  ) {
    const result = await this.db.update(users).set(input).where(eq(users.id, id)).returning()
    return result[0] ?? null
  }

  async onModuleInit() {
    console.log('DatabaseService initialized')
  }

  async onModuleDestroy() {
    console.log('DatabaseService destroyed')
  }

  /**
   * 获取数据库实例
   * @returns Drizzle ORM 实例
   */
  get db() {
    if (!this.drizzleService.db) {
      throw new Error('Database not available - please check database connection')
    }
    return this.drizzleService.db
  }

  /**
   * 检查数据库是否可用
   */
  private isDatabaseAvailable(): boolean {
    return this.drizzleService.db !== null && this.drizzleService.db !== undefined
  }

  /**
   * 用户相关操作
   */
  async getUserById(id: string) {
    if (!this.isDatabaseAvailable()) {
      throw new Error('Database not available')
    }

    try {
      const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1)

      return result[0] || null
    } catch (error) {
      console.error('Error fetching user by ID:', error)
      throw new Error('Failed to fetch user')
    }
  }

  async getUserByEmail(email: string) {
    if (!this.isDatabaseAvailable()) {
      throw new Error('Database not available')
    }

    try {
      const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1)

      return result[0] || null
    } catch (error) {
      console.error('Error fetching user by email:', error)
      throw new Error('Failed to fetch user')
    }
  }

  async createUser(userData: { email: string; password?: string; name?: string; avatar?: string }) {
    if (!this.isDatabaseAvailable()) {
      throw new Error('Database not available')
    }

    try {
      const result = await this.db
        .insert(users)
        .values({
          email: userData.email,
          passwordHash: userData.password || 'placeholder-password',
          name: userData.name || 'Unknown User',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      const newUser = result[0]
      if (!newUser) throw new Error('Failed to create user')
      return newUser
    } catch (error) {
      console.error('Error creating user:', error)
      throw new Error('Failed to create user')
    }
  }

  /**
   * 检查数据库健康状态
   * @returns 数据库健康状态信息
   */
  async checkHealth() {
    try {
      if (!this.drizzleService.db) {
        return {
          status: 'unhealthy',
          connected: false,
          message: 'Database not initialized',
          timestamp: new Date().toISOString(),
        }
      }

      // 执行简单查询测试连接
      await this.drizzleService.db.execute(sql`SELECT 1`)

      return {
        status: 'healthy',
        connected: true,
        message: 'Database connection is working',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        message: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 数据库统计
   */
  async getDatabaseStats() {
    try {
      const userCount = await this.db.select({ count: users.id }).from(users)

      return {
        users: {
          total: userCount.length,
        },
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error fetching database stats:', error)
      return {
        users: {
          total: 0,
        },
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * 执行事务
   * @param callback 事务回调函数
   * @returns 事务结果
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return await this.db.transaction(callback)
  }

  async getOAuthAccountByProviderUserId(provider: string, providerUserId: string) {
    const rows = await this.db
      .select()
      .from(oauthAccounts)
      .where(
        and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)),
      )
      .limit(1)
    return rows[0] || null
  }

  async upsertOAuthAccountAndUser(
    provider: 'wechat' | 'github' | 'gitlab',
    providerUserId: string,
    profile: Record<string, unknown>,
  ) {
    const existing = await this.getOAuthAccountByProviderUserId(provider, providerUserId)
    if (existing) {
      const user = await this.getUserById(existing.userId)
      return user!
    }

    const email = `${provider}:${providerUserId}@oauth.local`
    const name = String((profile as any)?.name || (profile as any)?.login || providerUserId)
    const newUser = await this.createUser({ email, name })

    await this.db.insert(oauthAccounts).values({
      userId: newUser.id,
      provider,
      providerUserId,
      profile,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return newUser
  }
}
