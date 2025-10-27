import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  insertTeamSchema,
  selectTeamSchema,
  updateTeamSchema,
} from "../../database/schemas/teams.schema";
import { TrpcService } from "../../trpc/trpc.service";
import { TeamsService } from "./teams.service";

@Injectable()
export class TeamsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly teamsService: TeamsService
  ) {}

  public get teamsRouter() {
    return this.trpc.router({
      // 创建团队 - 需要认证
      create: this.trpc.protectedProcedure
        .input(insertTeamSchema)
        .output(selectTeamSchema)
        .mutation(async ({ input, ctx }) => {
          return this.teamsService.createTeam(input);
        }),

      // 根据ID获取团队 - 需要认证
      getById: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
          })
        )
        .output(selectTeamSchema)
        .query(async ({ input, ctx }) => {
          return this.teamsService.getTeamById(input.id);
        }),

      // 根据组织获取团队列表 - 需要认证
      getByOrganization: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string().uuid(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
          })
        )
        .output(
          z.object({
            teams: z.array(selectTeamSchema),
            total: z.number(),
          })
        )
        .query(async ({ input, ctx }) => {
          const teams = await this.teamsService.getTeamsByOrganization(
            input.organizationId,
            input.limit,
            input.offset
          );
          const total = await this.teamsService.getTeamCountByOrganization(
            input.organizationId
          );
          return { teams, total };
        }),

      // 更新团队 - 需要认证
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            data: updateTeamSchema,
          })
        )
        .output(selectTeamSchema)
        .mutation(async ({ input, ctx }) => {
          return this.teamsService.updateTeam(input.id, input.data);
        }),

      // 删除团队 - 需要认证
      delete: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
          })
        )
        .output(
          z.object({
            success: z.boolean(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          await this.teamsService.deleteTeam(input.id);
          return { success: true };
        }),

      // 批量删除团队 - 需要认证
      deleteMany: this.trpc.protectedProcedure
        .input(
          z.object({
            ids: z.array(z.string().uuid()).min(1),
          })
        )
        .output(
          z.object({
            success: z.boolean(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          await this.teamsService.deleteTeams(input.ids);
          return { success: true };
        }),

      // 根据slug查找团队 - 需要认证
      findBySlug: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string().uuid(),
            slug: z.string(),
          })
        )
        .output(selectTeamSchema.nullable())
        .query(async ({ input, ctx }) => {
          return this.teamsService.findBySlugInOrganization(
            input.organizationId,
            input.slug
          );
        }),

      // 搜索团队 - 需要认证
      search: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string().uuid(),
            query: z.string().min(1),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
          })
        )
        .output(
          z.object({
            teams: z.array(selectTeamSchema),
            total: z.number(),
          })
        )
        .query(async ({ input, ctx }) => {
          const teams = await this.teamsService.searchTeamsInOrganization(
            input.organizationId,
            input.query,
            input.limit,
            input.offset
          );
          return { teams, total: teams.length };
        }),

      // 获取团队统计信息 - 需要认证
      getStats: this.trpc.protectedProcedure
        .input(
          z.object({
            teamId: z.string().uuid(),
          })
        )
        .output(
          z.object({
            totalMembers: z.number(),
            activeMembers: z.number(),
            pendingMembers: z.number(),
            membersByRole: z.record(z.string(), z.number()),
          })
        )
        .query(async ({ input, ctx }) => {
          return this.teamsService.getTeamStats(input.teamId);
        }),

      // 获取团队成员及用户信息 - 需要认证
      getMembersWithUsers: this.trpc.protectedProcedure
        .input(
          z.object({
            teamId: z.string().uuid(),
            limit: z.number().min(1).max(100).default(20),
            offset: z.number().min(0).default(0),
          })
        )
        .query(async ({ input, ctx }) => {
          return this.teamsService.getTeamMembersWithUsers(
            input.teamId,
            input.limit,
            input.offset
          );
        }),

      // 获取组织下团队数量 - 需要认证
      getCountByOrganization: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string().uuid(),
          })
        )
        .output(
          z.object({
            count: z.number(),
          })
        )
        .query(async ({ input, ctx }) => {
          const count = await this.teamsService.getTeamCountByOrganization(
            input.organizationId
          );
          return { count };
        }),
    });
  }
}
