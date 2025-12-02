/**
 * Git 凭证统一接口
 * 所有认证方式都实现这个接口
 */

// 导出共享类型
export type {
  CredentialMetadata,
  GitAuthType,
  GitCredential,
  GitProvider,
  HealthStatus,
} from '@juanie/types'

// 导入 GitCredential 类型用于本地使用
import type { GitCredential } from '@juanie/types'

/**
 * Git 凭证工厂接口
 */
export interface GitCredentialFactory {
  /**
   * 从数据库记录创建凭证实例
   */
  create(authRecord: any): Promise<GitCredential>

  /**
   * 支持的认证类型
   */
  supports(type: string): boolean
}

/**
 * 扩展方法：Git 认证特定功能
 */
export interface GitCredentialExtended extends GitCredential {
  /**
   * 获取 HTTPS 认证的用户名
   * GitHub: 'x-access-token' 或 'oauth2'
   * GitLab: 'oauth2' 或 'gitlab-ci-token'
   */
  getUsername(): string
}
