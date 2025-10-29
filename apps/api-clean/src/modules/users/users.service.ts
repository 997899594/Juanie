import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { DATABASE } from '@/database/database.module'
import * as schema from '@/database/schemas'

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 获取当前用户信息
  async getMe(userId: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        preferences: schema.users.preferences,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    return user || null
  }

  // 更新当前用户信息
  async updateMe(
    userId: string,
    data: {
      username?: string
      displayName?: string
      avatarUrl?: string
    },
  ) {
    const [user] = await this.db
      .update(schema.users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        preferences: schema.users.preferences,
        updatedAt: schema.users.updatedAt,
      })

    return user
  }

  // 更新用户偏好设置
  async updatePreferences(
    userId: string,
    preferences: {
      language?: 'en' | 'zh'
      theme?: 'light' | 'dark' | 'system'
      notifications?: {
        email?: boolean
        inApp?: boolean
      }
    },
  ) {
    // 获取当前偏好
    const [currentUser] = await this.db
      .select({ preferences: schema.users.preferences })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    // 合并偏好设置
    const mergedPreferences: {
      language: 'en' | 'zh'
      theme: 'light' | 'dark' | 'system'
      notifications: {
        email: boolean
        inApp: boolean
      }
    } = {
      language: preferences.language || currentUser?.preferences?.language || 'en',
      theme: preferences.theme || currentUser?.preferences?.theme || 'light',
      notifications: {
        email:
          preferences.notifications?.email ??
          currentUser?.preferences?.notifications?.email ??
          true,
        inApp:
          preferences.notifications?.inApp ??
          currentUser?.preferences?.notifications?.inApp ??
          true,
      },
    }

    const [user] = await this.db
      .update(schema.users)
      .set({
        preferences: mergedPreferences,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        preferences: schema.users.preferences,
      })

    return user
  }

  // 获取用户详情（公开信息）
  async getUser(userId: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    return user || null
  }

  // 列出用户（用于管理员或组织成员列表）
  async listUsers(userIds: string[]) {
    if (userIds.length === 0) return []

    const users = await this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        email: schema.users.email,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(
        // @ts-expect-error - drizzle inArray type issue
        eq(schema.users.id, userIds),
      )

    return users
  }
}
