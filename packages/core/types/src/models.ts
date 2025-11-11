/**
 * 共享数据模型类型
 * 这些类型应该与数据库 schema 保持一致
 */

// ============ 用户相关 ============

export interface UserPreferences {
  language: 'en' | 'zh'
  themeMode: 'light' | 'dark' | 'system'
  themeId: 'default' | 'github' | 'bilibili'
  notifications: {
    email: boolean
    inApp: boolean
  }
  ui?: {
    radius?: number
    compactMode?: boolean
    animationsEnabled?: boolean
  }
}

export interface User {
  id: string
  email: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  preferences: UserPreferences
  lastLoginAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UserSession {
  userId: string
  email: string
  createdAt: string
}

// ============ 组织相关 ============

export interface OrganizationQuotas {
  maxProjects: number
  maxUsers: number
  maxStorageGb: number
}

export interface OrganizationBilling {
  plan: 'free' | 'pro' | 'enterprise'
  billingEmail?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  displayName: string | null
  logoUrl: string | null
  quotas: OrganizationQuotas
  billing: OrganizationBilling | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'pending' | 'suspended'
  joinedAt: Date
  createdAt: Date
}

// ============ 团队相关 ============

export interface Team {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: 'owner' | 'maintainer' | 'member'
  joinedAt: Date
}

// ============ 项目相关 ============

export interface ProjectConfig {
  defaultBranch: string
  enableCiCd: boolean
  enableAi: boolean
}

export interface Project {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  visibility: 'public' | 'private' | 'internal'
  status: 'active' | 'inactive' | 'archived'
  config: ProjectConfig
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: 'owner' | 'maintainer' | 'developer' | 'viewer'
  joinedAt: Date
}

// ============ 仓库相关 ============

export interface Repository {
  id: string
  projectId: string
  provider: 'github' | 'gitlab'
  fullName: string
  cloneUrl: string
  defaultBranch: string | null
  lastSyncAt: Date | null
  syncStatus: 'pending' | 'syncing' | 'success' | 'failed' | null
  createdAt: Date
  updatedAt: Date
}

// ============ 环境相关 ============

export interface EnvironmentConfig {
  cloudProvider?: 'aws' | 'gcp' | 'azure'
  region?: string
  approvalRequired: boolean
  minApprovals: number
}

export interface EnvironmentPermission {
  subjectType: 'user' | 'team'
  subjectId: string
  permission: 'read' | 'deploy' | 'admin'
}

export interface Environment {
  id: string
  projectId: string
  name: string
  type: 'development' | 'staging' | 'production' | 'testing'
  config: EnvironmentConfig
  permissions: EnvironmentPermission[]
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============ Pipeline 相关 ============

export interface PipelineStage {
  name: string
  type: 'build' | 'test' | 'deploy'
  command: string
  timeout: number
}

export interface PipelineTriggers {
  onPush: boolean
  onPr: boolean
  onSchedule: boolean
  schedule?: string
}

export interface PipelineConfig {
  triggers: PipelineTriggers
  stages: PipelineStage[]
}

export interface Pipeline {
  id: string
  projectId: string
  name: string
  config: PipelineConfig | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PipelineRun {
  id: string
  pipelineId: string
  projectId: string
  trigger: 'push' | 'pr' | 'schedule' | 'manual'
  commitHash: string
  branch: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  startedAt: Date | null
  finishedAt: Date | null
  duration: number | null
  logsUrl: string | null
  createdAt: Date
}

// ============ 部署相关 ============

export interface Deployment {
  id: string
  projectId: string
  environmentId: string
  pipelineRunId: string | null
  version: string
  commitHash: string
  branch: string
  strategy: 'rolling' | 'blue_green' | 'canary' | null
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'
  startedAt: Date | null
  finishedAt: Date | null
  deployedBy: string | null
  deletedAt: Date | null
  createdAt: Date
}
