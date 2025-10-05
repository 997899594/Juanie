import { createId } from '@paralleldrive/cuid2'
import { boolean, integer, json, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// 枚举定义
export const roleEnum = pgEnum('role', ['LEARNER', 'MENTOR', 'ADMIN'])
export const projectStatusEnum = pgEnum('project_status', ['ACTIVE', 'COMPLETED', 'ARCHIVED'])
export const clusterStatusEnum = pgEnum('cluster_status', ['HEALTHY', 'WARNING', 'ERROR'])
export const deploymentStatusEnum = pgEnum('deployment_status', [
  'PENDING',
  'RUNNING',
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

// 用户表
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').default('LEARNER').notNull(),
  learningProgress: json('learning_progress').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 项目表
export const projects = pgTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  githubRepo: text('github_repo'),
  gitlabProjectId: integer('gitlab_project_id'),
  techStack: json('tech_stack').$type<string[]>().default([]).notNull(),
  status: projectStatusEnum('status').default('ACTIVE').notNull(),
  learningObjectives: json('learning_objectives').$type<string[]>().default([]).notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 集群表
export const clusters = pgTable('clusters', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  kubeconfig: text('kubeconfig'),
  status: clusterStatusEnum('status').default('HEALTHY').notNull(),
  nodeInfo: json('node_info').default({}).notNull(),
  resourceUsage: json('resource_usage').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 部署表
export const deployments = pgTable('deployments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  clusterId: text('cluster_id')
    .notNull()
    .references(() => clusters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  image: text('image').notNull(),
  replicas: integer('replicas').default(1).notNull(),
  status: deploymentStatusEnum('status').default('PENDING').notNull(),
  config: json('config').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 流水线表
export const pipelines = pgTable('pipelines', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  gitlabPipelineId: integer('gitlab_pipeline_id').notNull(),
  status: pipelineStatusEnum('status').default('PENDING').notNull(),
  stages: json('stages').$type<any[]>().default([]).notNull(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// 学习记录表
export const learningRecords = pgTable('learning_records', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  techStack: text('tech_stack').notNull(),
  progressScore: integer('progress_score').default(0).notNull(),
  learningData: json('learning_data').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 监控目标表
export const monitoringTargets = pgTable('monitoring_targets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  clusterId: text('cluster_id')
    .notNull()
    .references(() => clusters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  endpoint: text('endpoint').notNull(),
  type: text('type').notNull(),
  config: json('config').default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// 导出所有表的类型
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Cluster = typeof clusters.$inferSelect
export type NewCluster = typeof clusters.$inferInsert
export type Deployment = typeof deployments.$inferSelect
export type NewDeployment = typeof deployments.$inferInsert
export type Pipeline = typeof pipelines.$inferSelect
export type NewPipeline = typeof pipelines.$inferInsert
export type LearningRecord = typeof learningRecords.$inferSelect
export type NewLearningRecord = typeof learningRecords.$inferInsert
export type MonitoringTarget = typeof monitoringTargets.$inferSelect
export type NewMonitoringTarget = typeof monitoringTargets.$inferInsert
