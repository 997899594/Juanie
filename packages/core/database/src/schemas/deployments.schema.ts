import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { environments } from './environments.schema'
import { gitopsResources } from './gitops-resources.schema'
import { pipelineRuns } from './pipeline-runs.schema'
import { projects } from './projects.schema'
import { users } from './users.schema'

export const deployments = pgTable(
  'deployments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id),
    pipelineRunId: uuid('pipeline_run_id').references(() => pipelineRuns.id),

    // 版本信息
    version: text('version').notNull(),
    commitHash: text('commit_hash').notNull(),
    branch: text('branch').notNull(),

    // 部署配置
    strategy: text('strategy').default('rolling'), // 'rolling', 'blue_green', 'canary'

    // 状态
    status: text('status').notNull().default('pending'), // 'pending', 'running', 'success', 'failed', 'rolled_back'
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),

    // 执行人
    deployedBy: uuid('deployed_by').references(() => users.id),

    // GitOps 相关字段
    gitopsResourceId: uuid('gitops_resource_id').references(() => gitopsResources.id),
    deploymentMethod: text('deployment_method').default('manual'), // 'manual' | 'gitops-ui' | 'gitops-git' | 'pipeline'
    gitCommitSha: text('git_commit_sha'), // 用于 GitOps 的完整 commit SHA

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('deployments_project_idx').on(table.projectId),
    index('deployments_env_idx').on(table.environmentId),
    index('deployments_status_idx').on(table.status),
    index('deployments_deleted_idx').on(table.deletedAt),
  ],
)

export type Deployment = typeof deployments.$inferSelect
export type NewDeployment = typeof deployments.$inferInsert
