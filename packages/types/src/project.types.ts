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
  defaultBranch?: string
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
 * 创建项目输入
 * 统一的项目创建接口，支持简单创建、模板创建和仓库创建
 */
export interface CreateProjectInput {
  organizationId: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'
  logoUrl?: string

  // 模板相关（可选）
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
  currentAction?: string // 用户友好的当前操作描述
  timestamp?: Date
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
  jobIds?: string[] // 异步任务 ID 列表（用于 SSE 监听）
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

  // 主仓库（第一个仓库的快捷访问）
  repository?: {
    id: string
    provider: 'github' | 'gitlab'
    fullName: string
    cloneUrl: string
    defaultBranch: string | null
    status?: string
  } | null

  gitopsResources: Array<{
    id: string
    type: 'kustomization' | 'helm'
    name: string
    namespace: string
    status: string | null
    errorMessage: string | null
  }>

  // 初始化步骤（如果项目正在初始化或刚完成）
  initializationSteps?: Array<{
    id: string
    step: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    progress: string | null
    error: string | null
    errorStack: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
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
