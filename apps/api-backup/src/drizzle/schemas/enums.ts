import { pgEnum } from 'drizzle-orm/pg-core'

// 用户相关枚举
export const roleEnum = pgEnum('role', ['LEARNER', 'MENTOR', 'ADMIN'])

// 项目相关枚举
export const projectStatusEnum = pgEnum('project_status', ['ACTIVE', 'COMPLETED', 'ARCHIVED'])

// Git相关枚举
export const gitProviderEnum = pgEnum('git_provider', ['GITHUB', 'GITLAB', 'GITEA', 'BITBUCKET'])
export const branchStatusEnum = pgEnum('branch_status', [
  'ACTIVE',
  'MERGED',
  'DELETED',
  'PROTECTED',
])
export const mergeRequestStatusEnum = pgEnum('merge_request_status', [
  'OPEN',
  'MERGED',
  'CLOSED',
  'DRAFT',
])
export const gitEventTypeEnum = pgEnum('git_event_type', [
  'PUSH',
  'PULL_REQUEST',
  'MERGE',
  'TAG',
  'BRANCH_CREATE',
  'BRANCH_DELETE',
  'COMMIT',
])

// DevOps相关枚举
export const clusterStatusEnum = pgEnum('cluster_status', [
  'HEALTHY',
  'WARNING',
  'ERROR',
  'MAINTENANCE',
])
export const deploymentStatusEnum = pgEnum('deployment_status', [
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'STOPPED',
])
export const pipelineStatusEnum = pgEnum('pipeline_status', [
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'CANCELED',
])
