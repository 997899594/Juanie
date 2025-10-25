import { pgTable, uuid, text, timestamp, index, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 组织ID：团队隶属的组织（企业/部门维度）
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),

  // 团队名称：在平台展示的友好名称
  name: text('name').notNull(),

  // 团队唯一标识：组织内唯一，用于URL或自动化引用
  slug: varchar('slug', { length: 100 }).notNull(),

  // 团队简介：用途说明、职责边界等
  description: text('description'),

  // 外部ID：可选，映射到外部IdP或GitLab Group编号
  externalId: text('external_id'),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束
export const teamsIndexes = {
  orgIdx: index('teams_org_idx').on(teams.organizationId),
  slugUnique: uniqueIndex('teams_org_slug_unique').on(teams.organizationId, teams.slug),
};

// Zod 校验
export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);
export const updateTeamSchema = selectTeamSchema.pick({
  name: true,
  slug: true,
  description: true,
  externalId: true,
}).partial();

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type CreateTeam = z.infer<typeof insertTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;