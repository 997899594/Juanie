/**
 * Zod Schemas for API validation
 * 用于 tRPC 路由的输入验证
 */

import { z } from 'zod'

// ============================================
// 通用 Schemas
// ============================================

export const uuidSchema = z.string().uuid()
export const slugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/, '只能包含小写字母、数字和连字符')

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const searchSchema = z.object({
  query: z.string().optional(),
})

export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// 通用查询 Schemas
export const idSchema = z.object({
  id: uuidSchema,
})

export const projectIdQuerySchema = z.object({
  projectId: uuidSchema,
})

export const organizationIdQuerySchema = z.object({
  organizationId: uuidSchema,
})

export const userIdsSchema = z.object({
  userIds: z.array(uuidSchema),
})

// ============================================
// 认证 Schemas
// ============================================

export const oauthCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
})

export const sessionSchema = z.object({
  sessionId: z.string(),
})

// ============================================
// 组织 Schemas
// ============================================

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  displayName: z.string().max(500).optional(),
})

export const updateOrganizationSchema = z.object({
  orgId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  displayName: z.string().max(500).optional(),
})

export const organizationIdSchema = z.object({
  orgId: uuidSchema,
})

export const inviteMemberSchema = z.object({
  orgId: uuidSchema,
  invitedUserId: uuidSchema,
  role: z.enum(['admin', 'member']),
})

export const updateMemberRoleSchema = z.object({
  orgId: uuidSchema,
  memberId: uuidSchema,
  role: z.enum(['admin', 'member']),
})

export const removeMemberSchema = z.object({
  orgId: uuidSchema,
  memberId: uuidSchema,
})

// ============================================
// 团队 Schemas
// ============================================

export const createTeamSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
})

export const updateTeamSchema = z.object({
  teamId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional(),
})

export const teamIdSchema = z.object({
  teamId: uuidSchema,
})

export const addTeamMemberSchema = z.object({
  teamId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(['owner', 'maintainer', 'member']),
})

export const updateTeamMemberRoleSchema = z.object({
  teamId: uuidSchema,
  memberId: uuidSchema,
  role: z.enum(['owner', 'maintainer', 'member']),
})

export const removeTeamMemberSchema = z.object({
  teamId: uuidSchema,
  memberId: uuidSchema,
})

// ============================================
// 项目 Schemas
// ============================================

export const createProjectSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private', 'internal']).default('private'),
  logoUrl: z.string().url().optional(),
})

export const updateProjectSchema = z.object({
  projectId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private', 'internal']).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  config: z
    .object({
      defaultBranch: z.string().optional(),
      enableCiCd: z.boolean().optional(),
      enableAi: z.boolean().optional(),
    })
    .optional(),
})

export const projectIdSchema = z.object({
  projectId: uuidSchema,
})

export const addProjectMemberSchema = z.object({
  projectId: uuidSchema,
  memberId: uuidSchema,
  role: z.enum(['owner', 'maintainer', 'developer', 'viewer']),
})

export const updateProjectMemberRoleSchema = z.object({
  projectId: uuidSchema,
  memberId: uuidSchema,
  role: z.enum(['owner', 'maintainer', 'developer', 'viewer']),
})

export const removeProjectMemberSchema = z.object({
  projectId: uuidSchema,
  memberId: uuidSchema,
})

export const assignTeamToProjectSchema = z.object({
  projectId: uuidSchema,
  teamId: uuidSchema,
})

export const removeTeamFromProjectSchema = z.object({
  projectId: uuidSchema,
  teamId: uuidSchema,
})

export const uploadLogoSchema = z.object({
  projectId: uuidSchema,
  file: z.string(), // Base64 encoded image
  filename: z.string(),
  mimeType: z.string().regex(/^image\/(jpeg|png|gif|webp)$/),
})

// ============================================
// 仓库 Schemas
// ============================================

export const connectRepositorySchema = z.object({
  projectId: uuidSchema,
  provider: z.enum(['github', 'gitlab']),
  fullName: z.string(),
  cloneUrl: z.string().url(),
  defaultBranch: z.string().optional(),
})

export const repositoryIdSchema = z.object({
  repositoryId: uuidSchema,
})

// ============================================
// 环境 Schemas
// ============================================

export const createEnvironmentSchema = z.object({
  projectId: uuidSchema,
  name: z.string().min(1).max(100),
  type: z.enum(['development', 'staging', 'production', 'testing']),
  config: z
    .object({
      cloudProvider: z.enum(['aws', 'gcp', 'azure']).optional(),
      region: z.string().optional(),
      approvalRequired: z.boolean().default(false),
      minApprovals: z.number().int().min(0).default(0),
    })
    .optional(),
})

export const updateEnvironmentSchema = z.object({
  environmentId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['development', 'staging', 'production', 'testing']).optional(),
  config: z
    .object({
      cloudProvider: z.enum(['aws', 'gcp', 'azure']).optional(),
      region: z.string().optional(),
      approvalRequired: z.boolean().optional(),
      minApprovals: z.number().int().min(0).optional(),
    })
    .optional(),
})

export const environmentIdSchema = z.object({
  environmentId: uuidSchema,
})

export const grantEnvironmentPermissionSchema = z.object({
  environmentId: uuidSchema,
  subjectType: z.enum(['user', 'team']),
  subjectId: uuidSchema,
  permission: z.enum(['read', 'deploy', 'admin']),
})

export const revokeEnvironmentPermissionSchema = z.object({
  environmentId: uuidSchema,
  subjectType: z.enum(['user', 'team']),
  subjectId: uuidSchema,
})

// ============================================
// Pipeline Schemas
// ============================================

export const createPipelineSchema = z.object({
  projectId: uuidSchema,
  name: z.string().min(1).max(100),
  config: z
    .object({
      triggers: z.object({
        onPush: z.boolean().default(true),
        onPr: z.boolean().default(true),
        onSchedule: z.boolean().default(false),
        schedule: z.string().optional(),
      }),
      stages: z.array(
        z.object({
          name: z.string(),
          type: z.enum(['build', 'test', 'deploy']),
          command: z.string(),
          timeout: z.number().int().positive().default(300),
        }),
      ),
    })
    .optional(),
})

export const updatePipelineSchema = z.object({
  pipelineId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  config: z
    .object({
      triggers: z
        .object({
          onPush: z.boolean().optional(),
          onPr: z.boolean().optional(),
          onSchedule: z.boolean().optional(),
          schedule: z.string().optional(),
        })
        .optional(),
      stages: z
        .array(
          z.object({
            name: z.string(),
            type: z.enum(['build', 'test', 'deploy']),
            command: z.string(),
            timeout: z.number().int().positive().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

export const pipelineIdSchema = z.object({
  pipelineId: uuidSchema,
})

export const triggerPipelineSchema = z.object({
  pipelineId: uuidSchema,
  branch: z.string().optional(),
  commitHash: z.string().optional(),
})

export const pipelineRunIdSchema = z.object({
  runId: uuidSchema,
})

// ============================================
// 部署 Schemas
// ============================================

export const createDeploymentSchema = z.object({
  projectId: uuidSchema,
  environmentId: uuidSchema,
  pipelineRunId: uuidSchema.optional(),
  version: z.string(),
  commitHash: z.string(),
  branch: z.string(),
  strategy: z.enum(['rolling', 'blue_green', 'canary']).optional(),
})

export const deploymentIdSchema = z.object({
  deploymentId: uuidSchema,
})

export const approveDeploymentSchema = z.object({
  deploymentId: uuidSchema,
  comment: z.string().max(500).optional(),
})

export const rejectDeploymentSchema = z.object({
  deploymentId: uuidSchema,
  reason: z.string().max(500),
})

export const rollbackDeploymentSchema = z.object({
  deploymentId: uuidSchema,
})

// ============================================
// 成本追踪 Schemas
// ============================================

export const recordCostSchema = z.object({
  organizationId: uuidSchema,
  projectId: uuidSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  costs: z.object({
    compute: z.number().nonnegative(),
    storage: z.number().nonnegative(),
    network: z.number().nonnegative(),
    database: z.number().nonnegative(),
    other: z.number().nonnegative().optional(),
  }),
  currency: z.string().optional(),
})

export const listCostsSchema = z.object({
  organizationId: uuidSchema,
  projectId: uuidSchema.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const getCostSummarySchema = z.object({
  organizationId: uuidSchema,
  projectId: uuidSchema.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// ============================================
// 安全策略 Schemas
// ============================================

export const createSecurityPolicySchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(100),
  type: z.enum(['access_control', 'network', 'data_protection', 'compliance']),
  rules: z.record(z.string(), z.any()),
  isActive: z.boolean().default(true),
})

export const updateSecurityPolicySchema = z.object({
  policyId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['access_control', 'network', 'data_protection', 'compliance']).optional(),
  rules: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
})

export const securityPolicyIdSchema = z.object({
  policyId: uuidSchema,
})

// ============================================
// 审计日志 Schemas
// ============================================

export const listAuditLogsSchema = z
  .object({
    organizationId: uuidSchema.optional(),
    action: z.string().optional(),
    userId: uuidSchema.optional(),
    resourceType: z.string().optional(),
    resourceId: uuidSchema.optional(),
  })
  .merge(paginationSchema)
  .merge(dateRangeSchema)

export const searchAuditLogsSchema = z.object({
  organizationId: uuidSchema,
  query: z.string().optional(),
  filters: z
    .object({
      action: z.string().optional(),
      userId: uuidSchema.optional(),
      resourceType: z.string().optional(),
    })
    .optional(),
})

export const exportAuditLogsSchema = z.object({
  organizationId: uuidSchema,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  format: z.enum(['csv', 'json']).default('json'),
})

// ============================================
// 通知 Schemas
// ============================================

export const createNotificationSchema = z.object({
  userId: uuidSchema,
  type: z.enum(['deployment', 'approval', 'cost_alert', 'security', 'system']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  title: z.string().min(1).max(200),
  message: z.string().max(1000),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const notificationIdSchema = z.object({
  notificationId: uuidSchema,
})

export const markNotificationAsReadSchema = z.object({
  notificationId: uuidSchema,
})

// ============================================
// AI 助手 Schemas
// ============================================

export const createAIAssistantSchema = z.object({
  organizationId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  name: z.string().min(1).max(100),
  type: z.enum(['code_review', 'devops_engineer', 'cost_optimizer', 'security_analyst']),
  modelConfig: z.object({
    provider: z.enum(['openai', 'anthropic', 'google', 'ollama']),
    model: z.string(),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().default(2000),
  }),
  systemPrompt: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

export const updateAIAssistantSchema = z.object({
  assistantId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  modelConfig: z
    .object({
      provider: z.enum(['openai', 'anthropic', 'google', 'ollama']).optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),
})

export const assistantIdSchema = z.object({
  assistantId: uuidSchema,
})

export const chatWithAssistantSchema = z.object({
  assistantId: uuidSchema,
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.any()).optional(),
})

export const rateAssistantResponseSchema = z.object({
  assistantId: uuidSchema,
  conversationId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(500).optional(),
})

// ============================================
// 用户 Schemas
// ============================================

export const updateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
})

export const updateUserPreferencesSchema = z.object({
  language: z.enum(['en', 'zh']).optional(),
  // 新增：主题风格与模式
  themeId: z.enum(['default', 'github', 'bilibili']).optional(),
  themeMode: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      inApp: z.boolean().optional(),
    })
    .optional(),
  // 可选 UI 偏好
  ui: z
    .object({
      radius: z.number().optional(),
      compactMode: z.boolean().optional(),
      animationsEnabled: z.boolean().optional(),
    })
    .optional(),
})

export const userIdSchema = z.object({
  userId: uuidSchema,
})

// ============================================
// 模板 Schemas
// ============================================

export const dockerfileConfigSchema = z.object({
  runtime: z.enum(['nodejs', 'python', 'bun']),
  version: z.string(),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun', 'pip', 'poetry']).optional(),
  hasBuildStep: z.boolean().optional(),
  buildCommand: z.string().optional(),
  buildOutput: z.string().optional(),
  startCommand: z.string(),
  port: z.number().int().positive().default(3000),
  workdir: z.string().default('/app'),
  healthCheck: z.boolean().optional(),
  healthCheckPath: z.string().optional(),
})

export const cicdConfigSchema = z.object({
  platform: z.enum(['github', 'gitlab']),
  runtime: z.enum(['nodejs', 'python', 'bun']),
  version: z.string(),
  packageManager: z.string().optional(),
  installCommand: z.string(),
  hasLinter: z.boolean().optional(),
  lintCommand: z.string().optional(),
  hasTypeCheck: z.boolean().optional(),
  typeCheckCommand: z.string().optional(),
  hasTests: z.boolean().optional(),
  testCommand: z.string().optional(),
  hasCoverage: z.boolean().optional(),
  coverageFile: z.string().optional(),
  coverageRegex: z.string().optional(),
  testEnvVars: z.record(z.string(), z.string()).optional(),
  services: z.array(z.string()).optional(),
  buildArgs: z.record(z.string(), z.string()).optional(),
  deployBranch: z.string(),
  environment: z.string(),
  environmentUrl: z.string(),
  deployScript: z.string(),
  manualDeploy: z.boolean().optional(),
  registry: z.string().optional(),
  imageName: z.string().optional(),
})

// ============================================
// 类型推导 - 从 Zod Schemas 推导 TypeScript 类型
// ============================================

// 组织相关类型
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationInput = Omit<z.infer<typeof updateOrganizationSchema>, 'orgId'>
export type InviteMemberInput = Omit<z.infer<typeof inviteMemberSchema>, 'orgId'>
export type UpdateMemberRoleInput = Omit<z.infer<typeof updateMemberRoleSchema>, 'orgId'>
export type RemoveMemberInput = Omit<z.infer<typeof removeMemberSchema>, 'orgId'>

// 团队相关类型
export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = Omit<z.infer<typeof updateTeamSchema>, 'teamId'>
export type AddTeamMemberInput = Omit<z.infer<typeof addTeamMemberSchema>, 'teamId'>
export type UpdateTeamMemberRoleInput = Omit<z.infer<typeof updateTeamMemberRoleSchema>, 'teamId'>
export type RemoveTeamMemberInput = Omit<z.infer<typeof removeTeamMemberSchema>, 'teamId'>

// 项目相关类型
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = Omit<z.infer<typeof updateProjectSchema>, 'projectId'>
export type AddProjectMemberInput = Omit<z.infer<typeof addProjectMemberSchema>, 'projectId'>
export type UpdateProjectMemberRoleInput = Omit<
  z.infer<typeof updateProjectMemberRoleSchema>,
  'projectId'
>
export type RemoveProjectMemberInput = Omit<z.infer<typeof removeProjectMemberSchema>, 'projectId'>
export type AssignTeamToProjectInput = Omit<z.infer<typeof assignTeamToProjectSchema>, 'projectId'>
export type RemoveTeamFromProjectInput = Omit<
  z.infer<typeof removeTeamFromProjectSchema>,
  'projectId'
>
export type UploadLogoInput = Omit<z.infer<typeof uploadLogoSchema>, 'projectId'>

// 仓库相关类型
export type ConnectRepositoryInput = z.infer<typeof connectRepositorySchema>

// 环境相关类型
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>
export type UpdateEnvironmentInput = Omit<z.infer<typeof updateEnvironmentSchema>, 'environmentId'>
export type GrantEnvironmentPermissionInput = Omit<
  z.infer<typeof grantEnvironmentPermissionSchema>,
  'environmentId'
>
export type RevokeEnvironmentPermissionInput = Omit<
  z.infer<typeof revokeEnvironmentPermissionSchema>,
  'environmentId'
>

// Pipeline 相关类型
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>
export type UpdatePipelineInput = Omit<z.infer<typeof updatePipelineSchema>, 'pipelineId'>
export type TriggerPipelineInput = Omit<z.infer<typeof triggerPipelineSchema>, 'pipelineId'>

// 部署相关类型
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>
export type ApproveDeploymentInput = Omit<z.infer<typeof approveDeploymentSchema>, 'deploymentId'>
export type RejectDeploymentInput = Omit<z.infer<typeof rejectDeploymentSchema>, 'deploymentId'>

// 成本追踪相关类型
export type RecordCostInput = z.infer<typeof recordCostSchema>
export type ListCostsInput = z.infer<typeof listCostsSchema>
export type GetCostSummaryInput = z.infer<typeof getCostSummarySchema>

// 安全策略相关类型
export type CreateSecurityPolicyInput = z.infer<typeof createSecurityPolicySchema>
export type UpdateSecurityPolicyInput = Omit<z.infer<typeof updateSecurityPolicySchema>, 'policyId'>

// 审计日志相关类型
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>
export type SearchAuditLogsInput = z.infer<typeof searchAuditLogsSchema>
export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsSchema>

// 通知相关类型
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>

// AI 助手相关类型
export type CreateAIAssistantInput = z.infer<typeof createAIAssistantSchema>
export type UpdateAIAssistantInput = Omit<z.infer<typeof updateAIAssistantSchema>, 'assistantId'>
export type ChatWithAssistantInput = Omit<z.infer<typeof chatWithAssistantSchema>, 'assistantId'>
export type RateAssistantResponseInput = Omit<
  z.infer<typeof rateAssistantResponseSchema>,
  'assistantId'
>

// 用户相关类型
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>

// 模板相关类型
export type DockerfileConfig = z.infer<typeof dockerfileConfigSchema>
export type CICDConfig = z.infer<typeof cicdConfigSchema>
