import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { ProjectMembershipsService } from './project-memberships.service';
import {
  insertProjectMembershipSchema,
  updateProjectMembershipSchema,
  ProjectMemberRoleEnum,
  ProjectMemberStatusEnum,
} from '../../database/schemas/project-memberships.schema';

@Injectable()
export class ProjectMembershipsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectMembershipsService: ProjectMembershipsService
  ) {}

  public get projectMembershipsRouter() {
    return this.trpc.router({
      hello: this.trpc.publicProcedure.query(async () => {
        return await this.projectMembershipsService.hello();
      }),

      // 添加项目成员
      addMember: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            role: ProjectMemberRoleEnum.default('developer'),
            teamId: z.string().uuid().optional(),
            invitedBy: z.string().uuid().optional(),
          })
        )
        .mutation(async ({ input }) => {
          return await this.projectMembershipsService.addProjectMember({
            ...input,
            status: 'active',
            joinedAt: new Date(),
          });
        }),

      // 获取项目成员列表
      getProjectMembers: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            limit: z.number().min(1).max(100).default(50),
            offset: z.number().min(0).default(0),
            status: ProjectMemberStatusEnum.optional(),
          })
        )
        .query(async ({ input }) => {
          const { projectId, ...options } = input;
          return await this.projectMembershipsService.getProjectMembers(projectId, options);
        }),

      // 获取用户的项目成员身份
      getUserMembership: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
          })
        )
        .query(async ({ input }) => {
          return await this.projectMembershipsService.getUserProjectMembership(
            input.projectId,
            input.userId
          );
        }),

      // 更新成员角色
      updateMemberRole: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            role: ProjectMemberRoleEnum,
          })
        )
        .mutation(async ({ input }) => {
          return await this.projectMembershipsService.updateMemberRole(
            input.projectId,
            input.userId,
            input.role
          );
        }),

      // 移除项目成员
      removeMember: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
          })
        )
        .mutation(async ({ input }) => {
          return await this.projectMembershipsService.removeMember(
            input.projectId,
            input.userId
          );
        }),

      // 获取用户参与的项目列表
      getUserProjects: this.trpc.protectedProcedure
        .input(
          z.object({
            userId: z.string().uuid(),
            limit: z.number().min(1).max(100).default(50),
            offset: z.number().min(0).default(0),
            role: ProjectMemberRoleEnum.optional(),
          })
        )
        .query(async ({ input }) => {
          const { userId, ...options } = input;
          return await this.projectMembershipsService.getUserProjects(userId, options);
        }),

      // 批量添加项目成员
      batchAddMembers: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userIds: z.array(z.string().uuid()).min(1).max(50),
            role: ProjectMemberRoleEnum.default('developer'),
            invitedBy: z.string().uuid().optional(),
          })
        )
        .mutation(async ({ input }) => {
          return await this.projectMembershipsService.batchAddMembers(
            input.projectId,
            input.userIds,
            input.role,
            input.invitedBy
          );
        }),

      // 获取项目成员统计
      getProjectMemberStats: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
          })
        )
        .query(async ({ input }) => {
          return await this.projectMembershipsService.getProjectMemberStats(input.projectId);
        }),

      // 邀请用户加入项目（发送邀请）
      inviteUser: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            email: z.string().email(),
            role: ProjectMemberRoleEnum.default('developer'),
            invitedBy: z.string().uuid(),
            message: z.string().optional(),
          })
        )
        .mutation(async ({ input }) => {
          // TODO: 实现邀请逻辑，包括发送邮件等
          // 这里先创建一个 pending 状态的成员记录
          return { success: true, message: 'Invitation sent successfully' };
        }),

      // 接受项目邀请
      acceptInvitation: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            invitationToken: z.string().optional(),
          })
        )
        .mutation(async ({ input }) => {
          // TODO: 实现接受邀请的逻辑
          // 将 pending 状态的成员记录更新为 active
          return { success: true, message: 'Invitation accepted successfully' };
        }),

      // 拒绝项目邀请
      rejectInvitation: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            userId: z.string().uuid(),
            invitationToken: z.string().optional(),
          })
        )
        .mutation(async ({ input }) => {
          // TODO: 实现拒绝邀请的逻辑
          return { success: true, message: 'Invitation rejected successfully' };
        }),

      // 获取用户的待处理邀请
      getPendingInvitations: this.trpc.protectedProcedure
        .input(
          z.object({
            userId: z.string().uuid(),
            limit: z.number().min(1).max(50).default(20),
            offset: z.number().min(0).default(0),
          })
        )
        .query(async ({ input }) => {
          const { userId, ...options } = input;
          return await this.projectMembershipsService.getProjectMembers('', {
            ...options,
            status: 'pending',
          });
        }),
    });
  }
}