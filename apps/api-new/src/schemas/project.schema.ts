import { z } from 'zod';
import { 
  idSchema, 
  paginationSchema, 
  searchSchema, 
  userInfoSchema, 
  roleSchema, 
  deploySettingsSchema,
  projectIdSchema 
} from './common.schema';

// 项目创建输入
export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(50, '项目名称不能超过50个字符'),
  displayName: z.string().min(1, '显示名称不能为空').max(100, '显示名称不能超过100个字符'),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  gitlabProjectId: z.number().optional(),
  repositoryUrl: z.string().url().optional(),
  defaultBranch: z.string().default('main'),
  isPublic: z.boolean().default(false),
  deploySettings: deploySettingsSchema.optional(),
});

// 项目更新输入
export const updateProjectSchema = z.object({
  id: projectIdSchema,
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  defaultBranch: z.string().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  deploySettings: deploySettingsSchema.optional(),
});

// 项目查询输入
export const getProjectByIdSchema = z.object({
  id: idSchema,
});

// 项目列表查询输入
export const listProjectsSchema = paginationSchema.merge(searchSchema).extend({
  ownedOnly: z.boolean().default(false),
  isPublic: z.boolean().optional(),
});

// 项目成员相关
export const inviteMemberSchema = z.object({
  projectId: projectIdSchema,
  email: z.string().email(),
  role: roleSchema.default('member'),
});

export const updateMemberRoleSchema = z.object({
  projectId: projectIdSchema,
  userId: idSchema,
  role: roleSchema,
});

export const removeMemberSchema = z.object({
  projectId: projectIdSchema,
  userId: idSchema,
});

export const getProjectMembersSchema = z.object({
  projectId: projectIdSchema,
});

// 项目统计
export const getProjectStatsSchema = z.object({
  projectId: projectIdSchema,
});

// 项目活动
export const getRecentActivitiesSchema = z.object({
  projectId: projectIdSchema,
  limit: z.number().min(1).max(50).default(10),
});

// 项目部署设置
export const updateDeploySettingsSchema = z.object({
  projectId: projectIdSchema,
  deploySettings: deploySettingsSchema,
});

// 输出schema
export const projectSchema = z.object({
  id: idSchema,
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  logo: z.string().nullable(),
  ownerId: idSchema,
  gitlabProjectId: z.number().nullable(),
  repositoryUrl: z.string().nullable(),
  defaultBranch: z.string().default('main'),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(false),
  deploySettings: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const projectWithOwnerSchema = projectSchema.extend({
  owner: userInfoSchema.nullable(),
  // 添加统计字段
  environmentsCount: z.number().default(0),
  deploymentsCount: z.number().default(0),
  membersCount: z.number().default(0),
});

export const projectMemberSchema = z.object({
  id: idSchema,
  projectId: projectIdSchema,
  userId: idSchema,
  role: z.string(),
  joinedAt: z.date(),
  user: userInfoSchema.nullable(),
});

export const projectStatsSchema = z.object({
  totalDeployments: z.number(),
  successfulDeployments: z.number(),
  failedDeployments: z.number(),
  totalEnvironments: z.number(),
  lastDeployment: z.object({
    id: z.union([z.string(), z.number()]),
    version: z.string().nullable(),
    status: z.string(),
    createdAt: z.date(),
    environment: z.object({
      name: z.string(),
      displayName: z.string(),
    }).nullable(),
    user: z.object({
      name: z.string(),
    }).nullable(),
  }).nullable(),
});

export const recentActivitySchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.enum(['deployment', 'commit', 'member_added', 'member_removed']),
  title: z.string(),
  description: z.string(),
  timestamp: z.date(),
  user: z.object({
    name: z.string(),
    image: z.string().nullable(),
  }).nullable(),
  metadata: z.record(z.any()).nullable(),
});

// 类型导出
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type GetProjectByIdInput = z.infer<typeof getProjectByIdSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type GetProjectMembersInput = z.infer<typeof getProjectMembersSchema>;
export type GetProjectStatsInput = z.infer<typeof getProjectStatsSchema>;
export type GetRecentActivitiesInput = z.infer<typeof getRecentActivitiesSchema>;
export type UpdateDeploySettingsInput = z.infer<typeof updateDeploySettingsSchema>;