import { z } from 'zod';

// 环境创建输入
export const createEnvironmentSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1, '环境名称不能为空').max(50, '环境名称不能超过50个字符'),
  displayName: z.string().min(1, '显示名称不能为空').max(100, '显示名称不能超过100个字符'),
  url: z.string().url().optional(),
  branch: z.string().optional(),
  config: z.object({
    environmentVariables: z.record(z.string()).optional(),
    buildSettings: z.record(z.any()).optional(),
    deploymentSettings: z.record(z.any()).optional(),
  }).optional(),
});

// 环境更新输入
export const updateEnvironmentSchema = z.object({
  id: z.number(),
  displayName: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  branch: z.string().optional(),
  isActive: z.boolean().optional(),
  config: z.object({
    environmentVariables: z.record(z.string()).optional(),
    buildSettings: z.record(z.any()).optional(),
    deploymentSettings: z.record(z.any()).optional(),
  }).optional(),
});

// 环境查询输入
export const getEnvironmentByIdSchema = z.object({
  id: z.number(),
});

// 项目环境列表查询
export const listEnvironmentsByProjectSchema = z.object({
  projectId: z.number(),
});

// 删除环境
export const deleteEnvironmentSchema = z.object({
  id: z.number(),
});

// 输出schema
export const environmentSchema = z.object({
  id: z.number(),
  projectId: z.number(),
  name: z.string(),
  displayName: z.string(),
  url: z.string().nullable(),
  branch: z.string().nullable(),
  isActive: z.boolean().nullable(),
  config: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const environmentWithProjectSchema = environmentSchema.extend({
  project: z.object({
    id: z.number(),
    name: z.string(),
    displayName: z.string(),
  }),
});

// 类型导出
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>;
export type UpdateEnvironmentInput = z.infer<typeof updateEnvironmentSchema>;
export type GetEnvironmentByIdInput = z.infer<typeof getEnvironmentByIdSchema>;
export type ListEnvironmentsByProjectInput = z.infer<typeof listEnvironmentsByProjectSchema>;
export type DeleteEnvironmentInput = z.infer<typeof deleteEnvironmentSchema>;