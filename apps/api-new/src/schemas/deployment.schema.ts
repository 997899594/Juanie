import { z } from 'zod';
import { 
  idSchema, 
  paginationSchema, 
  userInfoSchema, 
  projectIdSchema 
} from './common.schema';

// 部署状态枚举
const deploymentStatusSchema = z.enum(['pending', 'running', 'success', 'failed', 'cancelled']);

// 部署元数据schema
const deploymentMetadataSchema = z.object({
  buildTime: z.number().optional(),
  deployTime: z.number().optional(),
  previousDeploymentId: idSchema.optional(),
  rollbackFromId: idSchema.optional(),
}).optional();

// 部署创建输入
export const createDeploymentSchema = z.object({
  projectId: projectIdSchema,
  environmentId: idSchema,
  version: z.string().optional(),
  commitHash: z.string().optional(),
  commitMessage: z.string().optional(),
  branch: z.string().optional(),
  metadata: deploymentMetadataSchema,
});

// 部署更新输入
export const updateDeploymentSchema = z.object({
  id: idSchema,
  status: deploymentStatusSchema.optional(),
  logs: z.string().optional(),
  startedAt: z.date().optional(),
  finishedAt: z.date().optional(),
  metadata: deploymentMetadataSchema,
});

// 部署查询输入
export const getDeploymentByIdSchema = z.object({
  id: idSchema,
});

// 项目部署列表查询
export const listDeploymentsByProjectSchema = paginationSchema.extend({
  projectId: projectIdSchema,
  environmentId: idSchema.optional(),
  status: deploymentStatusSchema.optional(),
});

// 部署统计
export const getDeploymentStatsSchema = z.object({
  projectId: projectIdSchema,
  environmentId: idSchema.optional(),
  days: z.number().min(1).max(365).default(30),
});

// 重新部署
export const redeploySchema = z.object({
  deploymentId: idSchema,
  environmentId: idSchema.optional(), // 可选择部署到不同环境
});

// 回滚部署
export const rollbackDeploymentSchema = z.object({
  deploymentId: idSchema, // 要回滚到的部署ID
  environmentId: idSchema,
});

// 取消部署
export const cancelDeploymentSchema = z.object({
  id: idSchema,
});

// 获取部署日志
export const getDeploymentLogsSchema = z.object({
  id: idSchema,
  offset: z.number().min(0).default(0),
  limit: z.number().min(1).max(1000).default(100),
});

// 输出schema
export const deploymentSchema = z.object({
  id: idSchema,
  projectId: projectIdSchema,
  environmentId: idSchema,
  userId: idSchema,
  version: z.string().nullable(),
  commitHash: z.string().nullable(),
  commitMessage: z.string().nullable(),
  branch: z.string().nullable(),
  status: z.string(),
  logs: z.string().nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const deploymentWithDetailsSchema = deploymentSchema.extend({
  project: z.object({
    id: idSchema,
    name: z.string(),
    displayName: z.string(),
  }),
  environment: z.object({
    id: idSchema,
    name: z.string(),
    displayName: z.string(),
  }),
  user: userInfoSchema,
});

export const deploymentStatsSchema = z.object({
  totalDeployments: z.number(),
  successfulDeployments: z.number(),
  failedDeployments: z.number(),
  pendingDeployments: z.number(),
  runningDeployments: z.number(),
  averageDeployTime: z.number(), // 平均部署时间（分钟）
  deploymentsByDay: z.array(z.object({
    date: z.string(),
    count: z.number(),
    successCount: z.number(),
    failedCount: z.number(),
  })),
  recentDeployments: z.array(deploymentWithDetailsSchema),
});

export const deploymentLogsSchema = z.object({
  logs: z.string(),
  hasMore: z.boolean(),
  totalLines: z.number(),
});

// 类型导出
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;
export type UpdateDeploymentInput = z.infer<typeof updateDeploymentSchema>;
export type GetDeploymentByIdInput = z.infer<typeof getDeploymentByIdSchema>;
export type ListDeploymentsByProjectInput = z.infer<typeof listDeploymentsByProjectSchema>;
export type GetDeploymentStatsInput = z.infer<typeof getDeploymentStatsSchema>;
export type RedeployInput = z.infer<typeof redeploySchema>;
export type RollbackDeploymentInput = z.infer<typeof rollbackDeploymentSchema>;
export type CancelDeploymentInput = z.infer<typeof cancelDeploymentSchema>;
export type GetDeploymentLogsInput = z.infer<typeof getDeploymentLogsSchema>;