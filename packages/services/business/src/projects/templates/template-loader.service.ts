import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { DATABASE } from '@juanie/core/tokens'
import type { NewProjectTemplate } from '@juanie/database'
import * as schema from '@juanie/database'
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import * as chokidar from 'chokidar'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'
import * as yaml from 'yaml'

/**
 * 模板元数据接口（从 template.yaml 解析）
 */
interface TemplateMetadata {
  apiVersion: string
  kind: string
  metadata: {
    name: string
    slug: string
    version: string
    category: string
    tags: string[]
    icon?: string
    author?: {
      name: string
      email: string
    }
    license?: string
  }
  spec: {
    description: string
    techStack: {
      language: string
      framework: string
      runtime?: string
    }
    parameters?: Array<{
      name: string
      type: string
      label: string
      description?: string
      required?: boolean
      default?: any
      options?: any[]
    }>
    defaultConfig?: {
      environments?: any[]
      resources?: any
      gitops?: any
    }
  }
}

/**
 * 模板加载器服务
 * 负责从文件系统加载模板并同步到数据库
 */
@Injectable()
export class TemplateLoader implements OnModuleInit {
  private readonly templatesDir: string
  private watcher?: chokidar.FSWatcher

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TemplateLoader.name)
    // 模板目录路径（项目根目录下的 templates/）
    // 优先使用环境变量，否则使用相对路径
    const templatesPath =
      process.env.TEMPLATES_DIR || path.resolve(process.cwd(), '../../templates')
    this.templatesDir = path.normalize(templatesPath)
  }

  /**
   * 模块初始化时自动加载模板
   */
  async onModuleInit() {
    try {
      this.logger.info('🔄 Loading templates from file system...')

      // 加载所有模板
      const templates = await this.loadFromFileSystem()

      // 同步到数据库
      await this.syncToDatabase(templates)

      this.logger.info(`✅ Successfully loaded ${templates.length} templates`)

      // 开发模式下监听文件变化
      if (process.env.NODE_ENV === 'development') {
        this.watchTemplates()
      }
    } catch (error) {
      this.logger.error('❌ Failed to load templates:', error)
    }
  }

  /**
   * 从文件系统加载所有模板
   */
  async loadFromFileSystem(): Promise<NewProjectTemplate[]> {
    const templates: NewProjectTemplate[] = []

    try {
      // 检查模板目录是否存在
      const exists = await this.directoryExists(this.templatesDir)
      if (!exists) {
        this.logger.warn(`Templates directory not found: ${this.templatesDir}`)
        return templates
      }

      // 读取所有子目录
      const entries = await fs.readdir(this.templatesDir, { withFileTypes: true })
      const templateDirs = entries.filter((entry) => entry.isDirectory())

      // 加载每个模板
      for (const dir of templateDirs) {
        try {
          const templatePath = path.join(this.templatesDir, dir.name)
          const template = await this.loadTemplate(templatePath, dir.name)

          if (template) {
            templates.push(template)
            this.logger.info(`  ✓ Loaded template: ${template.name}`)
          }
        } catch (error) {
          this.logger.error(`  ✗ Failed to load template ${dir.name}:`, error)
        }
      }
    } catch (error) {
      this.logger.error('Failed to read templates directory:', error)
    }

    return templates
  }

  // 辅助资源目录，不是项目模板
  private readonly RESOURCE_DIRS = ['ci-cd', 'dockerfiles', 'shared', 'common']

  /**
   * 加载单个模板
   */
  private async loadTemplate(
    templatePath: string,
    dirName: string,
  ): Promise<NewProjectTemplate | null> {
    // 跳过辅助资源目录（静默处理，不输出警告）
    if (this.RESOURCE_DIRS.includes(dirName)) {
      this.logger.debug(`  ℹ Skipping resource directory: ${dirName}`)
      return null
    }

    // 检查 template.yaml 是否存在
    const yamlPath = path.join(templatePath, 'template.yaml')
    const yamlExists = await this.fileExists(yamlPath)

    if (!yamlExists) {
      this.logger.warn(`  ⚠ Skipping ${dirName}: template.yaml not found`)
      return null
    }

    // 读取并解析 YAML
    const yamlContent = await fs.readFile(yamlPath, 'utf-8')
    const metadata = this.parseTemplateYaml(yamlContent)

    // 验证必需字段
    if (!this.validateMetadata(metadata)) {
      this.logger.warn(`  ⚠ Skipping ${dirName}: invalid metadata`)
      return null
    }

    // 转换为数据库格式
    return this.convertToDbFormat(metadata, templatePath)
  }

  /**
   * 解析 template.yaml
   */
  private parseTemplateYaml(content: string): TemplateMetadata {
    try {
      return yaml.parse(content) as TemplateMetadata
    } catch (error) {
      throw new Error(`Failed to parse template.yaml: ${error}`)
    }
  }

  /**
   * 验证模板元数据
   */
  private validateMetadata(metadata: TemplateMetadata): boolean {
    if (!metadata.metadata?.name || !metadata.metadata?.slug) {
      return false
    }

    if (!metadata.spec?.description || !metadata.spec?.techStack) {
      return false
    }

    return true
  }

  /**
   * 转换为数据库格式
   */
  private convertToDbFormat(metadata: TemplateMetadata, templatePath: string): NewProjectTemplate {
    // 将绝对路径转换为相对于 templatesDir 的路径，避免泄露本地路径
    const relativePath = path.relative(this.templatesDir, templatePath)

    return {
      name: metadata.metadata.name,
      slug: metadata.metadata.slug,
      description: metadata.spec.description,
      category: metadata.metadata.category || 'other',
      tags: [
        ...(metadata.metadata.tags || []),
        // 存储相对路径而非绝对路径，避免泄露本地文件系统信息
        `template:${relativePath}`,
      ],
      icon: metadata.metadata.icon,
      techStack: {
        language: metadata.spec.techStack.language,
        framework: metadata.spec.techStack.framework,
        runtime: metadata.spec.techStack.runtime || 'node',
      },
      defaultConfig: {
        environments: metadata.spec.defaultConfig?.environments || [],
        resources: metadata.spec.defaultConfig?.resources || {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '200m', memory: '256Mi' },
        },
        healthCheck: {
          enabled: true,
          path: '/health',
          port: 3000,
          initialDelaySeconds: 30,
          periodSeconds: 10,
        },
        gitops: metadata.spec.defaultConfig?.gitops || {
          enabled: true,
          autoSync: true,
          syncInterval: '5m',
        },
      },
      isSystem: true, // 文件系统模板标记为系统模板
      isPublic: true,
    }
  }

  /**
   * 同步模板到数据库
   */
  async syncToDatabase(templates: NewProjectTemplate[]): Promise<void> {
    for (const template of templates) {
      try {
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

        this.logger.debug(`  ✓ Synced template: ${template.name}`)
      } catch (error) {
        this.logger.error(`  ✗ Failed to sync template ${template.name}:`, error)
      }
    }
  }

  /**
   * 监听模板文件变化（开发模式）
   */
  private watchTemplates(): void {
    this.logger.info('👀 Watching templates directory for changes...')

    this.watcher = chokidar.watch(`${this.templatesDir}/**/template.yaml`, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher.on('change', async (filePath: string) => {
      this.logger.info(`📝 Template changed: ${filePath}`)
      await this.reloadTemplates()
    })

    this.watcher.on('add', async (filePath: string) => {
      this.logger.info(`➕ Template added: ${filePath}`)
      await this.reloadTemplates()
    })

    this.watcher.on('unlink', async (filePath: string) => {
      this.logger.info(`➖ Template removed: ${filePath}`)
      await this.reloadTemplates()
    })
  }

  /**
   * 重新加载所有模板
   */
  private async reloadTemplates(): Promise<void> {
    try {
      const templates = await this.loadFromFileSystem()
      await this.syncToDatabase(templates)
      this.logger.info('✅ Templates reloaded successfully')
    } catch (error) {
      this.logger.error('❌ Failed to reload templates:', error)
    }
  }

  /**
   * 根据 slug 获取模板路径
   */
  async getTemplatePath(slug: string): Promise<string | null> {
    const [template] = await this.db
      .select()
      .from(schema.projectTemplates)
      .where(eq(schema.projectTemplates.slug, slug))
      .limit(1)

    if (!template?.tags) {
      return null
    }

    // 从 tags 中提取相对路径
    const templateTag = template.tags.find((tag: string) => tag.startsWith('template:'))
    if (!templateTag) {
      return null
    }

    // 提取相对路径并拼接为绝对路径
    const relativePath = templateTag.replace('template:', '')
    return path.join(this.templatesDir, relativePath)
  }

  /**
   * 检查目录是否存在
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath)
      return stat.isFile()
    } catch {
      return false
    }
  }

  /**
   * 清理资源
   */
  async onModuleDestroy() {
    if (this.watcher) {
      await this.watcher.close()
      this.logger.info('👋 Stopped watching templates')
    }
  }
}
