import { randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { RefreshToken, Session, User } from '../../database/schemas'
import type { DatabaseService } from '../../database/services/database.service'

export interface SessionPayload {
  userId: string
  sessionId: string
  expiresAt: Date
}

/**
 * 现代化Session认证服务
 * 替代JWT，提供更安全的认证机制
 * - 服务端Session存储
 * - 可撤销的认证令牌
 * - 设备管理
 * - 安全审计
 */
@Injectable()
export class SessionService {
  private readonly sessionTTL = 7 * 24 * 60 * 60 * 1000 // 7天
  private readonly refreshTokenTTL = 30 * 24 * 60 * 60 * 1000 // 30天

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * 生成安全的随机令牌
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString('base64url')
  }

  /**
   * 创建新的Session
   */
  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ session: Session; refreshToken: RefreshToken }> {
    const sessionToken = this.generateSecureToken()
    const refreshTokenValue = this.generateSecureToken()
    const now = new Date()
    const sessionExpiresAt = new Date(now.getTime() + this.sessionTTL)
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTokenTTL)

    // 创建Session
    const session = await this.databaseService.createSession({
      userId,
      token: sessionToken,
      expiresAt: sessionExpiresAt,
      userAgent,
      ipAddress,
      deviceInfo: this.parseDeviceInfo(userAgent),
    })

    // 创建刷新令牌
    const refreshToken = await this.databaseService.createRefreshToken({
      sessionId: session.id,
      token: refreshTokenValue,
      expiresAt: refreshExpiresAt,
    })

    return { session, refreshToken }
  }

  /**
   * 验证Session令牌
   */
  async validateSession(token: string): Promise<User | null> {
    const session = await this.databaseService.getSessionByToken(token)

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null
    }

    // 更新最后活跃时间
    await this.databaseService.updateSessionLastActive(session.id)

    return await this.databaseService.getUserById(session.userId)
  }

  /**
   * 刷新Session
   */
  async refreshSession(
    refreshToken: string,
  ): Promise<{ session: Session; refreshToken: RefreshToken } | null> {
    const token = await this.databaseService.getRefreshTokenByToken(refreshToken)

    if (!token || token.isRevoked || token.expiresAt < new Date()) {
      return null
    }

    const session = await this.databaseService.getSessionById(token.sessionId)
    if (!session) {
      return null
    }

    // 撤销旧的刷新令牌
    await this.databaseService.revokeRefreshToken(token.id)

    // 创建新的Session和刷新令牌
    return await this.createSession(session.userId, session.userAgent, session.ipAddress)
  }

  /**
   * 撤销Session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.databaseService.revokeSession(sessionId)
  }

  /**
   * 撤销用户的所有Session
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.databaseService.revokeAllUserSessions(userId)
  }

  /**
   * 获取用户的活跃Session列表
   */
  async getUserActiveSessions(userId: string): Promise<Session[]> {
    return await this.databaseService.getUserActiveSessions(userId)
  }

  /**
   * 清理过期的Session
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.databaseService.cleanupExpiredSessions()
  }

  /**
   * 解析设备信息
   */
  private parseDeviceInfo(userAgent?: string): string | undefined {
    if (!userAgent) return undefined

    // 简单的设备信息解析，实际项目中可以使用更专业的库
    if (userAgent.includes('Mobile')) return 'Mobile'
    if (userAgent.includes('Tablet')) return 'Tablet'
    return 'Desktop'
  }
}
