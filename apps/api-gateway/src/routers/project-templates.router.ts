import {
  createTemplateSchema,
  listTemplatesSchema,
  renderTemplateSchema,
  templateIdSchema,
  validateTemplateSchema,
} from '@juanie/core-types'
import { TemplateManager } from '@juanie/service-business'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class ProjectTemplatesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly templateManager: TemplateManager,
  ) {}

  get router() {
    return this.trpc.router({
      // 列出所有模板
      list: this.trpc.protectedProcedure
        .input(listTemplatesSchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.templateManager.listTemplates(input)
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取模板列表失败',
            })
          }
        }),

      // 获取模板详情
      get: this.trpc.protectedProcedure.input(templateIdSchema).query(async ({ ctx, input }) => {
        try {
          const template = await this.templateManager.getTemplate(input.templateId)

          if (!template) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '模板不存在',
            })
          }

          return template
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : '获取模板详情失败',
          })
        }
      }),

      // 渲染模板
      render: this.trpc.protectedProcedure
        .input(renderTemplateSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.templateManager.renderTemplate(input.templateId, input.variables)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '渲染模板失败',
            })
          }
        }),

      // 验证模板
      validate: this.trpc.protectedProcedure
        .input(validateTemplateSchema)
        .query(async ({ input }) => {
          try {
            const template = await this.templateManager.getTemplate(input.templateId)
            if (!template) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: '模板不存在',
              })
            }
            return await this.templateManager.validateTemplate(template)
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error
            }
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '验证模板失败',
            })
          }
        }),

      // 创建自定义模板（需要管理员权限）
      create: this.trpc.protectedProcedure
        .input(createTemplateSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { organizationId, ...data } = input
            return await this.templateManager.createCustomTemplate(
              ctx.user.id,
              organizationId || '',
              data,
            )
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error
            }
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建模板失败',
            })
          }
        }),
    })
  }
}
