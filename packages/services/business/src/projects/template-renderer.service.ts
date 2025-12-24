import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import * as ejs from 'ejs'
import { TemplateLoader } from './template-loader.service'

/**
 * 模板变量接口
 */
export interface TemplateVariables {
  projectName: string
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
 * 使用 EJS 模板引擎，支持自定义分隔符避免与 GitHub Actions 语法冲突
 *
 * 技术选型：
 * - EJS: 行业标准，Express.js 默认模板引擎
 * - 原生支持自定义分隔符 <% %>，与 ${{ }} 无冲突
 * - 直接写 JavaScript，无需注册 helper
 * - 更好的错误提示和调试体验
 */
@Injectable()
export class TemplateRenderer {
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

  // EJS 渲染选项
  private readonly ejsOptions: ejs.Options = {
    delimiter: '%', // 使用 <% %> 分隔符
    openDelimiter: '<',
    closeDelimiter: '>',
    async: false, // 同步渲染
    compileDebug: true, // 开启调试信息
    rmWhitespace: false, // 保留空白字符
  }

  constructor(
    private readonly templateLoader: TemplateLoader,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(TemplateRenderer.name)
  }

  /**
   * 渲染模板到内存（不依赖文件系统）
   * 用于 Worker 直接推送到 Git
   */
  async renderTemplateToMemory(
    templateSlug: string,
    variables: TemplateVariables,
  ): Promise<Array<{ path: string; content: string }>> {
    this.logger.info(`🎨 Rendering template to memory: ${templateSlug}`)

    try {
      // 1. 获取模板路径
      const templatePath = await this.templateLoader.getTemplatePath(templateSlug)
      if (!templatePath) {
        throw new Error(`Template not found: ${templateSlug}`)
      }

      this.logger.info(`📂 Template path: ${templatePath}`)

      // 2. 递归读取并渲染所有文件
      const files = await this.readAndRenderDirectory(templatePath, variables)

      this.logger.info(`✅ Successfully rendered ${files.length} files to memory`)
      return files
    } catch (error) {
      this.logger.error(`❌ Failed to render template to memory:`, error)
      throw error
    }
  }

  /**
   * 渲染模板到指定目录
   */
  async renderTemplate(
    templateSlug: string,
    variables: TemplateVariables,
    outputDir: string,
  ): Promise<RenderResult> {
    this.logger.info(`🎨 Rendering template: ${templateSlug}`)
    this.logger.info(`📁 Output directory: ${outputDir}`)

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

      this.logger.info(`📂 Template path: ${templatePath}`)

      // 2. 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true })

      // 3. 复制并渲染所有文件
      const files = await this.copyAndRenderDirectory(templatePath, outputDir, variables)
      result.files = files

      this.logger.info(`✅ Successfully rendered ${files.length} files`)
    } catch (error) {
      this.logger.error(`❌ Failed to render template:`, error)
      result.errors.push(error instanceof Error ? error.message : String(error))
    }

    return result
  }

  /**
   * 递归读取并渲染目录（内存操作）
   */
  private async readAndRenderDirectory(
    sourceDir: string,
    variables: TemplateVariables,
    relativePath = '',
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = []

    try {
      const entries = await fs.readdir(sourceDir, { withFileTypes: true })

      for (const entry of entries) {
        // 跳过忽略的文件和目录
        if (this.shouldIgnore(entry.name)) {
          continue
        }

        const sourcePath = path.join(sourceDir, entry.name)
        const currentRelativePath = path.join(relativePath, entry.name)

        if (entry.isDirectory()) {
          // 递归处理目录
          const subFiles = await this.readAndRenderDirectory(
            sourcePath,
            variables,
            currentRelativePath,
          )
          files.push(...subFiles)
        } else if (entry.isFile()) {
          // 读取并渲染文件
          const content = await this.readAndRenderFile(sourcePath, variables)
          files.push({
            path: currentRelativePath,
            content,
          })
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process directory ${sourceDir}:`, error)
      throw error
    }

    return files
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
   * 读取并渲染单个文件（内存操作）
   */
  private async readAndRenderFile(
    sourcePath: string,
    variables: TemplateVariables,
  ): Promise<string> {
    const ext = path.extname(sourcePath).toLowerCase()

    // 二进制文件读取为 base64（如果需要支持二进制文件）
    if (this.isBinaryFile(ext)) {
      const buffer = await fs.readFile(sourcePath)
      this.logger.debug(`  📄 Read binary: ${path.basename(sourcePath)}`)
      return buffer.toString('base64')
    }

    try {
      // 读取文件内容
      const content = await fs.readFile(sourcePath, 'utf-8')

      // 渲染模板
      const rendered = this.renderContent(content, variables, sourcePath)

      this.logger.debug(`  ✓ Rendered: ${path.basename(sourcePath)}`)
      return rendered
    } catch (error) {
      this.logger.error(`Failed to render file ${sourcePath}:`, error)
      // 如果渲染失败，返回原始内容
      const content = await fs.readFile(sourcePath, 'utf-8')
      this.logger.warn(`  ⚠ Returned without rendering: ${path.basename(sourcePath)}`)
      return content
    }
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
      const rendered = this.renderContent(content, variables, sourcePath)

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
   * 使用 EJS 模板引擎，自动处理所有文件类型
   */
  private renderContent(content: string, variables: TemplateVariables, filePath?: string): string {
    try {
      // 使用 EJS 渲染（自定义分隔符 <% %>）
      const rendered = ejs.render(content, variables, {
        ...this.ejsOptions,
        filename: filePath, // 用于错误提示
      }) as string

      return rendered
    } catch (error) {
      const fileName = filePath ? path.basename(filePath) : 'unknown'
      this.logger.warn(`Failed to render template [${fileName}]:`, error)
      // 如果渲染失败，返回原始内容
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
      this.logger.info(`🗑️  Cleaned output directory: ${outputDir}`)
    } catch (err) {
      this.logger.error(`Failed to clean output directory:`, err)
    }
  }
}
