import { z } from 'zod';
import { publicProcedure, router } from '../../trpc/trpc';
import { TeamsService } from './teams.service';
import { 
  insertTeamSchema,
  updateTeamSchema,
  selectTeamSchema 
} from '../../database/schemas/teams.schema';

export const teamsRouter = router({
  // 创建团队
  create: publicProcedure
    .input(insertTeamSchema)
    .output(selectTeamSchema)
    .mutation(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      return teamsService.createTeam(input);
    }),

  // 根据ID获取团队
  getById: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .output(selectTeamSchema)
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      return teamsService.getTeamById(input.id);
    }),

  // 根据组织ID获取团队列表
  getByOrganization: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .output(z.object({
      teams: z.array(selectTeamSchema),
      total: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      const [teams, total] = await Promise.all([
        teamsService.getTeamsByOrganization(input.organizationId, input.limit, input.offset),
        teamsService.getTeamCountByOrganization(input.organizationId),
      ]);
      return { teams, total };
    }),

  // 更新团队
  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateTeamSchema,
    }))
    .output(selectTeamSchema)
    .mutation(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      return teamsService.updateTeam(input.id, input.data);
    }),

  // 删除团队
  delete: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .output(z.object({
      success: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      await teamsService.deleteTeam(input.id);
      return { success: true };
    }),

  // 批量删除团队
  deleteMany: publicProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()).min(1),
    }))
    .output(z.object({
      success: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      await teamsService.deleteTeams(input.ids);
      return { success: true };
    }),

  // 根据slug查找团队
  findBySlug: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      slug: z.string(),
    }))
    .output(selectTeamSchema.nullable())
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      return teamsService.findBySlugInOrganization(input.organizationId, input.slug);
    }),

  // 搜索团队
  search: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .output(z.object({
      teams: z.array(selectTeamSchema),
      total: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      const teams = await teamsService.searchTeamsInOrganization(
        input.organizationId, 
        input.query, 
        input.limit, 
        input.offset
      );
      return { teams, total: teams.length };
    }),

  // 获取团队统计信息
  getStats: publicProcedure
    .input(z.object({
      teamId: z.string().uuid(),
    }))
    .output(z.object({
      totalMembers: z.number(),
      activeMembers: z.number(),
      pendingMembers: z.number(),
      membersByRole: z.record(z.string(), z.number()),
    }))
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      return teamsService.getTeamStats(input.teamId);
    }),

  // 获取团队成员列表（包含用户信息）
  getMembersWithUsers: publicProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .output(z.array(z.object({
      id: z.string().uuid(),
      teamId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(['member', 'maintainer', 'owner']),
      status: z.enum(['active', 'pending', 'removed']),
      invitedBy: z.string().uuid().nullable(),
      joinedAt: z.date(),
      createdAt: z.date(),
      updatedAt: z.date(),
      user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        username: z.string(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }).nullable(),
    })))
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      return teamsService.getTeamMembersWithUsers(input.teamId, input.limit, input.offset);
    }),

  // 获取组织团队数量
  getCountByOrganization: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
    }))
    .output(z.object({
      count: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const teamsService = new TeamsService(ctx.db);
      const count = await teamsService.getTeamCountByOrganization(input.organizationId);
      return { count };
    }),
});