import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import Handlebars from 'handlebars'
import { TemplateLoader } from './template-loader.service'

/**
 * 模板变量接口
 */
export interface TemplateVariables {
  projectName: string
  projectSlug: string
  description?: string
  author?: string
  repository?: {
    url: string
    branch: string
  }
  environment?: {
    name: string
    type: 'development' | 'staging' | 'production'
    replicas: number
    resources: {
      requests: { cpu: string; memory: string }
      limits: { cpu: string; memory: string }
    }
  }
  [key: string]: any
}

/**
 * 渲染结果接口
 */
export interface RenderResult {
  outputDir: string
  files: string[]
  errors: string[]
}

/**
 * 模板渲染器服务
 * 负责将模板渲染成实际的项目文件
 */
@Injectable()
export class TemplateRenderer {
  private readonly logger = new Logger(TemplateRenderer.name)
  private handlebars: typeof Handlebars

  // 二进制文件扩展名（不需要渲染）
  private readonly binaryExtensions = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.svg',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.mp4',
    '.webm',
    '.wav',
    '.mp3',
    '.zip',
    '.tar',
    '.gz',
    '.pdf',
  ])

  // 需要忽略的文件和目录
  private readonly ignorePatterns = [
    'node_modules',
    '.git',
    '.DS_Store',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
  ]

  constructor(private readonly templateLoader: TemplateLoader) {
    this.handlebars = Handlebars.create()
    this.registerHelpers()
  }

  /**
   * 注册 Handlebars 辅助函数
   */
  private registerHelpers() {
    // 条件渲染
    this.handlebars.registerHelper(
      'ifCond',
      function (this: any, v1: any, operator: string, v2: any, options: any) {
        switch (operator) {
          case '==':
            // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality for template logic
            return v1 == v2 ? options.fn(this) : options.inverse(this)
          case '===':
            return v1 === v2 ? options.fn(this) : options.inverse(this)
          case '!=':
            // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality for template logic
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

    // 转换为 kebab-case
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase()
    })

    // 转换为 camelCase
    this.handlebars.registerHelper('camelCase', (str: string) => {
      return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (c) => c.toLowerCase())
    })

    // 转换为 PascalCase
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        .replace(/^(.)/, (c) => c.toUpperCase())
    })

    // JSON 格式化
    this.handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj, null, 2)
    })

    // YAML 环境变量格式化
    this.handlebars.registerHelper('toYamlEnv', (envVars: Record<string, string>) => {
      if (!envVars || Object.keys(envVars).length === 0) {
        return ''
      }
      return Object.entries(envVars)
        .map(([key, value]) => `        - name: ${key}\n          value: "${value}"`)
        .join('\n')
    })
  }

  /**
   * 渲染模板到指定目录
   */
  async renderTemplate(
    templateSlug: string,
    variables: TemplateVariables,
    outputDir: string,
  ): Promise<RenderResult> {
    this.logger.log(`🎨 Rendering template: ${templateSlug}`)
    this.logger.log(`📁 Output directory: ${outputDir}`)

    const result: RenderResult = {
      outputDir,
      files: [],
      errors: [],
    }

    try {
      // 1. 获取模板路径
      const templatePath = await this.templateLoader.getTemplatePath(templateSlug)
      if (!templatePath) {
        throw new Error(`Template not found: ${templateSlug}`)
      }

      this.logger.log(`📂 Template path: ${templatePath}`)

      // 2. 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true })

      // 3. 复制并渲染所有文件
      const files = await this.copyAndRenderDirectory(templatePath, outputDir, variables)
      result.files = files

      this.logger.log(`✅ Successfully rendered ${files.length} files`)
    } catch (error) {
      this.logger.error(`❌ Failed to render template:`, error)
      result.errors.push(error instanceof Error ? error.message : String(error))
    }

    return result
  }

  /**
   * 递归复制并渲染目录
   */
  private async copyAndRenderDirectory(
    sourceDir: string,
    targetDir: string,
    variables: TemplateVariables,
    relativePath = '',
  ): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(sourceDir, { withFileTypes: true })

      for (const entry of entries) {
        // 跳过忽略的文件和目录
        if (this.shouldIgnore(entry.name)) {
          continue
        }

        const sourcePath = path.join(sourceDir, entry.name)
        const targetPath = path.join(targetDir, entry.name)
        const currentRelativePath = path.join(relativePath, entry.name)

        if (entry.isDirectory()) {
          // 递归处理目录
          await fs.mkdir(targetPath, { recursive: true })
          const subFiles = await this.copyAndRenderDirectory(
            sourcePath,
            targetPath,
            variables,
            currentRelativePath,
          )
          files.push(...subFiles)
        } else if (entry.isFile()) {
          // 处理文件
          await this.copyAndRenderFile(sourcePath, targetPath, variables)
          files.push(currentRelativePath)
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process directory ${sourceDir}:`, error)
      throw error
    }

    return files
  }

  /**
   * 复制并渲染单个文件
   */
  private async copyAndRenderFile(
    sourcePath: string,
    targetPath: string,
    variables: TemplateVariables,
  ): Promise<void> {
    const ext = path.extname(sourcePath).toLowerCase()

    // 二进制文件直接复制
    if (this.isBinaryFile(ext)) {
      await fs.copyFile(sourcePath, targetPath)
      this.logger.debug(`  📄 Copied binary: ${path.basename(sourcePath)}`)
      return
    }

    try {
      // 读取文件内容
      const content = await fs.readFile(sourcePath, 'utf-8')

      // 渲染模板
      const rendered = this.renderContent(content, variables)

      // 写入文件
      await fs.writeFile(targetPath, rendered, 'utf-8')
      this.logger.debug(`  ✓ Rendered: ${path.basename(sourcePath)}`)
    } catch (error) {
      this.logger.error(`Failed to render file ${sourcePath}:`, error)
      // 如果渲染失败，尝试直接复制
      await fs.copyFile(sourcePath, targetPath)
      this.logger.warn(`  ⚠ Copied without rendering: ${path.basename(sourcePath)}`)
    }
  }

  /**
   * 渲染文件内容
   */
  private renderContent(content: string, variables: TemplateVariables): string {
    try {
      const template = this.handlebars.compile(content, {
        noEscape: true, // 不转义 HTML
        strict: false, // 宽松模式
      })
      return template(variables)
    } catch (error) {
      this.logger.warn(`Failed to compile template:`, error)
      // 如果编译失败，返回原始内容
      return content
    }
  }

  /**
   * 判断是否为二进制文件
   */
  private isBinaryFile(ext: string): boolean {
    return this.binaryExtensions.has(ext)
  }

  /**
   * 判断是否应该忽略
   */
  private shouldIgnore(name: string): boolean {
    return this.ignorePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        // 简单的通配符匹配
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        return regex.test(name)
      }
      return name === pattern
    })
  }

  /**
   * 验证渲染结果
   */
  async validateRenderedFiles(outputDir: string): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    try {
      // 检查必需的文件
      const requiredFiles = ['package.json', 'README.md']

      for (const file of requiredFiles) {
        const filePath = path.join(outputDir, file)
        const exists = await this.fileExists(filePath)

        if (!exists) {
          errors.push(`Missing required file: ${file}`)
        }
      }

      // 检查 package.json 是否有效
      const packageJsonPath = path.join(outputDir, 'package.json')
      if (await this.fileExists(packageJsonPath)) {
        try {
          const content = await fs.readFile(packageJsonPath, 'utf-8')
          JSON.parse(content)
        } catch {
          errors.push('Invalid package.json format')
        }
      }
    } catch (err) {
      errors.push(`Validation error: ${err}`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 清理输出目录
   */
  async cleanOutputDirectory(outputDir: string): Promise<void> {
    try {
      await fs.rm(outputDir, { recursive: true, force: true })
      this.logger.log(`🗑️  Cleaned output directory: ${outputDir}`)
    } catch (err) {
      this.logger.error(`Failed to clean output directory:`, err)
    }
  }
}
