import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { SecurityPoliciesService } from './security-policies.service';
import { z } from 'zod';
import {
  insertSecurityPolicySchema,
  updateSecurityPolicySchema,
  selectSecurityPolicySchema,
  SecurityPolicyTypeEnum,
  SecurityPolicyStatusEnum
} from '../../database/schemas/security-policies.schema';

@Injectable()
export class SecurityPoliciesRouter {
  constructor(
    private readonly securityPoliciesService: SecurityPoliciesService,
    private readonly trpc: TrpcService
  ) {}

  public get securityPoliciesRouter() {
    return this.trpc.router({
      // Hello endpoint for testing
      hello: this.trpc.publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
          return {
            greeting: `Hello ${input.name ?? 'Security Policies'}!`,
          };
        }),

      // 创建安全策略
      create: this.trpc.protectedProcedure
        .input(insertSecurityPolicySchema)
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.createSecurityPolicy(input);
        }),

      // 根据ID获取安全策略
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getSecurityPolicyById(input.id);
        }),

      // 根据项目ID获取安全策略列表
      getByProject: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPoliciesByProject(
            input.projectId,
            input.limit,
            input.offset
          );
        }),

      // 根据环境ID获取安全策略列表
      getByEnvironment: this.trpc.protectedProcedure
        .input(z.object({
          environmentId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPoliciesByEnvironment(
            input.environmentId,
            input.limit,
            input.offset
          );
        }),

      // 根据策略类型获取安全策略列表
      getByType: this.trpc.protectedProcedure
        .input(z.object({
          policyType: z.enum(SecurityPolicyTypeEnum),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPoliciesByType(
            input.policyType,
            input.limit,
            input.offset
          );
        }),

      // 根据状态获取安全策略列表
      getByStatus: this.trpc.protectedProcedure
        .input(z.object({
          status: z.enum(SecurityPolicyStatusEnum),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPoliciesByStatus(
            input.status,
            input.limit,
            input.offset
          );
        }),

      // 获取强制执行的安全策略
      getEnforced: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getEnforcedPolicies(
            input.projectId,
            input.environmentId,
            input.limit,
            input.offset
          );
        }),

      // 搜索安全策略
      search: this.trpc.protectedProcedure
        .input(z.object({
          query: z.string(),
          filters: z.object({
            projectId: z.string().uuid().optional(),
            environmentId: z.string().uuid().optional(),
            policyType: z.enum(SecurityPolicyTypeEnum).optional(),
            status: z.enum(SecurityPolicyStatusEnum).optional(),
            isEnforced: z.boolean().optional(),
            createdBy: z.string().uuid().optional(),
            minPriority: z.number().optional(),
            maxPriority: z.number().optional(),
            dateFrom: z.string().datetime().optional(),
            dateTo: z.string().datetime().optional(),
          }).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          // 转换日期字符串为Date对象
          const filters = input.filters ? {
            ...input.filters,
            dateFrom: input.filters.dateFrom ? new Date(input.filters.dateFrom) : undefined,
            dateTo: input.filters.dateTo ? new Date(input.filters.dateTo) : undefined,
          } : undefined;
          
          return await this.securityPoliciesService.searchPolicies(
            input.query,
            filters,
            input.limit,
            input.offset
          );
        }),

      // 更新安全策略
      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateSecurityPolicySchema,
        }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.updateSecurityPolicy(input.id, input.data);
        }),

      // 切换策略状态
      toggleStatus: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          status: z.enum(SecurityPolicyStatusEnum),
        }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.togglePolicyStatus(input.id, input.status);
        }),

      // 切换强制执行状态
      toggleEnforcement: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          isEnforced: z.boolean(),
        }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.toggleEnforcement(input.id, input.isEnforced);
        }),

      // 删除安全策略
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.deleteSecurityPolicy(input.id);
        }),

      // 批量删除安全策略
      batchDelete: this.trpc.protectedProcedure
        .input(z.object({
          ids: z.array(z.string().uuid()).min(1).max(50),
        }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.batchDeletePolicies(input.ids);
        }),

      // 获取安全策略统计信息
      getStats: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPolicyStats(
            input.projectId,
            input.environmentId
          );
        }),

      // 获取策略数量
      getCount: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          policyType: z.enum(SecurityPolicyTypeEnum).optional(),
          status: z.enum(SecurityPolicyStatusEnum).optional(),
        }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPolicyCount(
            input.projectId,
            input.environmentId,
            input.policyType,
            input.status
          );
        }),

      // 复制安全策略
      duplicate: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          newName: z.string(),
          createdBy: z.string().uuid(),
        }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.duplicatePolicy(
            input.id,
            input.newName,
            input.createdBy
          );
        }),

      // 获取策略详情（包含项目和环境信息）
      getWithDetails: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return await this.securityPoliciesService.getPolicyWithDetails(input.id);
        }),

      // 验证策略数据
      validate: this.trpc.protectedProcedure
        .input(z.object({
          data: z.record(z.string(), z.any()),
        }))
        .mutation(async ({ input }) => {
          return await this.securityPoliciesService.validatePolicy(input.data);
        }),

      // 获取策略类型列表
      getPolicyTypes: this.trpc.publicProcedure
        .query(() => {
          return SecurityPolicyTypeEnum;
        }),

      // 获取策略状态列表
      getPolicyStatuses: this.trpc.publicProcedure
        .query(() => {
          return SecurityPolicyStatusEnum;
        }),
    });
  }
}