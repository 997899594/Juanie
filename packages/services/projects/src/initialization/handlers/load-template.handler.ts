import { Injectable, Logger } from '@nestjs/common'
import { TemplateManager } from '../../template-manager.service'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 加载模板处理器
 */
@Injectable()
export class LoadTemplateHandler implements StateHandler {
  readonly name = 'LOADING_TEMPLATE' as const
  private readonly logger = new Logger(LoadTemplateHandler.name)

  constructor(private templates: TemplateManager) {}

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

    this.logger.log(`Loading template: ${context.templateId}`)

    const template = await this.templates.getTemplate(context.templateId)
    if (!template) {
      throw new Error(`模板 ${context.templateId} 不存在`)
    }

    // 保存模板路径到上下文
    context.templatePath = template.slug
    this.logger.log(`Template loaded: ${template.slug}`)
  }
}
