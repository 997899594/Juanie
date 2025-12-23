import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 加载模板处理器
 * 直接从数据库查询模板信息
 */
@Injectable()
export class LoadTemplateHandler implements StateHandler {
  readonly name = 'LOADING_TEMPLATE' as const

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(LoadTemplateHandler.name)
  }

  canHandle(context: InitializationContext): boolean {
    // 只有指定了模板才需要加载
    return !!context.templateId
  }

  getProgress(): number {
    return 20
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.templateId) {
      return
    }

    this.logger.info(`Loading template: ${context.templateId}`)

    // 直接从数据库查询模板
    const [template] = await this.db
      .select()
      .from(schema.projectTemplates)
      .where(eq(schema.projectTemplates.id, context.templateId))
      .limit(1)

    if (!template) {
      throw new Error(`模板 ${context.templateId} 不存在`)
    }

    // 保存模板路径到上下文
    context.templatePath = template.slug
    this.logger.info(`Template loaded: ${template.slug}`)
  }
}
