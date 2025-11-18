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

// GitOps 配置 for Repositories
export const enableGitOpsSchema = z.object({
  repositoryId: uuidSchema,
  config: z.object({
    fluxNamespace: z.string().optional(),
    fluxResourceName: z.string().optional(),
    syncInterval: z.string().optional(),
    secretRef: z.string().optional(),
    timeout: z.string().optional(),
  }),
})

export const disableGitOpsSchema = z.object({
  repositoryId: uuidSchema,
})

export const getFluxStatusSchema = z.object({
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
      gitops: z
        .object({
          enabled: z.boolean(),
          autoSync: z.boolean().optional(),
          gitBranch: z.string().optional(),
          gitPath: z.string().optional(),
          syncInterval: z.string().optional(),
        })
        .optional(),
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
      gitops: z
        .object({
          enabled: z.boolean(),
          autoSync: z.boolean().optional(),
          gitBranch: z.string().optional(),
          gitPath: z.string().optional(),
          syncInterval: z.string().optional(),
        })
        .optional(),
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

// GitOps 配置 for Environments
export const configureGitOpsSchema = z.object({
  environmentId: uuidSchema,
  config: z.object({
    enabled: z.boolean(),
    autoSync: z.boolean().optional(),
    gitBranch: z.string().min(1),
    gitPath: z.string().min(1),
    syncInterval: z.string().optional(),
  }),
})

export const getGitOpsConfigSchema = z.object({
  environmentId: uuidSchema,
})

export const disableEnvironmentGitOpsSchema = z.object({
  environmentId: uuidSchema,
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
// GitOps Schemas
// ============================================

// Flux 安装
export const installFluxSchema = z.object({
  namespace: z.string().optional(),
  version: z.string().optional(),
})

export const checkFluxHealthSchema = z.object({})

export const uninstallFluxSchema = z.object({})

// GitOps 资源
export const createGitOpsResourceSchema = z.object({
  projectId: uuidSchema,
  environmentId: uuidSchema,
  repositoryId: uuidSchema,
  type: z.enum(['kustomization', 'helm']),
  name: z.string().min(1).max(100),
  namespace: z.string().min(1).max(100),
  config: z.object({
    // Kustomization 配置
    gitRepositoryName: z.string().optional(),
    path: z.string().optional(),
    prune: z.boolean().optional(),
    healthChecks: z
      .array(
        z.object({
          apiVersion: z.string(),
          kind: z.string(),
          name: z.string(),
          namespace: z.string().optional(),
        }),
      )
      .optional(),
    dependsOn: z
      .array(
        z.object({
          name: z.string(),
          namespace: z.string().optional(),
        }),
      )
      .optional(),
    interval: z.string().optional(),
    timeout: z.string().optional(),
    retryInterval: z.string().optional(),
    // Helm 配置
    chartName: z.string().optional(),
    chartVersion: z.string().optional(),
    sourceType: z.enum(['GitRepository', 'HelmRepository']).optional(),
    sourceName: z.string().optional(),
    sourceNamespace: z.string().optional(),
    values: z.record(z.string(), z.any()).optional(),
    valuesFrom: z
      .array(
        z.object({
          kind: z.string(),
          name: z.string(),
          valuesKey: z.string().optional(),
        }),
      )
      .optional(),
    install: z
      .object({
        remediation: z.object({ retries: z.number() }).optional(),
        createNamespace: z.boolean().optional(),
      })
      .optional(),
    upgrade: z
      .object({
        remediation: z
          .object({ retries: z.number(), remediateLastFailure: z.boolean() })
          .optional(),
        cleanupOnFail: z.boolean().optional(),
      })
      .optional(),
  }),
})

export const listGitOpsResourcesSchema = z.object({
  projectId: uuidSchema,
})

export const gitOpsResourceIdSchema = z.object({
  resourceId: uuidSchema,
})

export const updateGitOpsResourceSchema = z.object({
  resourceId: uuidSchema,
  config: z.record(z.string(), z.any()).optional(),
  status: z.string().optional(),
  errorMessage: z.string().optional(),
})

export const deleteGitOpsResourceSchema = z.object({
  resourceId: uuidSchema,
})

export const triggerSyncSchema = z.object({
  kind: z.enum(['GitRepository', 'Kustomization', 'HelmRelease']),
  name: z.string(),
  namespace: z.string(),
})

// 双向部署 API
export const deployWithGitOpsSchema = z.object({
  projectId: uuidSchema,
  environmentId: uuidSchema,
  changes: z.object({
    image: z.string().optional(),
    replicas: z.number().int().positive().optional(),
    env: z.record(z.string(), z.string()).optional(),
    resources: z
      .object({
        requests: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
        limits: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
  commitMessage: z.string().optional(),
})

export const commitConfigChangesSchema = z.object({
  projectId: uuidSchema,
  environmentId: uuidSchema,
  changes: z.object({
    image: z.string().optional(),
    replicas: z.number().int().positive().optional(),
    env: z.record(z.string(), z.string()).optional(),
    resources: z
      .object({
        requests: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
        limits: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
  commitMessage: z.string().optional(),
})

export const previewChangesSchema = z.object({
  projectId: uuidSchema,
  environmentId: uuidSchema,
  changes: z.object({
    image: z.string().optional(),
    replicas: z.number().int().positive().optional(),
    env: z.record(z.string(), z.string()).optional(),
    resources: z
      .object({
        requests: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
        limits: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
})

export const validateYAMLSchema = z.object({
  content: z.string(),
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
export type EnableGitOpsInput = Omit<z.infer<typeof enableGitOpsSchema>, 'repositoryId'>
export type DisableGitOpsInput = Omit<z.infer<typeof disableGitOpsSchema>, 'repositoryId'>
export type GetFluxStatusInput = Omit<z.infer<typeof getFluxStatusSchema>, 'repositoryId'>

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
export type ConfigureGitOpsInput = Omit<z.infer<typeof configureGitOpsSchema>, 'environmentId'>
export type GetGitOpsConfigInput = Omit<z.infer<typeof getGitOpsConfigSchema>, 'environmentId'>
export type DisableEnvironmentGitOpsInput = Omit<
  z.infer<typeof disableEnvironmentGitOpsSchema>,
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

// GitOps 相关类型
export type InstallFluxInput = z.infer<typeof installFluxSchema>
export type CreateGitOpsResourceInput = z.infer<typeof createGitOpsResourceSchema>
export type UpdateGitOpsResourceInput = Omit<
  z.infer<typeof updateGitOpsResourceSchema>,
  'resourceId'
>
export type DeployWithGitOpsInput = z.infer<typeof deployWithGitOpsSchema>
export type CommitConfigChangesInput = z.infer<typeof commitConfigChangesSchema>
export type PreviewChangesInput = z.infer<typeof previewChangesSchema>
export type ValidateYAMLInput = z.infer<typeof validateYAMLSchema>

// ============================================
// 项目生产就绪 - 扩展的项目 Schemas
// ============================================

// 项目配额 Schema
export const projectQuotaSchema = z.object({
  maxEnvironments: z.number().int().positive(),
  maxRepositories: z.number().int().positive(),
  maxPods: z.number().int().positive(),
  maxCpu: z.string(),
  maxMemory: z.string(),
})

// 仓库配置 Schema - 关联现有仓库
export const existingRepositoryConfigSchema = z.object({
  mode: z.literal('existing'),
  provider: z.enum(['github', 'gitlab']),
  url: z.string().url(),
  accessToken: z.string().min(1),
  defaultBranch: z.string().optional(),
})

// 仓库配置 Schema - 创建新仓库
export const newRepositoryConfigSchema = z.object({
  mode: z.literal('create'),
  provider: z.enum(['github', 'gitlab']),
  name: z.string().min(1).max(100),
  visibility: z.enum(['public', 'private']),
  accessToken: z.string().min(1),
  defaultBranch: z.string().optional(),
  includeAppCode: z.boolean().optional(),
})

// 仓库配置联合 Schema
export const repositoryConfigSchema = z.discriminatedUnion('mode', [
  existingRepositoryConfigSchema,
  newRepositoryConfigSchema,
])

// 扩展的创建项目 Schema（包含模板和仓库配置）
export const createProjectWithTemplateSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private', 'internal']).default('private'),
  logoUrl: z.string().url().optional(),

  // 模板相关
  templateId: z.string().optional(),
  templateConfig: z.record(z.string(), z.any()).optional(),

  // 仓库配置
  repository: repositoryConfigSchema.optional(),
})

// 项目状态查询 Schema
export const getProjectStatusSchema = z.object({
  projectId: uuidSchema,
})

// 项目健康度查询 Schema
export const getProjectHealthSchema = z.object({
  projectId: uuidSchema,
})

// 归档项目 Schema
export const archiveProjectSchema = z.object({
  projectId: uuidSchema,
  reason: z.string().max(500).optional(),
  pauseGitOpsSync: z.boolean().default(true),
})

// 恢复项目 Schema
export const restoreProjectSchema = z.object({
  projectId: uuidSchema,
  resumeGitOpsSync: z.boolean().default(true),
})

// 删除项目 Schema
export const deleteProjectSchema = z.object({
  projectId: uuidSchema,
  repositoryAction: z.enum(['keep', 'archive', 'delete']).default('keep'),
})

// ============================================
// 模板 Schemas
// ============================================

// 资源配置 Schema
export const resourceTemplateSchema = z.object({
  requests: z.object({
    cpu: z.string(),
    memory: z.string(),
  }),
  limits: z.object({
    cpu: z.string(),
    memory: z.string(),
  }),
})

// 健康检查 Schema
export const healthCheckTemplateSchema = z.object({
  enabled: z.boolean(),
  httpGet: z
    .object({
      path: z.string(),
      port: z.number().int().positive(),
      scheme: z.enum(['HTTP', 'HTTPS']).optional(),
    })
    .optional(),
  tcpSocket: z
    .object({
      port: z.number().int().positive(),
    })
    .optional(),
  exec: z
    .object({
      command: z.array(z.string()),
    })
    .optional(),
  initialDelaySeconds: z.number().int().nonnegative().optional(),
  periodSeconds: z.number().int().positive().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  successThreshold: z.number().int().positive().optional(),
  failureThreshold: z.number().int().positive().optional(),
})

// GitOps 配置模板 Schema
export const gitopsTemplateSchema = z.object({
  enabled: z.boolean(),
  autoSync: z.boolean(),
  syncInterval: z.string(),
  prune: z.boolean(),
  selfHeal: z.boolean(),
})

// 环境模板 Schema
export const environmentTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['development', 'staging', 'production', 'testing']),
  replicas: z.number().int().positive(),
  resources: resourceTemplateSchema,
  envVars: z.record(z.string(), z.string()),
  gitops: gitopsTemplateSchema.extend({
    gitBranch: z.string(),
    gitPath: z.string(),
  }),
})

// 默认配置模板 Schema
export const defaultConfigTemplateSchema = z.object({
  environments: z.array(environmentTemplateSchema),
  resources: resourceTemplateSchema,
  healthCheck: healthCheckTemplateSchema,
  readinessProbe: healthCheckTemplateSchema.optional(),
  gitops: gitopsTemplateSchema,
})

// K8s 配置模板 Schema
export const k8sTemplatesSchema = z.object({
  deployment: z.string().min(1),
  service: z.string().min(1),
  ingress: z.string().optional(),
  configMap: z.string().optional(),
  secret: z.string().optional(),
  hpa: z.string().optional(),
  pdb: z.string().optional(),
  networkPolicy: z.string().optional(),
})

// CI/CD 配置模板 Schema
export const cicdTemplatesSchema = z.object({
  githubActions: z.string().optional(),
  gitlabCI: z.string().optional(),
  jenkinsfile: z.string().optional(),
})

// 技术栈 Schema
export const techStackSchema = z.object({
  language: z.string(),
  framework: z.string(),
  runtime: z.string(),
})

// 创建模板 Schema
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(1000),
  category: z.enum(['web', 'api', 'microservice', 'static', 'fullstack', 'mobile', 'data']),
  techStack: techStackSchema,
  defaultConfig: defaultConfigTemplateSchema,
  k8sTemplates: k8sTemplatesSchema,
  cicdTemplates: cicdTemplatesSchema.optional(),
  tags: z.array(z.string()).optional(),
  icon: z.string().optional(),
  isPublic: z.boolean().default(true),
  organizationId: uuidSchema.optional(),
})

// 更新模板 Schema
export const updateTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(1000).optional(),
  category: z
    .enum(['web', 'api', 'microservice', 'static', 'fullstack', 'mobile', 'data'])
    .optional(),
  techStack: techStackSchema.optional(),
  defaultConfig: defaultConfigTemplateSchema.optional(),
  k8sTemplates: k8sTemplatesSchema.optional(),
  cicdTemplates: cicdTemplatesSchema.optional(),
  tags: z.array(z.string()).optional(),
  icon: z.string().optional(),
  isPublic: z.boolean().optional(),
})

// 模板 ID Schema
export const templateIdSchema = z.object({
  templateId: z.string(),
})

// 模板筛选 Schema
export const listTemplatesSchema = z.object({
  category: z
    .enum(['web', 'api', 'microservice', 'static', 'fullstack', 'mobile', 'data'])
    .optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  isPublic: z.boolean().optional(),
  organizationId: uuidSchema.optional(),
  search: z.string().optional(),
})

// 渲染模板 Schema
export const renderTemplateSchema = z.object({
  templateId: z.string(),
  variables: z
    .object({
      projectName: z.string(),
      projectSlug: z.string(),
      namespace: z.string(),
      image: z.string(),
      imageTag: z.string(),
      imagePullPolicy: z.enum(['Always', 'IfNotPresent', 'Never']).optional(),
      replicas: z.number().int().positive(),
      resources: resourceTemplateSchema,
      envVars: z.record(z.string(), z.string()),
      healthCheck: healthCheckTemplateSchema.optional(),
      readinessProbe: healthCheckTemplateSchema.optional(),
      servicePort: z.number().int().positive(),
      serviceType: z.enum(['ClusterIP', 'NodePort', 'LoadBalancer']).optional(),
      ingressEnabled: z.boolean().optional(),
      ingressHost: z.string().optional(),
      ingressPath: z.string().optional(),
      ingressTls: z.boolean().optional(),
      gitRepository: z.string().optional(),
      gitBranch: z.string().optional(),
      gitPath: z.string().optional(),
    })
    .passthrough(), // 允许额外的自定义变量
})

// 验证模板 Schema
export const validateTemplateSchema = z.object({
  templateId: z.string(),
})

// ============================================
// 审批 Schemas
// ============================================

// 创建审批请求 Schema
export const createApprovalRequestSchema = z.object({
  deploymentId: uuidSchema,
  approvers: z.array(uuidSchema).min(1),
})

// 审批 ID Schema
export const approvalIdSchema = z.object({
  approvalId: uuidSchema,
})

// 批准部署 Schema（扩展版本）
export const approveDeploymentExtendedSchema = z.object({
  approvalId: uuidSchema,
  approverId: uuidSchema,
  comment: z.string().max(500).optional(),
})

// 拒绝部署 Schema（扩展版本）
export const rejectDeploymentExtendedSchema = z.object({
  approvalId: uuidSchema,
  approverId: uuidSchema,
  reason: z.string().min(1).max(500),
})

// 查询待审批列表 Schema
export const listPendingApprovalsSchema = z.object({
  projectId: uuidSchema.optional(),
  environmentId: uuidSchema.optional(),
  approverId: uuidSchema.optional(),
})

// ============================================
// 事件 Schemas
// ============================================

// 查询事件 Schema
export const queryEventsSchema = z.object({
  projectId: uuidSchema.optional(),
  eventType: z.union([z.string(), z.array(z.string())]).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
})

// 事件统计 Schema
export const getEventStatsSchema = z.object({
  projectId: uuidSchema,
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

// ============================================
// 类型推导 - 项目生产就绪相关
// ============================================

// 项目相关类型
export type CreateProjectWithTemplateInput = z.infer<typeof createProjectWithTemplateSchema>
export type GetProjectStatusInput = z.infer<typeof getProjectStatusSchema>
export type GetProjectHealthInput = z.infer<typeof getProjectHealthSchema>
export type ArchiveProjectInput = z.infer<typeof archiveProjectSchema>
export type RestoreProjectInput = z.infer<typeof restoreProjectSchema>
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>

// 模板相关类型
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = Omit<z.infer<typeof updateTemplateSchema>, 'templateId'>
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>
export type RenderTemplateInput = z.infer<typeof renderTemplateSchema>
export type ValidateTemplateInput = z.infer<typeof validateTemplateSchema>

// 审批相关类型
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>
export type ApproveDeploymentExtendedInput = z.infer<typeof approveDeploymentExtendedSchema>
export type RejectDeploymentExtendedInput = z.infer<typeof rejectDeploymentExtendedSchema>
export type ListPendingApprovalsInput = z.infer<typeof listPendingApprovalsSchema>

// 事件相关类型
export type QueryEventsInput = z.infer<typeof queryEventsSchema>
export type GetEventStatsInput = z.infer<typeof getEventStatsSchema>
