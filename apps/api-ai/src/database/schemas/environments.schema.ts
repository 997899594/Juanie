import { pgTable, uuid, integer, text, timestamp, boolean, index, decimal, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { projects } from './projects.schema'

// 枚举定义
export const EnvironmentTypeEnum = z.enum(['development', 'staging', 'production', 'testing', 'preview'])
export const CloudProviderEnum = z.enum(['aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel', 'netlify'])
export const EnvironmentStatusEnum = z.enum(['active', 'inactive', 'provisioning', 'error', 'maintenance'])
export const DataClassificationEnum = z.enum(['public', 'internal', 'confidential', 'restricted'])
export const EnvironmentTypePgEnum = pgEnum('environment_type', ['development', 'staging', 'production', 'testing', 'preview'])
export const CloudProviderPgEnum = pgEnum('cloud_provider', ['aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel', 'netlify'])
export const EnvironmentStatusPgEnum = pgEnum('environment_status', ['active', 'inactive', 'provisioning', 'error', 'maintenance'])
export const DataClassificationPgEnum = pgEnum('data_classification', ['public', 'internal', 'confidential', 'restricted'])

export const environments = pgTable('environments', {
  id: uuid('id').defaultRandom().primaryKey(), // 环境唯一ID
  projectId: uuid('project_id').notNull().references(() => projects.id), // 所属项目ID
  name: text('name').notNull(), // 环境名称（如：dev/staging/prod）
  displayName: text('display_name'), // 展示名称
  description: text('description'), // 环境描述
  environmentType: EnvironmentTypePgEnum('environment_type').notNull(), // 环境类型
  cloudProvider: CloudProviderPgEnum('cloud_provider'), // 云提供商
  region: text('region'), // 区域
  // 简化 infrastructureConfig - 保留核心配置
  instanceType: text('instance_type'), // 实例类型
  clusterSize: integer('cluster_size').default(1), // 集群大小
  enableAutoScaling: boolean('enable_auto_scaling').default(false), // 是否启用自动扩展
  // 简化 computeResources - 核心资源限制
  cpuCores: integer('cpu_cores').default(1), // CPU核心数
  memoryGb: integer('memory_gb').default(2), // 内存GB
  storageGb: integer('storage_gb').default(10), // 存储GB
  // 简化 networkConfig - 核心网络配置
  vpcId: text('vpc_id'), // VPC ID
  subnetId: text('subnet_id'), // 子网ID
  securityGroupId: text('security_group_id'), // 安全组ID
  loadBalancerEnabled: boolean('load_balancer_enabled').default(false), // 是否启用负载均衡
  status: EnvironmentStatusPgEnum('status').default('active'), // 环境状态
  healthCheckUrl: text('health_check_url'), // 健康检查 URL
  lastHealthCheck: timestamp('last_health_check'), // 最近健康检查时间
  // 简化 accessRestrictions - 核心访问控制
  requireVpn: boolean('require_vpn').default(false), // 是否需要VPN
  allowedIps: text('allowed_ips'), // 允许的IP列表（逗号分隔）
  // 简化 allowedUsers 和 allowedTeams - 使用逗号分隔的ID列表
  allowedUserIds: text('allowed_user_ids'), // 允许的用户ID列表（逗号分隔）
  allowedTeamIds: text('allowed_team_ids'), // 允许的团队ID列表（逗号分隔）
  // 简化 resourceQuotas - 核心配额限制
  maxCpuCores: integer('max_cpu_cores').default(8), // 最大CPU核心数
  maxMemoryGb: integer('max_memory_gb').default(32), // 最大内存GB
  maxStorageGb: integer('max_storage_gb').default(100), // 最大存储GB
  costBudget: decimal('cost_budget', { precision: 10, scale: 2 }), // 成本预算
  // 简化 autoScalingConfig - 核心自动扩展配置
  minInstances: integer('min_instances').default(1), // 最小实例数
  maxInstances: integer('max_instances').default(5), // 最大实例数
  targetCpuUtilization: integer('target_cpu_utilization').default(70), // 目标CPU利用率
  // 简化 complianceRequirements - 合规要求（逗号分隔）
  complianceFrameworks: text('compliance_frameworks'), // 合规框架列表（逗号分隔）
  // 简化 securityPolicies - 核心安全策略
  encryptionEnabled: boolean('encryption_enabled').default(true), // 是否启用加密
  backupEnabled: boolean('backup_enabled').default(true), // 是否启用备份
  monitoringEnabled: boolean('monitoring_enabled').default(true), // 是否启用监控
  dataClassification: DataClassificationPgEnum('data_classification').default('internal'), // 数据分类
  createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // 更新时间
})

// Indexes
export const environmentsProjectIdx = index('environments_project_idx').on(environments.projectId);
export const environmentsTypeIdx = index('environments_type_idx').on(environments.environmentType);
export const environmentsStatusIdx = index('environments_status_idx').on(environments.status);
export const environmentsProviderIdx = index('environments_provider_idx').on(environments.cloudProvider);
export const environmentsProjectNameUnique = uniqueIndex('environments_project_name_unique').on(
  environments.projectId,
  environments.name,
);

// Relations
export const environmentsRelations = relations(environments, ({ one }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertEnvironmentSchema = createInsertSchema(environments, {
  clusterSize: z.number().int().min(1),
  cpuCores: z.number().int().min(1),
  memoryGb: z.number().int().min(1),
  storageGb: z.number().int().min(1),
  maxCpuCores: z.number().int().min(1),
  maxMemoryGb: z.number().int().min(1),
  maxStorageGb: z.number().int().min(1),
  costBudget: z.number().min(0).optional(),
  minInstances: z.number().int().min(1),
  maxInstances: z.number().int().min(1),
  targetCpuUtilization: z.number().int().min(0).max(100),
});

export const selectEnvironmentSchema = createSelectSchema(environments);

export const updateEnvironmentSchema = insertEnvironmentSchema.partial();

export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;
export type UpdateEnvironment = z.infer<typeof updateEnvironmentSchema>;
export type EnvironmentType = z.infer<typeof EnvironmentTypeEnum>;
export type CloudProvider = z.infer<typeof CloudProviderEnum>;
export type EnvironmentStatus = z.infer<typeof EnvironmentStatusEnum>;
export type DataClassification = z.infer<typeof DataClassificationEnum>;
