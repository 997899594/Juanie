/**
 * GitOps 相关类型定义
 * 用于 GitOps 资源管理、Flux 集成和双向部署
 * 
 * 注意: GitOpsResource 类型直接从 @juanie/core/database schema 导出
 * 这里只定义业务逻辑相关的非 DB 模型类型
 */

// ============================================
// Flux 健康状态
// ============================================

export interface FluxHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: FluxComponent[]
  lastChecked: Date
}

export interface FluxComponent {
  name: string
  namespace: string
  ready: boolean
  status: string
  message?: string
}

// ============================================
// 部署配置
// ============================================

export interface GitOpsDeployConfig {
  projectId: string
  environmentId: string
  config: DeploymentConfig
  commitMessage?: string
}

export interface DeploymentConfig {
  image?: string
  replicas?: number
  resources?: ResourceRequirements
  env?: Record<string, string>
}

export interface ResourceRequirements {
  cpu?: string
  memory?: string
}

// ============================================
// 配置变更
// ============================================

export interface ConfigChange {
  path: string
  oldValue: unknown
  newValue: unknown
  action: 'add' | 'update' | 'delete'
}

export interface ConfigChangePreview {
  changes: ConfigChange[]
  diff: string
  valid: boolean
  warnings?: string[]
}

// ============================================
// Git 提交
// ============================================

export interface GitCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
  }
  timestamp: Date
  url: string
}

export interface CommitResult {
  success: boolean
  commitSha: string
  message: string
  branch: string
}

// ============================================
// 同步操作
// ============================================

export type FluxResourceKind = 'GitRepository' | 'Kustomization' | 'HelmRelease'

export interface SyncTrigger {
  kind: FluxResourceKind
  name: string
  namespace: string
}

export interface SyncResult {
  success: boolean
  message: string
  timestamp: Date
}

// ============================================
// YAML 验证
// ============================================

export interface YAMLValidationResult {
  valid: boolean
  errors?: YAMLValidationError[]
  warnings?: string[]
}

export interface YAMLValidationError {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}
