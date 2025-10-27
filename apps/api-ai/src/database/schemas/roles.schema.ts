import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex, varchar, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { organizations } from './organizations.schema';

// 角色作用域（限制角色适用范围）
export const RoleScopeEnum = z.enum(['global', 'organization', 'team', 'project']);
export const RoleScopePgEnum = pgEnum('role_scope', ['global', 'organization', 'team', 'project']);

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 组织ID：可选；为空表示全局角色，非空表示组织级自定义角色
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // 角色名称：在管理界面展示的友好名称
  name: varchar('name', { length: 100 }).notNull(),

  // 角色标识：组织内唯一（或全局唯一），用于URL或自动化脚本引用
  slug: varchar('slug', { length: 100 }).notNull(),

  // 角色作用域：global/organization/team/project
  scope: RoleScopePgEnum('scope').notNull().default('organization'),

  // 角色说明：该角色的职责、权限描述
  description: text('description'),

  // 是否系统内置：true表示平台预置的系统角色，不允许普通管理员修改
  isSystem: boolean('is_system').notNull().default(false),

  // 权限定义：细粒度权限集合，采用 allow/deny 或资源动作列表
  permissions: jsonb('permissions').$type<{
    allow?: string[]; // 允许的权限标识列表，如 'project.read', 'deployment.create'
    deny?: string[]; // 显式禁止的权限标识列表
    resources?: Array<{ resource: string; actions: string[] }>; // 资源-动作矩阵
  }>(),

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束
export const rolesIndexes = {
  orgIdx: index('roles_org_idx').on(roles.organizationId),
  scopeIdx: index('roles_scope_idx').on(roles.scope),
  uniqueOrgSlug: uniqueIndex('roles_org_slug_unique').on(roles.organizationId, roles.slug),
  uniqueGlobalSlug: uniqueIndex('roles_global_slug_unique').on(roles.slug), // 注意：对于organizationId为NULL时，需应用层确保全局唯一
};

// Zod 校验
export const insertRoleSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  scope: RoleScopeEnum.optional(),
  description: z.string().optional(),
  isSystem: z.boolean().optional(),
  permissions: z.record(z.string(), z.object({})).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectRoleSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  scope: RoleScopeEnum,
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.record(z.string(), z.object({})).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateRoleSchema = selectRoleSchema
  .pick({ name: true, slug: true, scope: true, description: true, isSystem: true, permissions: true })
  .partial();