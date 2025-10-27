import { pgTable, uuid, text, timestamp, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { projects } from './projects.schema';
import { users } from './users.schema';
import { teams } from './teams.schema';

// 项目成员角色（对标 GitLab 常见权限）
export const ProjectMemberRoleEnum = z.enum(['guest', 'reporter', 'developer', 'maintainer', 'owner']);
export const ProjectMemberRolePgEnum = pgEnum('project_member_role', ['guest', 'reporter', 'developer', 'maintainer', 'owner']);

// 项目成员状态（审批/在职状态）
export const ProjectMemberStatusEnum = z.enum(['active', 'pending', 'removed']);
export const ProjectMemberStatusPgEnum = pgEnum('project_member_status', ['active', 'pending', 'removed']);

export const projectMemberships = pgTable('project_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 项目ID：成员所属的项目
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  // 用户ID：加入项目的用户
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 团队ID：可选；通过团队加入项目时记录对应团队
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),

  // 成员角色：guest/reporter/developer/maintainer/owner
  role: ProjectMemberRolePgEnum('role').notNull().default('developer'),

  // 成员状态：active/pending/removed
  status: ProjectMemberStatusPgEnum('status').notNull().default('active'),

  // 邀请者：谁邀请该成员加入项目
  invitedBy: uuid('invited_by').references(() => users.id),

  // 加入时间：成员实际加入的时间
  joinedAt: timestamp('joined_at').notNull().defaultNow(),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束
export const projectMembershipsIndexes = {
  projectIdx: index('project_memberships_project_idx').on(projectMemberships.projectId),
  userIdx: index('project_memberships_user_idx').on(projectMemberships.userId),
  teamIdx: index('project_memberships_team_idx').on(projectMemberships.teamId),
  statusIdx: index('project_memberships_status_idx').on(projectMemberships.status),
  roleIdx: index('project_memberships_role_idx').on(projectMemberships.role),
  uniqueProjectUser: uniqueIndex('project_memberships_project_user_unique').on(projectMemberships.projectId, projectMemberships.userId),
};

// Zod 校验
export const insertProjectMembershipSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  role: ProjectMemberRoleEnum.optional(),
  status: ProjectMemberStatusEnum.optional(),
  invitedBy: z.string().uuid().optional(),
  joinedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectProjectMembershipSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
  role: ProjectMemberRoleEnum,
  status: ProjectMemberStatusEnum,
  invitedBy: z.string().uuid().nullable(),
  joinedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateProjectMembershipSchema = selectProjectMembershipSchema
  .pick({ role: true, status: true, invitedBy: true, teamId: true })
  .partial();

export type ProjectMembership = typeof projectMemberships.$inferSelect;
export type NewProjectMembership = typeof projectMemberships.$inferInsert;
export type UpdateProjectMembership = z.infer<typeof updateProjectMembershipSchema>;
export type ProjectMemberRole = z.infer<typeof ProjectMemberRoleEnum>;
export type ProjectMemberStatus = z.infer<typeof ProjectMemberStatusEnum>;