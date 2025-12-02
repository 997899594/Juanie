import { Injectable, Logger } from '@nestjs/common'
import type { GitProvider } from './git-credential.interface'

/**
 * 认证策略优先级
 */
export enum CredentialPriority {
  GITHUB_APP = 1, // 最高优先级
  GITLAB_GROUP_TOKEN = 1,
  OAUTH = 2,
  PAT = 3, // 最低优先级
}

/**
 * 认证策略推荐结果
 */
export interface StrategyRecommendation {
  authType: 'oauth' | 'pat' | 'github_app' | 'gitlab_group_token'
  priority: number
  reason: string
  requirements?: string[]
}

/**
 * 智能认证策略服务
 *
 * 根据不同场景自动推荐最佳的认证方式
 */
@Injectable()
export class CredentialStrategyService {
  private readonly logger = new Logger(CredentialStrategyService.name)

  /**
   * 为项目推荐最佳认证策略
   *
   * @param context 上下文信息
   * @returns 推荐的认证策略列表（按优先级排序）
   */
  async recommendStrategy(context: {
    provider: GitProvider
    isOrganization?: boolean
    hasGitHubApp?: boolean
    hasGroupToken?: boolean
    userHasOAuth?: boolean
    userHasPAT?: boolean
  }): Promise<StrategyRecommendation[]> {
    const recommendations: StrategyRecommendation[] = []

    if (context.provider === 'github') {
      recommendations.push(...this.getGitHubRecommendations(context))
    } else if (context.provider === 'gitlab') {
      recommendations.push(...this.getGitLabRecommendations(context))
    }

    // 按优先级排序
    return recommendations.sort((a, b) => a.priority - b.priority)
  }

  /**
   * GitHub 认证策略推荐
   */
  private getGitHubRecommendations(context: {
    isOrganization?: boolean
    hasGitHubApp?: boolean
    userHasOAuth?: boolean
    userHasPAT?: boolean
  }): StrategyRecommendation[] {
    const recommendations: StrategyRecommendation[] = []

    // 1. GitHub App（组织级别最佳）
    if (context.isOrganization && context.hasGitHubApp) {
      recommendations.push({
        authType: 'github_app',
        priority: CredentialPriority.GITHUB_APP,
        reason: '组织级别的 GitHub App 提供最佳的安全性和权限控制',
        requirements: [
          '需要在 GitHub 组织中安装 App',
          '需要 App ID 和私钥',
          '需要 Installation ID',
        ],
      })
    }

    // 2. OAuth（个人项目推荐）
    if (context.userHasOAuth) {
      recommendations.push({
        authType: 'oauth',
        priority: CredentialPriority.OAUTH,
        reason: 'OAuth 认证简单便捷，适合个人项目',
        requirements: ['用户需要授权 GitHub OAuth'],
      })
    }

    // 3. PAT（备选方案）
    if (context.userHasPAT) {
      recommendations.push({
        authType: 'pat',
        priority: CredentialPriority.PAT,
        reason: 'Personal Access Token 提供细粒度权限控制',
        requirements: ['需要创建 GitHub PAT', '需要 repo 和 workflow 权限'],
      })
    }

    return recommendations
  }

  /**
   * GitLab 认证策略推荐
   */
  private getGitLabRecommendations(context: {
    isOrganization?: boolean
    hasGroupToken?: boolean
    userHasOAuth?: boolean
    userHasPAT?: boolean
  }): StrategyRecommendation[] {
    const recommendations: StrategyRecommendation[] = []

    // 1. Group Token（组织级别最佳）
    if (context.isOrganization && context.hasGroupToken) {
      recommendations.push({
        authType: 'gitlab_group_token',
        priority: CredentialPriority.GITLAB_GROUP_TOKEN,
        reason: 'GitLab Group Token 提供组级别的访问控制',
        requirements: [
          '需要在 GitLab Group 中创建 Access Token',
          '需要 api 和 write_repository 权限',
        ],
      })
    }

    // 2. OAuth（个人项目推荐）
    if (context.userHasOAuth) {
      recommendations.push({
        authType: 'oauth',
        priority: CredentialPriority.OAUTH,
        reason: 'OAuth 认证简单便捷，支持自动刷新',
        requirements: ['用户需要授权 GitLab OAuth'],
      })
    }

    // 3. PAT（备选方案）
    if (context.userHasPAT) {
      recommendations.push({
        authType: 'pat',
        priority: CredentialPriority.PAT,
        reason: 'Personal Access Token 提供细粒度权限控制',
        requirements: ['需要创建 GitLab PAT', '需要 api 和 write_repository 权限'],
      })
    }

    return recommendations
  }

  /**
   * 验证认证策略是否可用
   */
  async validateStrategy(
    authType: string,
    provider: GitProvider,
  ): Promise<{ valid: boolean; reason?: string }> {
    // GitHub App 验证
    if (authType === 'github_app' && provider === 'github') {
      // 检查是否配置了 GitHub App
      const hasAppConfig = process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY
      if (!hasAppConfig) {
        return {
          valid: false,
          reason: '未配置 GitHub App（需要 GITHUB_APP_ID 和 GITHUB_APP_PRIVATE_KEY）',
        }
      }
    }

    // GitLab Group Token 验证
    if (authType === 'gitlab_group_token' && provider === 'gitlab') {
      // Group Token 需要用户提供，无需系统配置
      return { valid: true }
    }

    // OAuth 验证
    if (authType === 'oauth') {
      const hasOAuthConfig =
        provider === 'github'
          ? process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
          : process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET

      if (!hasOAuthConfig) {
        return {
          valid: false,
          reason: `未配置 ${provider} OAuth（需要 CLIENT_ID 和 CLIENT_SECRET）`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * 获取认证方式的详细说明
   */
  getAuthTypeDescription(authType: string, provider: GitProvider): string {
    const descriptions: Record<string, string> = {
      github_app: `
GitHub App 认证（推荐用于组织）
- 提供最细粒度的权限控制
- 不依赖个人账户
- 支持组织级别的审计
- 更高的 API 速率限制
      `.trim(),
      gitlab_group_token: `
GitLab Group Token 认证（推荐用于组织）
- 组级别的权限管理
- 不依赖个人账户
- 支持多个项目共享
- 更好的审计追踪
      `.trim(),
      oauth: `
OAuth 认证（推荐用于个人项目）
- 简单便捷，一键授权
- ${provider === 'gitlab' ? '支持自动刷新' : '需要定期重新授权'}
- 适合快速开始
      `.trim(),
      pat: `
Personal Access Token（备选方案）
- 细粒度的权限控制
- 手动管理 token
- 需要定期更新
      `.trim(),
    }

    return descriptions[authType] || '未知的认证方式'
  }

  /**
   * 根据错误自动切换认证策略
   */
  async handleAuthFailure(
    currentAuthType: string,
    error: Error,
    context: {
      provider: GitProvider
      isOrganization?: boolean
    },
  ): Promise<StrategyRecommendation | null> {
    this.logger.warn(`认证失败: ${currentAuthType}`, error.message)

    // 获取所有可用的策略
    const recommendations = await this.recommendStrategy({
      provider: context.provider,
      isOrganization: context.isOrganization,
      // 假设用户有其他认证方式
      userHasOAuth: true,
      userHasPAT: true,
    })

    // 排除当前失败的策略
    const alternatives = recommendations.filter((r) => r.authType !== currentAuthType)

    if (alternatives.length === 0) {
      return null
    }

    // 返回优先级最高的替代方案
    return alternatives[0] || null
  }
}
