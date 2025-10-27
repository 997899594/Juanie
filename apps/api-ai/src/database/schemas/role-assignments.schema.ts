import { pgTable, uuid, text, timestamp, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { users } from './users.schema';
import { roles } from './roles.schema';
import { organizations } from './organizations.schema';
import { teams } from './teams.schema';
import { projects } from './projects.schema';

// 角色绑定作用域类型：控制角色授予在哪个层级生效
export const RoleAssignmentScopeEnum = z.enum(['global', 'organization', 'team', 'project']);
export const RoleAssignmentScopePgEnum = pgEnum('role_assignment_scope', ['global', 'organization', 'team', 'project']);

export const roleAssignments = pgTable('role_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 用户ID：被授予角色的用户
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 角色ID：授予的角色
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),

  // 作用域类型：global/organization/team/project
  scopeType: RoleAssignmentScopePgEnum('scope_type').notNull().default('organization'),

  // 组织作用域：当 scopeType=organization 时使用
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // 团队作用域：当 scopeType=team 时使用
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),

  // 项目作用域：当 scopeType=project 时使用
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // 授权者：谁进行的授予（用于审计）
  assignedBy: uuid('assigned_by').references(() => users.id),

  // 授予时间：角色绑定创建时间
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),

  // 过期时间：可选；用于临时授权
  expiresAt: timestamp('expires_at'),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束

// Zod Schemas
export const insertRoleAssignmentSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  scopeType: RoleAssignmentScopeEnum,
  organizationId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  assignedBy: z.string().uuid().optional(),
  assignedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectRoleAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  scopeType: RoleAssignmentScopeEnum,
  organizationId: z.string().uuid().nullable(),
  teamId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  assignedBy: z.string().uuid().nullable(),
  assignedAt: z.date(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateRoleAssignmentSchema = selectRoleAssignmentSchema
  .pick({ scopeType: true, organizationId: true, teamId: true, projectId: true, assignedBy: true, expiresAt: true })
  .partial();

export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type NewRoleAssignment = typeof roleAssignments.$inferInsert;
export type UpdateRoleAssignment = z.infer<typeof updateRoleAssignmentSchema>;
export type RoleAssignmentScope = z.infer<typeof RoleAssignmentScopeEnum>;