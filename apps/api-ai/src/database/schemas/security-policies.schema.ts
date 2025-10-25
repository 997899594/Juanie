import { pgTable, uuid, varchar, text, timestamp, boolean, index, integer, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { projects } from './projects.schema'
import { environments } from './environments.schema'

// 策略类型枚举（access-control/访问控制、network/网络、data-protection/数据保护、compliance/合规）
export const SecurityPolicyTypeEnum = ['access-control', 'network', 'data-protection', 'compliance'] as const
export const SecurityPolicyTypePgEnum = pgEnum('security_policy_type', SecurityPolicyTypeEnum)

// 策略状态枚举（active/启用、inactive/停用、draft/草稿）
export const SecurityPolicyStatusEnum = ['active', 'inactive', 'draft'] as const
export const SecurityPolicyStatusPgEnum = pgEnum('security_policy_status', SecurityPolicyStatusEnum)

export const securityPolicies = pgTable(
  'security_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(), // 策略ID，主键
    
    // 基础关联
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }), // 项目ID（外键）
    environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }), // 环境ID（外键）
    
    // 策略基本信息
    name: varchar('name', { length: 100 }).notNull(), // 策略名称
    description: text('description'), // 策略描述
    policyType: SecurityPolicyTypePgEnum('policy_type').notNull(), // 策略类型
    status: SecurityPolicyStatusPgEnum('status').notNull().default('draft'), // 策略状态
    
    // 简化规则（JSON格式，但结构简单）
    rules: text('rules'), // 简单JSON格式规则定义
    
    // 基础配置
    isEnforced: boolean('is_enforced').default(false), // 是否强制执行
    priority: integer('priority').default(0), // 优先级
    
    // 审计字段
    createdBy: uuid('created_by'), // 创建者用户ID
    createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
    updatedAt: timestamp('updated_at').defaultNow().notNull(), // 更新时间
  }
)

// 简化索引定义
export const securityPoliciesIndexes = {
  projectIdIdx: index('security_policies_project_id_idx').on(securityPolicies.projectId),
  environmentIdIdx: index('security_policies_environment_id_idx').on(securityPolicies.environmentId),
  policyTypeIdx: index('security_policies_policy_type_idx').on(securityPolicies.policyType),
  statusIdx: index('security_policies_status_idx').on(securityPolicies.status),
}

// 关系定义
export const securityPoliciesRelations = relations(securityPolicies, ({ one }) => ({
  project: one(projects, {
    fields: [securityPolicies.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [securityPolicies.environmentId],
    references: [environments.id],
  }),
}))

// 简化的Zod Schemas
export const insertSecurityPolicySchema = createInsertSchema(securityPolicies)
export const selectSecurityPolicySchema = createSelectSchema(securityPolicies)
export const updateSecurityPolicySchema = selectSecurityPolicySchema.pick({
  policyType: true,
  status: true,
  priority: true,
  name: true,
  description: true,
  rules: true,
  isEnforced: true,
  projectId: true,
  environmentId: true,
}).partial()

export type SecurityPolicy = typeof securityPolicies.$inferSelect
export type NewSecurityPolicy = typeof securityPolicies.$inferInsert
export type UpdateSecurityPolicy = z.infer<typeof updateSecurityPolicySchema>
export type SecurityPolicyType = typeof SecurityPolicyTypeEnum[number]
export type SecurityPolicyStatus = typeof SecurityPolicyStatusEnum[number]