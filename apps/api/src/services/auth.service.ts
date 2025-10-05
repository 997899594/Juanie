import { Injectable } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import * as jwt from 'jsonwebtoken'
import type { User } from '../drizzle/schema'
import type { DatabaseService } from './database.service'

export interface JWTPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

/**
 * 认证服务
 * 统一管理用户认证、JWT令牌生成和验证
 * 提供用户会话管理功能
 */
@Injectable()
export class AuthService {
  private readonly jwtSecret: string

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default-secret'
  }

  /**
   * 验证JWT令牌
   * @param token JWT令牌
   * @returns 解码后的用户信息
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload
      return decoded
    } catch (error) {
      console.error('JWT verification failed:', error)
      return null
    }
  }

  /**
   * 生成JWT令牌
   * @param user 用户信息
   * @returns JWT令牌
   */
  generateToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '7d', // 7天过期
    })
  }

  /**
   * 根据令牌获取当前用户
   * @param token JWT令牌
   * @returns 用户信息或null
   */
  async getCurrentUser(token?: string): Promise<User | null> {
    if (!token) {
      return null
    }

    try {
      const payload = await this.verifyToken(token)
      if (!payload) {
        return null
      }

      const user = await this.databaseService.getUserById(payload.userId)
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  }

  /**
   * 用户登录或注册
   * @param email 用户邮箱
   * @param name 用户名称（可选）
   * @param avatar 用户头像（可选）
   * @returns 用户信息和JWT令牌
   */
  async loginOrRegister(email: string, name?: string, avatar?: string) {
    try {
      // 先尝试查找现有用户
      let user = await this.databaseService.getUserByEmail(email)

      // 如果用户不存在，创建新用户
      if (!user) {
        const newUser = await this.databaseService.createUser({
          email,
          name,
          avatar,
        })
        user = newUser || null
      }

      // 确保用户存在后再生成JWT令牌
      if (!user) {
        throw new Error('Failed to create or retrieve user')
      }

      const token = this.generateToken(user)

      return {
        user,
        token,
      }
    } catch (error) {
      console.error('Login/Register error:', error)
      throw new Error('Authentication failed')
    }
  }

  /**
   * 验证请求是否已认证
   * @param authHeader Authorization头部
   * @returns 用户信息或null
   */
  async validateRequest(authHeader?: string): Promise<User | null> {
    if (!authHeader) {
      return null
    }

    // 提取Bearer令牌
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

    return await this.getCurrentUser(token)
  }

  /**
   * 刷新用户令牌
   * @param oldToken 旧的JWT令牌
   * @returns 新的JWT令牌或null
   */
  async refreshToken(oldToken: string): Promise<string | null> {
    try {
      const user = await this.getCurrentUser(oldToken)
      if (!user) {
        return null
      }

      return this.generateToken(user)
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    }
  }

  /**
   * 用户登出（令牌黑名单功能可以在这里实现）
   * @param token JWT令牌
   */
  async logout(token: string): Promise<void> {
    // 这里可以实现令牌黑名单功能
    // 目前只是记录日志
    console.log('User logged out with token:', `${token.slice(0, 10)}...`)
  }
}
