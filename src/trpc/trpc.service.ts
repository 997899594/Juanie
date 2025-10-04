import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../services/database.service.js'
import { AuthService } from '../services/auth.service.js'

/**
 * tRPC 服务
 * 提供 tRPC 相关的业务逻辑
 * 正确使用 NestJS 依赖注入，不直接创建数据库连接
 */
@Injectable()
export class TrpcService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 验证请求认证
   * @param authHeader Authorization 头部
   * @returns 用户信息或 null
   */
  async validateRequest(authHeader?: string) {
    return await this.authService.validateRequest(authHeader)
  }

  /**
   * 获取当前用户
   * @param token JWT 令牌
   * @returns 用户信息或 null
   */
  async getCurrentUser(token?: string) {
    return await this.authService.getCurrentUser(token)
  }

  /**
   * 获取数据库实例
   * @returns Drizzle ORM 实例
   */
  get db() {
    return this.databaseService.db
  }

  /**
   * 检查数据库健康状态
   * @returns 数据库健康状态
   */
  async checkDatabaseHealth() {
    return await this.databaseService.checkHealth()
  }

  /**
   * 获取数据库统计信息
   * @returns 数据库统计
   */
  async getDatabaseStats() {
    return await this.databaseService.getDatabaseStats()
  }

  /**
   * 用户登录或注册
   * @param email 用户邮箱
   * @param name 用户名称
   * @param avatar 用户头像
   * @returns 用户信息和令牌
   */
  async loginOrRegister(email: string, name?: string, avatar?: string) {
    return await this.authService.loginOrRegister(email, name, avatar)
  }

  /**
   * 刷新用户令牌
   * @param token 旧令牌
   * @returns 新令牌或 null
   */
  async refreshToken(token: string) {
    return await this.authService.refreshToken(token)
  }

  /**
   * 用户登出
   * @param token JWT 令牌
   */
  async logout(token: string) {
    return await this.authService.logout(token)
  }
}
