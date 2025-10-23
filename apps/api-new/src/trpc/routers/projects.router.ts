import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ProjectsService } from "../../projects/projects.service";
import {
  createProjectSchema,
  getProjectByIdSchema,
  getProjectMembersSchema,
  getProjectStatsSchema,
  getRecentActivitiesSchema,
  inviteMemberSchema,
  listProjectsSchema,
  projectMemberSchema,
  projectStatsSchema,
  projectWithOwnerSchema,
  recentActivitySchema,
  removeMemberSchema,
  updateDeploySettingsSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
} from "../../schemas/project.schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export function createProjectsRouter(projectsService: ProjectsService) {
  return createTRPCRouter({
    // 创建项目
    create: protectedProcedure
      .input(createProjectSchema)
      .output(projectWithOwnerSchema)
      .mutation(async ({ input, ctx }) => {
        return await projectsService.create(input, Number(ctx.session.userId));
      }),

    // 获取项目列表
    list: protectedProcedure
      .input(listProjectsSchema)
      .output(
        z.object({
          projects: z.array(projectWithOwnerSchema),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
        })
      )
      .query(async ({ input, ctx }) => {
        return await projectsService.list(input, Number(ctx.session.userId));
      }),

    // 根据ID获取项目详情
    getById: protectedProcedure
      .input(getProjectByIdSchema)
      .output(projectWithOwnerSchema)
      .query(async ({ input, ctx }) => {
        return await projectsService.getById(
          Number(input.id),
          Number(ctx.session.userId)
        );
      }),

    // 更新项目
    update: protectedProcedure
      .input(updateProjectSchema)
      .output(projectWithOwnerSchema)
      .mutation(async ({ input, ctx }) => {
        return await projectsService.update(input, Number(ctx.session.userId));
      }),

    // 删除项目
    delete: protectedProcedure
      .input(getProjectByIdSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await projectsService.delete(
          Number(input.id),
          Number(ctx.session.userId)
        );
        return { success: true };
      }),

    // 获取项目成员
    getMembers: protectedProcedure
      .input(getProjectMembersSchema)
      .output(z.array(projectMemberSchema))
      .query(async ({ input, ctx }) => {
        return await projectsService.getMembers(
          Number(input.projectId),
          Number(ctx.session.userId)
        );
      }),

    // 邀请成员
    inviteMember: protectedProcedure
      .input(inviteMemberSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await projectsService.inviteMember(input, Number(ctx.session.userId));
        return { success: true };
      }),

    // 移除成员
    removeMember: protectedProcedure
      .input(removeMemberSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await projectsService.removeMember(input, Number(ctx.session.userId));
        return { success: true };
      }),

    // 更新成员角色
    updateMemberRole: protectedProcedure
      .input(updateMemberRoleSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await projectsService.updateMemberRole(input, Number(ctx.session.userId));
        return { success: true };
      }),

    // 更新部署设置
    updateDeploySettings: protectedProcedure
      .input(updateDeploySettingsSchema)
      .output(projectWithOwnerSchema)
      .mutation(async ({ input, ctx }) => {
        return await projectsService.updateDeploySettings(
          input,
          Number(ctx.session.userId)
        );
      }),

    // 获取项目统计
    getStats: protectedProcedure
      .input(getProjectStatsSchema)
      .output(projectStatsSchema)
      .query(async ({ input, ctx }) => {
        return await projectsService.getStats(
          Number(input.projectId),
          Number(ctx.session.userId)
        );
      }),

    // 获取最近活动
    getRecentActivities: protectedProcedure
      .input(getRecentActivitiesSchema)
      .output(z.array(recentActivitySchema))
      .query(async ({ input, ctx }) => {
        const result = await projectsService.getRecentActivities(
          Number(input.projectId),
          Number(ctx.session.userId),
          Number(input.limit)
        );
        return result;
      }),
  });
}
