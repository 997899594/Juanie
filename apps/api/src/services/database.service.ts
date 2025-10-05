import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import type { DrizzleService } from '../drizzle/drizzle.service'
import { users } from '../drizzle/schema'

/**
 * 数据库服务
 * 统一管理所有数据库操作
 * 提供高级的数据库查询和事务管理
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly drizzleService: DrizzleService) {}

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

  async createUser(userData: { email: string; name?: string; avatar?: string }) {
    if (!this.isDatabaseAvailable()) {
      throw new Error('Database not available')
    }

    try {
      const result = await this.db
        .insert(users)
        .values({
          email: userData.email,
          passwordHash: '', // 临时空密码，实际应用中需要处理密码哈希
          name: userData.name || 'Unknown User',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      return result[0]
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
}
