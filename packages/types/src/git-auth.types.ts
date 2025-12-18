/**
 * Git 认证相关类型定义
 * 支持多种认证方式的统一接口
 */

/**
 * Git 认证类型
 */
export type GitAuthType = 'oauth' | 'pat' | 'github_app' | 'gitlab_group' | 'deploy_key'

/**
 * Git 提供商
 */
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'unknown'

/**
 * 凭证元数据
 */
export interface CredentialMetadata {
  /** 凭证 ID */
  id: string
  /** 凭证类型 */
  type: GitAuthType
  /** 提供商 */
  provider: GitProvider
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 过期时间（如果有） */
  expiresAt?: Date
  /** 权限范围 */
  scopes: string[]
  /** 是否有效 */
  isValid: boolean
  /** 最后验证时间 */
  lastValidatedAt?: Date
}

/**
 * 统一的 Git 凭证接口
 * 所有认证方式都实现这个接口
 */
export interface GitCredential {
  /** 凭证 ID */
  id: string
  /** 凭证类型 */
  type: GitAuthType
  /** 提供商 */
  provider: GitProvider

  /**
   * 获取访问凭证
   * @returns 访问 token
   */
  getAccessToken(): Promise<string>

  /**
   * 验证凭证是否有效
   * @returns 是否有效
   */
  validate(): Promise<boolean>

  /**
   * 刷新凭证（如果支持）
   */
  refresh?(): Promise<void>

  /**
   * 获取权限范围
   * @returns 权限列表
   */
  getScopes(): string[]

  /**
   * 检查是否有特定权限
   * @param permission 权限名称
   * @returns 是否有该权限
   */
  hasPermission(permission: string): boolean

  /**
   * 获取凭证元数据
   * @returns 元数据
   */
  getMetadata(): CredentialMetadata
}

/**
 * OAuth 凭证配置
 */
export interface OAuthCredentialConfig {
  /** OAuth 账户 ID */
  oauthAccountId: string
  /** 用户 ID */
  userId: string
  /** 提供商 */
  provider: GitProvider
  /** 访问 token */
  accessToken: string
  /** 刷新 token */
  refreshToken?: string
  /** 过期时间 */
  expiresAt?: Date
  /** 权限范围 */
  scopes: string[]
}

/**
 * Personal Access Token 凭证配置
 */
export interface PATCredentialConfig {
  /** Token 值 */
  token: string
  /** 提供商 */
  provider: GitProvider
  /** 权限范围 */
  scopes: string[]
  /** 过期时间（如果有） */
  expiresAt?: Date
}

/**
 * GitHub App 凭证配置
 */
export interface GitHubAppCredentialConfig {
  /** App ID */
  appId: string
  /** Installation ID */
  installationId: string
  /** 私钥 */
  privateKey: string
  /** 权限 */
  permissions: Record<string, string>
}

/**
 * GitLab Group Token 凭证配置
 */
export interface GitLabGroupCredentialConfig {
  /** Group ID */
  groupId: string
  /** Token */
  token: string
  /** 权限范围 */
  scopes: string[]
  /** 过期时间 */
  expiresAt?: Date
}

/**
 * Deploy Key 凭证配置
 */
export interface DeployKeyCredentialConfig {
  /** 公钥 */
  publicKey: string
  /** 私钥 */
  privateKey: string
  /** 提供商 */
  provider: GitProvider
  /** 是否只读 */
  readOnly: boolean
}

/**
 * 凭证配置联合类型
 */
export type CredentialConfig =
  | OAuthCredentialConfig
  | PATCredentialConfig
  | GitHubAppCredentialConfig
  | GitLabGroupCredentialConfig
  | DeployKeyCredentialConfig

/**
 * Git 认证健康状态
 */
export interface GitAuthHealthStatus {
  /** 状态 */
  status: 'healthy' | 'unhealthy' | 'degraded'
  /** 消息 */
  message?: string
  /** 最后检查时间 */
  lastCheckedAt: Date
  /** 详细信息 */
  details?: Record<string, any>
}

/**
 * 认证策略上下文
 */
export interface AuthStrategyContext {
  /** 项目 ID */
  projectId: string
  /** 仓库 ID */
  repositoryId: string
  /** 用户 ID */
  userId: string
  /** 组织 ID */
  organizationId?: string
  /** 团队 ID */
  teamId?: string
}

/**
 * 认证方法选择结果
 */
export interface AuthMethodSelection {
  /** 认证类型 */
  type: GitAuthType
  /** 提供商 */
  provider: GitProvider
  /** 配置 */
  config: CredentialConfig
  /** 选择原因 */
  reason: string
}

/**
 * 凭证创建选项
 */
export interface CreateCredentialOptions {
  /** 项目 ID */
  projectId: string
  /** 用户 ID */
  userId: string
  /** 首选认证类型 */
  preferredType?: GitAuthType
  /** Git 提供商 */
  provider?: 'github' | 'gitlab'
  /** 自定义 token */
  customToken?: string
  /** 强制创建（即使已存在） */
  force?: boolean
}

/**
 * 凭证更新选项
 */
export interface UpdateCredentialOptions {
  /** 新的 token */
  token?: string
  /** 新的过期时间 */
  expiresAt?: Date
  /** 新的权限范围 */
  scopes?: string[]
}

/**
 * K8s Secret 配置
 */
export interface K8sSecretConfig {
  /** 命名空间 */
  namespace: string
  /** Secret 名称 */
  name: string
  /** 用户名 */
  username: string
  /** 密码/Token */
  password: string
  /** Secret 类型 */
  type: 'kubernetes.io/basic-auth' | 'Opaque'
}
