/**
 * 项目初始化状态机 - 类型定义
 */

export type InitializationState =
  | 'IDLE'
  | 'CREATING_PROJECT'
  | 'LOADING_TEMPLATE'
  | 'RENDERING_TEMPLATE'
  | 'CREATING_ENVIRONMENTS'
  | 'SETTING_UP_REPOSITORY'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'

export type InitializationEvent =
  | 'START'
  | 'PROJECT_CREATED'
  | 'TEMPLATE_LOADED'
  | 'TEMPLATE_RENDERED'
  | 'ENVIRONMENTS_CREATED'
  | 'REPOSITORY_READY'
  | 'FINALIZED'
  | 'ERROR'

export interface InitializationContext {
  // 输入数据
  userId: string
  organizationId: string
  projectData: {
    name: string
    slug: string
    description?: string
    logoUrl?: string
    visibility?: 'public' | 'private' | 'internal'
  }
  templateId?: string
  templateConfig?: Record<string, any>
  repository?: RepositoryConfig

  // 运行时数据
  projectId?: string
  templatePath?: string
  environmentIds?: string[]
  repositoryId?: string
  gitopsResourceIds?: string[]
  jobIds?: string[]

  // 状态
  currentState: InitializationState
  progress: number
  error?: Error

  // 🎯 进度推送函数（由状态机注入）
  publishDetail?: (detail: {
    action: string
    subProgress?: number
    metadata?: Record<string, any>
  }) => Promise<void>
}

export interface RepositoryConfig {
  mode: 'existing' | 'create'
  provider: 'github' | 'gitlab'
  accessToken: string
  // existing mode
  url?: string
  // create mode
  name?: string
  visibility?: 'public' | 'private'
  defaultBranch?: string
  includeAppCode?: boolean
}

export interface StateHandler {
  name: InitializationState
  execute(context: InitializationContext): Promise<void>
  canHandle(context: InitializationContext): boolean
  getProgress(): number
}

export interface InitializationResult {
  success: boolean
  projectId: string
  jobIds?: string[]
  error?: string
}
