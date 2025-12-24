/**
 * Git 同步相关类型定义
 */

// Git 提供商 (从 git-auth.types 导入，避免重复定义)
import type { GitProvider } from './git-auth.types'
export type { GitProvider }

// Git 账号同步状态
export type GitAccountSyncStatus = 'active' | 'expired' | 'revoked'

// Git 同步日志状态
export type GitSyncLogStatus = 'pending' | 'success' | 'failed'

// Git 同步类型
export type GitSyncType = 'project' | 'member' | 'organization'

// Git 同步操作
export type GitSyncAction = 'create' | 'update' | 'delete'

// 项目角色
export type ProjectRole = 'maintainer' | 'developer' | 'viewer'

// 组织角色
export type OrgRole = 'owner' | 'admin' | 'member' | 'billing'

// GitHub 权限
export type GitHubPermission = 'admin' | 'write' | 'read'

// GitLab 访问级别
export type GitLabAccessLevel = 50 | 40 | 30 | 20 | 10

// Git 权限（联合类型）
export type GitPermission = GitHubPermission | GitLabAccessLevel

// Git 同步日志
export interface GitSyncLog {
  id: string
  syncType: GitSyncType
  action: GitSyncAction
  projectId: string | null
  userId: string | null
  organizationId: string | null
  provider: GitProvider
  gitResourceId: string | null
  gitResourceUrl: string | null
  status: GitSyncLogStatus
  error: string | null
  errorStack: string | null
  metadata: GitSyncLogMetadata | null
  createdAt: Date
  completedAt: Date | null
}

// Git 同步日志元数据
export interface GitSyncLogMetadata {
  attemptCount?: number
  lastAttemptAt?: Date
  gitApiResponse?: any
  userAgent?: string
}

// Git 协作者信息
export interface GitCollaborator {
  id: string | number
  username: string
  email?: string
  permission: GitPermission
  avatarUrl?: string
}

// Git 组织信息
export interface GitOrganizationInfo {
  id: string | number
  name: string
  url: string
  avatarUrl?: string
}

// 同步结果 (Git 同步专用)
export interface GitSyncResult {
  success: boolean
  error?: string
  gitResourceId?: string
  gitResourceUrl?: string
}

// 批量同步结果
export interface BatchSyncResult {
  total: number
  success: number
  failed: number
  errors: Array<{
    id: string
    error: string
  }>
}
