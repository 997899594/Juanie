/**
 * Template 相关类型定义
 * 用于项目模板管理、渲染和验证
 */

// ============================================
// 模板基础类型
// ============================================

/**
 * 模板分类
 */
export type TemplateCategory =
  | 'web'
  | 'api'
  | 'microservice'
  | 'static'
  | 'fullstack'
  | 'mobile'
  | 'data'

/**
 * 技术栈信息
 */
export interface TechStack {
  language: string
  framework: string
  runtime: string
}

/**
 * 资源配置模板
 */
export interface ResourceTemplate {
  requests: {
    cpu: string
    memory: string
  }
  limits: {
    cpu: string
    memory: string
  }
}

/**
 * 健康检查模板
 */
export interface HealthCheckTemplate {
  enabled: boolean
  httpGet?: {
    path: string
    port: number
    scheme?: 'HTTP' | 'HTTPS'
  }
  tcpSocket?: {
    port: number
  }
  exec?: {
    command: string[]
  }
  initialDelaySeconds?: number
  periodSeconds?: number
  timeoutSeconds?: number
  successThreshold?: number
  failureThreshold?: number
}

/**
 * 就绪探针模板
 */
export interface ReadinessProbeTemplate {
  enabled: boolean
  httpGet?: {
    path: string
    port: number
    scheme?: 'HTTP' | 'HTTPS'
  }
  tcpSocket?: {
    port: number
  }
  exec?: {
    command: string[]
  }
  initialDelaySeconds?: number
  periodSeconds?: number
  timeoutSeconds?: number
  successThreshold?: number
  failureThreshold?: number
}

/**
 * GitOps 配置模板
 */
export interface GitOpsTemplate {
  enabled: boolean
  autoSync: boolean
  syncInterval: string
  prune: boolean
  selfHeal: boolean
}

/**
 * 环境模板
 */
export interface EnvironmentTemplate {
  name: string
  type: 'development' | 'staging' | 'production' | 'testing'
  replicas: number
  resources: ResourceTemplate
  envVars: Record<string, string>
  gitops: GitOpsTemplate & {
    gitBranch: string
    gitPath: string
  }
}

/**
 * 默认配置模板
 */
export interface DefaultConfigTemplate {
  environments: EnvironmentTemplate[]
  resources: ResourceTemplate
  healthCheck: HealthCheckTemplate
  readinessProbe?: ReadinessProbeTemplate
  gitops: GitOpsTemplate
}

// ============================================
// K8s 配置模板
// ============================================

/**
 * K8s 配置模板（使用 Handlebars 语法）
 */
export interface K8sTemplates {
  deployment: string
  service: string
  ingress?: string
  configMap?: string
  secret?: string
  hpa?: string // Horizontal Pod Autoscaler
  pdb?: string // Pod Disruption Budget
  networkPolicy?: string
}

// ============================================
// CI/CD 配置模板
// ============================================

/**
 * CI/CD 配置模板
 */
export interface CICDTemplates {
  githubActions?: string
  gitlabCI?: string
  jenkinsfile?: string
}

// ============================================
// 项目模板
// ============================================

/**
 * 项目模板
 */
export interface ProjectTemplate {
  id: string
  name: string
  slug: string
  description: string
  category: TemplateCategory

  // 技术栈信息
  techStack: TechStack

  // 默认配置
  defaultConfig: DefaultConfigTemplate

  // K8s 配置模板
  k8sTemplates: K8sTemplates

  // CI/CD 配置模板
  cicdTemplates?: CICDTemplates

  // 元数据
  tags: string[]
  icon: string
  isPublic: boolean
  isSystem: boolean // 系统预设模板

  // 所有者（自定义模板）
  organizationId?: string | null
  createdBy?: string | null

  createdAt: Date
  updatedAt: Date
}

// ============================================
// 模板操作相关类型
// ============================================

/**
 * 模板筛选条件
 */
export interface TemplateFilters {
  category?: TemplateCategory
  tags?: string[]
  language?: string
  framework?: string
  isPublic?: boolean
  organizationId?: string
  search?: string
}

/**
 * 模板渲染变量
 */
export interface TemplateVariables {
  // 项目信息
  projectName: string
  projectSlug: string
  namespace: string

  // 镜像信息
  image: string
  imageTag: string
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never'

  // 副本数
  replicas: number

  // 资源配置
  resources: ResourceTemplate

  // 环境变量
  envVars: Record<string, string>

  // 健康检查
  healthCheck?: HealthCheckTemplate
  readinessProbe?: ReadinessProbeTemplate

  // 服务配置
  servicePort: number
  serviceType?: 'ClusterIP' | 'NodePort' | 'LoadBalancer'

  // Ingress 配置
  ingressEnabled?: boolean
  ingressHost?: string
  ingressPath?: string
  ingressTls?: boolean

  // GitOps 配置
  gitRepository?: string
  gitBranch?: string
  gitPath?: string

  // 其他自定义变量
  [key: string]: any
}

/**
 * 渲染后的模板
 */
export interface RenderedTemplate {
  deployment: string
  service: string
  ingress?: string
  configMap?: string
  secret?: string
  hpa?: string
  pdb?: string
  networkPolicy?: string

  // CI/CD 配置
  githubActions?: string
  gitlabCI?: string
  jenkinsfile?: string
}

/**
 * 创建模板输入
 * 注意：实际使用时请使用 schemas.ts 中从 Zod 推导的 CreateTemplateInput
 */
export interface CreateTemplateInputType {
  name: string
  slug: string
  description: string
  category: TemplateCategory
  techStack: TechStack
  defaultConfig: DefaultConfigTemplate
  k8sTemplates: K8sTemplates
  cicdTemplates?: CICDTemplates
  tags?: string[]
  icon?: string
  isPublic?: boolean
  organizationId?: string
}

/**
 * 更新模板输入
 * 注意：实际使用时请使用 schemas.ts 中从 Zod 推导的 UpdateTemplateInput
 */
export interface UpdateTemplateInputType {
  name?: string
  slug?: string
  description?: string
  category?: TemplateCategory
  techStack?: TechStack
  defaultConfig?: DefaultConfigTemplate
  k8sTemplates?: K8sTemplates
  cicdTemplates?: CICDTemplates
  tags?: string[]
  icon?: string
  isPublic?: boolean
}

// ============================================
// 模板验证相关类型
// ============================================

/**
 * 验证错误
 */
export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * 模板预览
 */
export interface TemplatePreview {
  template: ProjectTemplate
  renderedSample: RenderedTemplate
  estimatedResources: {
    cpu: string
    memory: string
    storage?: string
  }
}

// ============================================
// 预设模板标识符
// ============================================

/**
 * 系统预设模板 ID
 */
export enum SystemTemplateId {
  REACT_APP = 'react-app',
  NODEJS_API = 'nodejs-api',
  GO_MICROSERVICE = 'go-microservice',
  PYTHON_API = 'python-api',
  STATIC_WEBSITE = 'static-website',
}

/**
 * 模板使用统计
 */
export interface TemplateUsageStats {
  templateId: string
  usageCount: number
  lastUsedAt?: Date
  averageHealthScore?: number
}
