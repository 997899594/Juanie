import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'
import { organizations } from '../organization/organizations.schema'

export const projectTemplates = pgTable(
  'project_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    category: text('category').notNull(), // 'web', 'api', 'microservice', 'static', 'fullstack'

    // 技术栈
    techStack: jsonb('tech_stack').$type<{
      language: string
      framework: string
      runtime: string
    }>(),

    // 默认配置
    defaultConfig: jsonb('default_config').$type<{
      environments: Array<{
        name: string
        type: 'development' | 'staging' | 'production'
        replicas: number
        resources: {
          requests: { cpu: string; memory: string }
          limits: { cpu: string; memory: string }
        }
        envVars: Record<string, string>
        gitops: {
          enabled: boolean
          autoSync: boolean
          gitBranch: string
          gitPath: string
          syncInterval: string
        }
      }>
      resources: {
        requests: { cpu: string; memory: string }
        limits: { cpu: string; memory: string }
      }
      healthCheck: {
        enabled: boolean
        path: string
        port: number
        initialDelaySeconds: number
        periodSeconds: number
      }
      gitops: {
        enabled: boolean
        autoSync: boolean
        syncInterval: string
      }
    }>(),

    // K8s 配置模板（Handlebars 格式）
    k8sTemplates: jsonb('k8s_templates').$type<{
      deployment: string
      service: string
      ingress?: string
      configMap?: string
      secret?: string
    }>(),

    // CI/CD 配置模板
    cicdTemplates: jsonb('cicd_templates').$type<{
      githubActions?: string
      gitlabCI?: string
    }>(),

    // 元数据
    tags: jsonb('tags').$type<string[]>().default([]),
    icon: text('icon'),
    isPublic: boolean('is_public').default(true),
    isSystem: boolean('is_system').default(false), // 系统预设模板

    // 所有者（自定义模板）
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('project_templates_slug_idx').on(table.slug),
    index('project_templates_category_idx').on(table.category),
    index('project_templates_is_public_idx').on(table.isPublic),
    index('project_templates_is_system_idx').on(table.isSystem),
    index('project_templates_org_idx').on(table.organizationId),
  ],
)

export type ProjectTemplate = typeof projectTemplates.$inferSelect
export type NewProjectTemplate = typeof projectTemplates.$inferInsert
