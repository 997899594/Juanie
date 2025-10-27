import { pgTable, uuid, text, timestamp, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { teams } from './teams.schema';
import { users } from './users.schema';

// 团队成员角色（团队维度的成员类型）
export const TeamMembershipRoleEnum = z.enum(['member', 'maintainer', 'owner']);
export const TeamMembershipRolePgEnum = pgEnum('team_membership_role', ['member', 'maintainer', 'owner']);

// 团队成员状态（审批/在职状态）
export const TeamMembershipStatusEnum = z.enum(['active', 'pending', 'removed']);
export const TeamMembershipStatusPgEnum = pgEnum('team_membership_status', ['active', 'pending', 'removed']);

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 团队ID：成员所属的团队
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),

  // 用户ID：加入团队的用户
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 成员角色：member/maintainer/owner
  role: TeamMembershipRolePgEnum('role').notNull().default('member'),

  // 成员状态：active/pending/removed
  status: TeamMembershipStatusPgEnum('status').notNull().default('active'),

  // 邀请者：谁邀请该成员加入团队
  invitedBy: uuid('invited_by').references(() => users.id),

  // 加入时间：成员实际加入的时间
  joinedAt: timestamp('joined_at').notNull().defaultNow(),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束

// Zod 校验
export const insertTeamMemberSchema = z.object({
  id: z.string().uuid().optional(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: TeamMembershipRoleEnum.optional(),
  status: TeamMembershipStatusEnum.optional(),
  invitedBy: z.string().uuid().optional(),
  joinedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectTeamMemberSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: TeamMembershipRoleEnum,
  status: TeamMembershipStatusEnum,
  invitedBy: z.string().uuid().nullable(),
  joinedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateTeamMemberSchema = selectTeamMemberSchema.pick({
  role: true, 
  status: true, 
  invitedBy: true 
}).partial();

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type UpdateTeamMember = z.infer<typeof updateTeamMemberSchema>;
export type TeamMembershipRole = z.infer<typeof TeamMembershipRoleEnum>;
export type TeamMembershipStatus = z.infer<typeof TeamMembershipStatusEnum>;