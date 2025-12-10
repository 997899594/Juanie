import type { Database, NewPromptTemplate, PromptTemplate } from '@juanie/core/database'
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { ErrorFactory } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

/**
 * 提示词模板服务
 * 提供提示词模板的 CRUD 操作和模板渲染功能
 */
@Injectable()
export class PromptService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * 创建提示词模板
   * @param data - 模板数据
   * @returns 创建的模板
   */
  async create(
    data: Omit<NewPromptTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>,
  ): Promise<PromptTemplate> {
    try {
      const [template] = await this.db
        .insert(schema.promptTemplates)
        .values({
          ...data,
          usageCount: 0,
        })
        .returning()

      if (!template) {
        throw ErrorFactory.ai.inferenceFailed('Failed to create prompt template: No data returned')
      }

      return template
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to create prompt template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 根据 ID 查询模板
   * @param id - 模板 ID
   * @returns 模板或 null
   */
  async findById(id: string): Promise<PromptTemplate | null> {
    try {
      const [template] = await this.db
        .select()
        .from(schema.promptTemplates)
        .where(eq(schema.promptTemplates.id, id))

      return template || null
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to find prompt template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 根据分类查询模板
   * @param category - 模板分类
   * @returns 模板列表
   */
  async findByCategory(category: string): Promise<PromptTemplate[]> {
    try {
      const templates = await this.db
        .select()
        .from(schema.promptTemplates)
        .where(
          and(
            eq(schema.promptTemplates.category, category),
            eq(schema.promptTemplates.isActive, true),
          ),
        )

      return templates
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to find templates by category: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 渲染模板
   * 将模板中的 {{variable}} 占位符替换为实际值
   * @param templateId - 模板 ID
   * @param variables - 变量映射
   * @returns 渲染后的文本
   */
  async render(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await this.findById(templateId)
    if (!template) {
      throw ErrorFactory.ai.inferenceFailed(`Template ${templateId} not found`)
    }

    // 增加使用次数
    try {
      await this.db
        .update(schema.promptTemplates)
        .set({
          usageCount: template.usageCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.promptTemplates.id, templateId))
    } catch (error) {
      // 使用计数更新失败不应该阻止渲染
      console.error('Failed to update usage count:', error)
    }

    // 替换变量
    let rendered = template.template
    for (const [key, value] of Object.entries(variables)) {
      // 使用全局替换,替换所有出现的占位符
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }

    return rendered
  }

  /**
   * 更新模板
   * @param id - 模板 ID
   * @param data - 更新数据
   * @returns 更新后的模板
   */
  async update(
    id: string,
    data: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>,
  ): Promise<PromptTemplate> {
    try {
      const [updated] = await this.db
        .update(schema.promptTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.promptTemplates.id, id))
        .returning()

      if (!updated) {
        throw ErrorFactory.ai.inferenceFailed(`Template ${id} not found`)
      }

      return updated
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to update prompt template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 删除模板
   * @param id - 模板 ID
   */
  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(schema.promptTemplates).where(eq(schema.promptTemplates.id, id))
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to delete prompt template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
