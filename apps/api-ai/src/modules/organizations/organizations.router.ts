import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { OrganizationsService } from './organizations.service';
import { 
  insertOrganizationSchema, 
  updateOrganizationSchema,
  Organization 
} from '../../database/schemas/organizations.schema';

@Injectable()
export class OrganizationsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  public get organizationsRouter() {
    return this.trpc.router({
      // 组织管理
      create: this.trpc.protectedProcedure
        .input(insertOrganizationSchema.omit({ 
          id: true, 
          createdAt: true, 
          updatedAt: true,
          currentProjects: true,
          currentUsers: true,
          currentStorageGb: true,
          currentMonthlyRuns: true,
        }))
        .mutation(async ({ input, ctx }) => {
          return this.organizationsService.createOrganization(input);
        }),

      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
          const organization = await this.organizationsService.findById(input.id);
          if (!organization) {
            throw new Error('Organization not found');
          }
          return organization;
        }),

      getBySlug: this.trpc.protectedProcedure
        .input(z.object({ slug: z.string() }))
        .query(async ({ input }) => {
          const organization = await this.organizationsService.findBySlug(input.slug);
          if (!organization) {
            throw new Error('Organization not found');
          }
          return organization;
        }),

      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string(),
          data: updateOrganizationSchema.partial(),
        }))
        .mutation(async ({ input }) => {
          return this.organizationsService.updateOrganization(input.id, input.data);
        }),

      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
          await this.organizationsService.deleteOrganization(input.id);
          return { success: true };
        }),

      list: this.trpc.protectedProcedure
        .input(z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return this.organizationsService.getOrganizations(input.limit, input.offset);
        }),

      search: this.trpc.protectedProcedure
        .input(z.object({
          query: z.string(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return this.organizationsService.searchOrganizations(
            input.query,
            input.limit,
            input.offset
          );
        }),

      // 组织成员管理
      getMembers: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return this.organizationsService.getOrganizationMembers(
            input.organizationId,
            input.limit,
            input.offset
          );
        }),

      addMember: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string(),
          userId: z.string(),
          roleId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
          return this.organizationsService.addOrganizationMember(
            input.organizationId,
            input.userId,
            input.roleId,
            ctx.user.id
          );
        }),

      removeMember: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string(),
          userId: z.string(),
        }))
        .mutation(async ({ input }) => {
          await this.organizationsService.removeOrganizationMember(
            input.organizationId,
            input.userId
          );
          return { success: true };
        }),

      updateMemberRole: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string(),
          userId: z.string(),
          roleId: z.string(),
        }))
        .mutation(async ({ input }) => {
          return this.organizationsService.updateMemberRole(
            input.organizationId,
            input.userId,
            input.roleId
          );
        }),

      // 组织统计和使用情况
      getStats: this.trpc.protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ input }) => {
          return this.organizationsService.getOrganizationStats(input.organizationId);
        }),

      updateUsage: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string(),
          usage: z.object({
            currentProjects: z.number().optional(),
            currentUsers: z.number().optional(),
            currentStorageGb: z.number().optional(),
            currentMonthlyRuns: z.number().optional(),
          }),
        }))
        .mutation(async ({ input }) => {
          return this.organizationsService.updateOrganizationUsage(
            input.organizationId,
            input.usage
          );
        }),

      checkUsageLimits: this.trpc.protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ input }) => {
          return this.organizationsService.checkOrganizationUsageLimits(input.organizationId);
        }),

      // 用户相关
      getUserOrganizations: this.trpc.protectedProcedure
        .input(z.object({ userId: z.string() }))
        .query(async ({ input }) => {
          return this.organizationsService.getUserOrganizations(input.userId);
        }),

      checkUserPermission: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string(),
          userId: z.string(),
        }))
        .query(async ({ input }) => {
          return this.organizationsService.checkUserPermission(
            input.organizationId,
            input.userId
          );
        }),

      // 设置验证
      validateSettings: this.trpc.protectedProcedure
        .input(z.object({ settings: z.any() }))
        .mutation(async ({ input }) => {
          return this.organizationsService.validateOrganizationSettings(input.settings);
        }),
    });
  }
}