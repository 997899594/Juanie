import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { TemplatesService } from '@juanie/service-business'
import { cicdConfigSchema, dockerfileConfigSchema } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { eq, or } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { TrpcService } from '../trpc/trpc.service'

/**
 * Templates Router
 * 提供 Dockerfile 和 CI/CD 配置生成功能 + 项目模板列表
 */
@Injectable()
export class TemplatesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly templatesService: TemplatesService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 列出可用的项目模板
       */
      list: this.trpc.procedure.query(async ({ ctx }) => {
        const userId = ctx.user?.id

        // 查询公开模板 + 系统模板 + 用户所在组织的模板
        const templates = await this.db.query.projectTemplates.findMany({
          where: or(
            eq(schema.projectTemplates.isPublic, true),
            eq(schema.projectTemplates.isSystem, true),
            // 如果用户已登录，还可以看到自己组织的模板
            userId ? eq(schema.projectTemplates.createdBy, userId) : undefined,
          ),
          orderBy: (templates, { desc }) => [desc(templates.createdAt)],
        })

        return templates
      }),

      /**
       * 生成 Dockerfile
       */
      generateDockerfile: this.trpc.procedure
        .input(dockerfileConfigSchema)
        .mutation(async ({ input }) => {
          const dockerfile = await this.templatesService.generateDockerfile(input)
          return { dockerfile }
        }),

      /**
       * 生成 CI/CD 配置
       */
      generateCICD: this.trpc.procedure.input(cicdConfigSchema).mutation(async ({ input }) => {
        const config = await this.templatesService.generateCICD(input)
        return { config }
      }),

      /**
       * 获取预设配置
       */
      getPresets: this.trpc.procedure.query(() => {
        return {
          nodejs: {
            express: this.templatesService.getNodeJSPreset('express'),
            nestjs: this.templatesService.getNodeJSPreset('nestjs'),
            fastify: this.templatesService.getNodeJSPreset('fastify'),
          },
          python: {
            django: this.templatesService.getPythonPreset('django'),
            flask: this.templatesService.getPythonPreset('flask'),
            fastapi: this.templatesService.getPythonPreset('fastapi'),
          },
          bun: this.templatesService.getBunPreset(),
        }
      }),
    })
  }
}
