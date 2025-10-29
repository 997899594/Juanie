import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '@/trpc/trpc.service'
import { EnvironmentsService } from './environments.service'

@Injectable()
export class EnvironmentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  get router() {
    return this.trpc.router({
      // 创建环境
      create: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            name: z.string().min(1).max(100),
            type: z.enum(['development', 'staging', 'production']),
            description: z.string().max(500).optional(),
            config: z
              .object({
                url: z.string().url().optional(),
                autoDeployBranch: z.string().optional(),
                requiresApproval: z.boolean().optional(),
              })
              .optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.create(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建环境失败',
            })
          }
        }),

      // 列出项目的环境
      list: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.list(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取环境列表失败',
            })
          }
        }),

      // 获取环境详情
      get: this.trpc.protectedProcedure
        .input(z.object({ environmentId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            const environment = await this.environmentsService.get(ctx.user.id, input.environmentId)

            if (!environment) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: '环境不存在',
              })
            }

            return environment
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取环境详情失败',
            })
          }
        }),

      // 更新环境
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            environmentId: z.string(),
            name: z.string().min(1).max(100).optional(),
            description: z.string().max(500).optional(),
            config: z
              .object({
                url: z.string().url().optional(),
                autoDeployBranch: z.string().optional(),
                requiresApproval: z.boolean().optional(),
              })
              .optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { environmentId, ...data } = input
            return await this.environmentsService.update(ctx.user.id, environmentId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新环境失败',
            })
          }
        }),

      // 删除环境
      delete: this.trpc.protectedProcedure
        .input(z.object({ environmentId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.delete(ctx.user.id, input.environmentId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '删除环境失败',
            })
          }
        }),

      // 授予权限
      grantPermission: this.trpc.protectedProcedure
        .input(
          z.object({
            environmentId: z.string(),
            userId: z.string(),
            canDeploy: z.boolean(),
            canApprove: z.boolean(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { environmentId, ...data } = input
            return await this.environmentsService.grantPermission(ctx.user.id, environmentId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '授予权限失败',
            })
          }
        }),

      // 撤销权限
      revokePermission: this.trpc.protectedProcedure
        .input(
          z.object({
            environmentId: z.string(),
            userId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const { environmentId, ...data } = input
            return await this.environmentsService.revokePermission(ctx.user.id, environmentId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '撤销权限失败',
            })
          }
        }),

      // 列出权限
      listPermissions: this.trpc.protectedProcedure
        .input(z.object({ environmentId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.listPermissions(ctx.user.id, input.environmentId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取权限列表失败',
            })
          }
        }),
    })
  }
}
