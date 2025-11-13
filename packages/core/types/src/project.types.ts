/**
 * Project 相关类型定义
 * 用于项目初始化、状态管理、健康度监控等功能
 */

// ============================================
// 项目初始化相关类型
// ============================================

/**
 * 仓库配置 - 关联现有仓库
 */
export interface ExistingRepositoryConfig {
  mode: 'existing'
  provider: 'github' | 'gitlab'
  url: string
  accessToken: string
  defaultBranch?: string
}

/**
 * 仓库配置 - 创建新仓库
 */
export interface NewRepositoryConfig {
  mode: 'create'
  provider: 'github' | 'gitlab'
  name: string
  visibility: 'public' | 'private'
  accessToken: string
  includeAppCode?: boolean
}

/**
 * 仓库配置联合类型
 */
export type RepositoryConfig = ExistingRepositoryConfig | NewRepositoryConfig

/**
 * 项目配额配置
 */
export interface ProjectQuota {
  maxEnvironments: number
  maxRepositories: number
  maxPods: number
  maxCpu: string
  maxMemory: string
}

/**
 * 扩展的项目配置
 */
export interface ExtendedProjectConfig {
  defaultBranch: string
  enableCiCd: boolean
  enableAi: boolean
  quota?: ProjectQuota
}

/**
 * 创建项目输入（扩展版本，包含模板和仓库配置）
 * 注意：实际使用时请使用 schemas.ts 中的 CreateProjectWithTemplateInput
 * 这里保留接口定义仅用于类型参考
 */
export interface CreateProjectWithTemplateInputType {
  organizationId: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'

  // 模板相关
  templateId?: string
  templateConfig?: Record<string, any>

  // 仓库配置（可选）
  repository?: RepositoryConfig
}

/**
 * 初始化状态
 */
export interface InitializationStatus {
  step: string
  progress: number // 0-100
  error?: string
  completedSteps: string[]
}

/**
 * 初始化结果
 */
export interface InitializationResult {
  success: boolean
  projectId: string
  createdResources: {
    environments: string[]
    repositories: string[]
    gitopsResources: string[]
  }
  errors?: string[]
}

// ============================================
// 项目健康度相关类型
// ============================================

/**
 * 健康度状态
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical'

/**
 * GitOps 同步状态
 */
export type GitOpsSyncStatus = 'healthy' | 'degraded' | 'failed'

/**
 * Pod 健康状态
 */
export type PodHealthStatus = 'healthy' | 'degraded' | 'failed'

/**
 * 健康度因素
 */
export interface HealthFactors {
  deploymentSuccessRate: number // 最近 10 次部署的成功率 (0-100)
  gitopsSyncStatus: GitOpsSyncStatus
  podHealthStatus: PodHealthStatus
  lastDeploymentAge: number // 距离上次部署的天数
}

/**
 * 健康问题严重程度
 */
export type IssueSeverity = 'critical' | 'warning' | 'info'

/**
 * 健康问题分类
 */
export type IssueCategory = 'deployment' | 'gitops' | 'resource' | 'security'

/**
 * 健康问题
 */
export interface HealthIssue {
  severity: IssueSeverity
  category: IssueCategory
  message: string
  affectedResources: string[]
  suggestedAction: string
}

/**
 * 项目健康度
 */
export interface ProjectHealth {
  score: number // 0-100
  status: HealthStatus
  factors: HealthFactors
  issues: HealthIssue[]
  recommendations: string[]
  lastChecked?: Date
}

// ============================================
// 项目状态相关类型
// ============================================

/**
 * 项目状态枚举
 */
export type ProjectStatusEnum =
  | 'initializing'
  | 'active'
  | 'inactive'
  | 'archived'
  | 'failed'
  | 'partial' // 部分初始化成功

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  pods: number
  cpu: string
  memory: string
}

/**
 * 部署统计信息
 */
export interface DeploymentStats {
  totalDeployments: number
  successfulDeployments: number
  failedDeployments: number
  lastDeploymentAt?: Date
}

/**
 * 项目完整状态（包含所有关联资源）
 */
export interface ProjectStatus {
  project: {
    id: string
    organizationId: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    visibility: 'public' | 'private' | 'internal'
    status: ProjectStatusEnum
    config: ExtendedProjectConfig
    initializationStatus?: InitializationStatus
    templateId?: string | null
    templateConfig?: Record<string, any> | null
    healthScore?: number | null
    healthStatus?: HealthStatus | null
    lastHealthCheck?: Date | null
    createdAt: Date
    updatedAt: Date
  }

  // 关联资源
  environments: Array<{
    id: string
    name: string
    type: 'development' | 'staging' | 'production' | 'testing'
    config: any
  }>

  repositories: Array<{
    id: string
    provider: 'github' | 'gitlab'
    fullName: string
    cloneUrl: string
    defaultBranch: string | null
  }>

  gitopsResources: Array<{
    id: string
    type: 'kustomization' | 'helm'
    name: string
    namespace: string
    status: string | null
    errorMessage: string | null
  }>

  // 统计信息
  stats: DeploymentStats

  // 健康度
  health: ProjectHealth

  // 资源使用
  resourceUsage: ResourceUsage
}

// ============================================
// 项目操作相关类型
// ============================================

/**
 * 归档项目选项
 */
export interface ArchiveProjectOptions {
  reason?: string
  pauseGitOpsSync?: boolean
}

/**
 * 恢复项目选项
 */
export interface RestoreProjectOptions {
  resumeGitOpsSync?: boolean
}

/**
 * 项目配置历史
 */
export interface ProjectConfigHistory {
  id: string
  projectId: string
  config: ExtendedProjectConfig
  changedBy: string
  changedAt: Date
  changeReason?: string
}

/**
 * 配置差异
 */
export interface ConfigDiff {
  field: string
  oldValue: any
  newValue: any
}

/**
 * 配置比较结果
 */
export interface ConfigComparison {
  version1: ProjectConfigHistory
  version2: ProjectConfigHistory
  differences: ConfigDiff[]
}
