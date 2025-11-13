import { systemTemplates } from '@juanie/core-database'
import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DATABASE } from '@juanie/core-tokens'
import type {
  ProjectTemplate,
  RenderedTemplate,
  TemplateFilters,
  TemplateVariables,
} from '@juanie/core-types'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, like, or, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import Handlebars from 'handlebars'

@Injectable()
export class TemplateManager implements OnModuleInit {
  private readonly logger = new Logger(TemplateManager.name)
  private handlebars: typeof Handlebars

  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {
    this.handlebars = Handlebars.create()
    this.registerHelpers()
  }

  /**
   * 模块初始化时自动插入系统模板
   */
  async onModuleInit() {
    try {
      this.logger.log('🌱 Initializing system templates...')

      for (const template of systemTemplates) {
        await this.db
          .insert(schema.projectTemplates)
          .values(template)
          .onConflictDoUpdate({
            target: schema.projectTemplates.slug,
            set: {
              ...template,
              updatedAt: new Date(),
            },
          })

        this.logger.log(`  ✓ Template: ${template.name}`)
      }

      this.logger.log(`✅ Successfully initialized ${systemTemplates.length} system templates`)
    } catch (error) {
      this.logger.error('❌ Failed to initialize system templates:', error)
    }
  }

  /**
   * 注册 Handlebars 辅助函数
   */
  private registerHelpers() {
    // 辅助函数：将对象转换为 YAML 格式的环境变量
    this.handlebars.registerHelper('toYamlEnv', (envVars: Record<string, string>) => {
      if (!envVars || Object.keys(envVars).length === 0) {
        return ''
      }
      return Object.entries(envVars)
        .map(([key, value]) => `        - name: ${key}\n          value: "${value}"`)
        .join('\n')
    })

    // 辅助函数：条件渲染
    this.handlebars.registerHelper(
      'ifCond',
      function (this: any, v1: any, operator: string, v2: any, options: any) {
        switch (operator) {
          case '==':
            // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality
            return v1 == v2 ? options.fn(this) : options.inverse(this)
          case '===':
            return v1 === v2 ? options.fn(this) : options.inverse(this)
          case '!=':
            // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality
            return v1 != v2 ? options.fn(this) : options.inverse(this)
          case '!==':
            return v1 !== v2 ? options.fn(this) : options.inverse(this)
          case '<':
            return v1 < v2 ? options.fn(this) : options.inverse(this)
          case '<=':
            return v1 <= v2 ? options.fn(this) : options.inverse(this)
          case '>':
            return v1 > v2 ? options.fn(this) : options.inverse(this)
          case '>=':
            return v1 >= v2 ? options.fn(this) : options.inverse(this)
          case '&&':
            return v1 && v2 ? options.fn(this) : options.inverse(this)
          case '||':
            return v1 || v2 ? options.fn(this) : options.inverse(this)
          default:
            return options.inverse(this)
        }
      },
    )
  }

  /**
   * 列出所有模板
   */
  @Trace('template-manager.listTemplates')
  async listTemplates(filters?: TemplateFilters): Promise<ProjectTemplate[]> {
    const conditions = []

    // 只返回公开的模板或用户组织的模板
    if (filters?.organizationId) {
      conditions.push(
        or(
          eq(schema.projectTemplates.isPublic, true),
          eq(schema.projectTemplates.organizationId, filters.organizationId),
        ),
      )
    } else {
      conditions.push(eq(schema.projectTemplates.isPublic, true))
    }

    // 按分类筛选
    if (filters?.category) {
      conditions.push(eq(schema.projectTemplates.category, filters.category))
    }

    // 按标签筛选
    if (filters?.tags && filters.tags.length > 0) {
      // 使用 JSONB 查询检查是否包含任意标签
      conditions.push(
        or(
          ...filters.tags.map(
            (tag) => sql`${schema.projectTemplates.tags} @> ${JSON.stringify([tag])}`,
          ),
        ),
      )
    }

    // 搜索
    if (filters?.search) {
      conditions.push(
        or(
          like(schema.projectTemplates.name, `%${filters.search}%`),
          like(schema.projectTemplates.description, `%${filters.search}%`),
        ),
      )
    }

    const templates = await this.db
      .select()
      .from(schema.projectTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.projectTemplates.createdAt)

    return templates as unknown as ProjectTemplate[]
  }

  /**
   * 获取模板详情
   */
  @Trace('template-manager.getTemplate')
  async getTemplate(templateId: string): Promise<ProjectTemplate | null> {
    const [template] = await this.db
      .select()
      .from(schema.projectTemplates)
      .where(eq(schema.projectTemplates.id, templateId))
      .limit(1)

    if (!template) {
      return null
    }

    return template as unknown as ProjectTemplate
  }

  /**
   * 根据 slug 获取模板
   */
  @Trace('template-manager.getTemplateBySlug')
  async getTemplateBySlug(slug: string): Promise<ProjectTemplate | null> {
    const [template] = await this.db
      .select()
      .from(schema.projectTemplates)
      .where(eq(schema.projectTemplates.slug, slug))
      .limit(1)

    if (!template) {
      return null
    }

    return template as unknown as ProjectTemplate
  }

  /**
   * 渲染模板
   * 将模板中的变量替换为实际值，生成完整的 K8s YAML 配置
   */
  @Trace('template-manager.renderTemplate')
  async renderTemplate(
    templateId: string,
    variables: TemplateVariables,
  ): Promise<RenderedTemplate> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const k8sTemplates = template.k8sTemplates as any
    const rendered: RenderedTemplate = {
      deployment: '',
      service: '',
      ingress: undefined,
      configMap: undefined,
      secret: undefined,
    }

    try {
      // 渲染 Deployment
      if (k8sTemplates.deployment) {
        const deploymentTemplate = this.handlebars.compile(k8sTemplates.deployment)
        rendered.deployment = deploymentTemplate(variables)
      }

      // 渲染 Service
      if (k8sTemplates.service) {
        const serviceTemplate = this.handlebars.compile(k8sTemplates.service)
        rendered.service = serviceTemplate(variables)
      }

      // 渲染 Ingress（可选）
      if (k8sTemplates.ingress && variables.domain) {
        const ingressTemplate = this.handlebars.compile(k8sTemplates.ingress)
        rendered.ingress = ingressTemplate(variables)
      }

      // 渲染 ConfigMap（可选）
      if (k8sTemplates.configMap) {
        const configMapTemplate = this.handlebars.compile(k8sTemplates.configMap)
        rendered.configMap = configMapTemplate(variables)
      }

      // 渲染 Secret（可选）
      if (k8sTemplates.secret) {
        const secretTemplate = this.handlebars.compile(k8sTemplates.secret)
        rendered.secret = secretTemplate(variables)
      }

      return rendered
    } catch (error) {
      throw new Error(
        `Failed to render template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 创建自定义模板
   * 只有组织管理员可以创建自定义模板
   */
  @Trace('template-manager.createCustomTemplate')
  async createCustomTemplate(
    userId: string,
    organizationId: string,
    data: {
      name: string
      slug: string
      description?: string
      category: string
      techStack: {
        language: string
        framework: string
        runtime: string
      }
      defaultConfig: any
      k8sTemplates: {
        deployment: string
        service: string
        ingress?: string
        configMap?: string
        secret?: string
      }
      cicdTemplates?: {
        githubActions?: string
        gitlabCI?: string
      }
      tags?: string[]
      icon?: string
    },
  ): Promise<ProjectTemplate> {
    // 检查用户是否是组织管理员
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('Only organization admins can create custom templates')
    }

    // 检查 slug 是否已存在
    const existing = await this.getTemplateBySlug(data.slug)
    if (existing) {
      throw new Error(`Template with slug "${data.slug}" already exists`)
    }

    // 验证模板
    const validationResult = await this.validateTemplate({
      ...data,
      id: '', // 临时 ID
      isPublic: false,
      isSystem: false,
      organizationId,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ProjectTemplate)

    if (!validationResult.valid) {
      throw new Error(`Template validation failed: ${validationResult.errors.join(', ')}`)
    }

    // 创建模板
    const [template] = await this.db
      .insert(schema.projectTemplates)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description,
        category: data.category,
        techStack: data.techStack,
        defaultConfig: data.defaultConfig,
        k8sTemplates: data.k8sTemplates,
        cicdTemplates: data.cicdTemplates,
        tags: data.tags || [],
        icon: data.icon,
        isPublic: false,
        isSystem: false,
        organizationId,
        createdBy: userId,
      })
      .returning()

    if (!template) {
      throw new Error('Failed to create template')
    }

    return template as unknown as ProjectTemplate
  }

  /**
   * 更新自定义模板
   */
  @Trace('template-manager.updateCustomTemplate')
  async updateCustomTemplate(
    userId: string,
    templateId: string,
    data: Partial<{
      name: string
      description: string
      defaultConfig: any
      k8sTemplates: any
      cicdTemplates: any
      tags: string[]
      icon: string
    }>,
  ): Promise<ProjectTemplate> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    // 系统模板不能修改
    if (template.isSystem) {
      throw new Error('System templates cannot be modified')
    }

    // 检查权限
    if (!template.organizationId) {
      throw new Error('Template has no organization')
    }

    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, template.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('Only organization admins can update templates')
    }

    // 更新模板
    const [updated] = await this.db
      .update(schema.projectTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.projectTemplates.id, templateId))
      .returning()

    if (!updated) {
      throw new Error('Failed to update template')
    }

    return updated as unknown as ProjectTemplate
  }

  /**
   * 删除自定义模板
   */
  @Trace('template-manager.deleteCustomTemplate')
  async deleteCustomTemplate(userId: string, templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    // 系统模板不能删除
    if (template.isSystem) {
      throw new Error('System templates cannot be deleted')
    }

    // 检查权限
    if (!template.organizationId) {
      throw new Error('Template has no organization')
    }

    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, template.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('Only organization admins can delete templates')
    }

    // 检查是否有项目使用此模板
    const [projectCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.projects)
      .where(and(eq(schema.projects.templateId, templateId), isNull(schema.projects.deletedAt)))

    if (projectCount && projectCount.count > 0) {
      throw new Error('Cannot delete template that is being used by projects')
    }

    // 删除模板
    await this.db.delete(schema.projectTemplates).where(eq(schema.projectTemplates.id, templateId))
  }

  /**
   * 验证模板配置
   * 检查模板的 K8s YAML 语法和必需字段
   */
  @Trace('template-manager.validateTemplate')
  async validateTemplate(template: ProjectTemplate): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // 验证基本字段
    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required')
    }

    if (!template.slug || template.slug.trim() === '') {
      errors.push('Template slug is required')
    }

    if (!template.category) {
      errors.push('Template category is required')
    }

    // 验证技术栈
    if (!template.techStack) {
      errors.push('Tech stack is required')
    } else {
      if (!template.techStack.language) {
        errors.push('Tech stack language is required')
      }
      if (!template.techStack.framework) {
        errors.push('Tech stack framework is required')
      }
      if (!template.techStack.runtime) {
        errors.push('Tech stack runtime is required')
      }
    }

    // 验证默认配置
    if (!template.defaultConfig) {
      errors.push('Default config is required')
    } else {
      const config = template.defaultConfig as any

      // 验证环境配置
      if (!config.environments || !Array.isArray(config.environments)) {
        errors.push('Default config must include environments array')
      } else if (config.environments.length === 0) {
        errors.push('At least one environment is required')
      } else {
        config.environments.forEach((env: any, index: number) => {
          if (!env.name) {
            errors.push(`Environment ${index + 1}: name is required`)
          }
          if (!env.type) {
            errors.push(`Environment ${index + 1}: type is required`)
          }
          if (env.replicas === undefined || env.replicas < 1) {
            errors.push(`Environment ${index + 1}: replicas must be at least 1`)
          }
          if (!env.resources) {
            errors.push(`Environment ${index + 1}: resources are required`)
          }
        })
      }

      // 验证资源配置
      if (!config.resources) {
        errors.push('Default config must include resources')
      }

      // 验证健康检查配置
      if (!config.healthCheck) {
        errors.push('Default config must include health check')
      }
    }

    // 验证 K8s 模板
    if (!template.k8sTemplates) {
      errors.push('K8s templates are required')
    } else {
      const k8sTemplates = template.k8sTemplates as any

      // Deployment 是必需的
      if (!k8sTemplates.deployment) {
        errors.push('Deployment template is required')
      } else {
        // 验证 Deployment 模板语法
        try {
          this.handlebars.compile(k8sTemplates.deployment)
        } catch (error) {
          errors.push(
            `Deployment template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      }

      // Service 是必需的
      if (!k8sTemplates.service) {
        errors.push('Service template is required')
      } else {
        // 验证 Service 模板语法
        try {
          this.handlebars.compile(k8sTemplates.service)
        } catch (error) {
          errors.push(
            `Service template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      }

      // 验证可选模板的语法
      if (k8sTemplates.ingress) {
        try {
          this.handlebars.compile(k8sTemplates.ingress)
        } catch (error) {
          errors.push(
            `Ingress template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      }

      if (k8sTemplates.configMap) {
        try {
          this.handlebars.compile(k8sTemplates.configMap)
        } catch (error) {
          errors.push(
            `ConfigMap template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      }

      if (k8sTemplates.secret) {
        try {
          this.handlebars.compile(k8sTemplates.secret)
        } catch (error) {
          errors.push(
            `Secret template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
