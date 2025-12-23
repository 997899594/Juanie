import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Trace } from '@juanie/core/observability'
import { cicdConfigSchema, dockerfileConfigSchema } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import ejs from 'ejs'
import { z } from 'zod'

// 从 Zod schemas 推导类型
export type DockerfileConfig = z.infer<typeof dockerfileConfigSchema>
export type CICDConfig = z.infer<typeof cicdConfigSchema>

// ESM 兼容的 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 模板服务 - AI 辅助生成工具
 *
 * 注意：这个服务用于独立生成 Dockerfile 和 CI/CD 配置文件
 * 不是项目初始化模板系统（那个在 templates/nextjs-15-app/）
 *
 * 使用场景：
 * - 用户在前端 Templates 页面手动生成配置
 * - AI 辅助生成单个文件
 */
@Injectable()
export class TemplatesService {
  private templatesPath = join(__dirname, '../../templates')

  private readonly ejsOptions: ejs.Options = {
    delimiter: '%',
    openDelimiter: '<',
    closeDelimiter: '>',
    async: false,
    compileDebug: true,
    rmWhitespace: false,
  }

  @Trace('templates.generateDockerfile')
  async generateDockerfile(config: DockerfileConfig): Promise<string> {
    const validatedConfig = dockerfileConfigSchema.parse(config)
    const templatePath = join(
      this.templatesPath,
      'dockerfiles',
      `${validatedConfig.runtime}.Dockerfile`,
    )

    const templateContent = await readFile(templatePath, 'utf-8')

    const context = {
      ...validatedConfig,
      nodeVersion: validatedConfig.runtime === 'nodejs' ? validatedConfig.version : undefined,
      pythonVersion: validatedConfig.runtime === 'python' ? validatedConfig.version : undefined,
      bunVersion: validatedConfig.runtime === 'bun' ? validatedConfig.version : undefined,
      useYarn: validatedConfig.packageManager === 'yarn',
      usePnpm: validatedConfig.packageManager === 'pnpm',
    }

    return ejs.render(templateContent, context, this.ejsOptions)
  }

  @Trace('templates.generateCICD')
  async generateCICD(config: CICDConfig): Promise<string> {
    const validatedConfig = cicdConfigSchema.parse(config)
    const templatePath = join(
      this.templatesPath,
      'ci-cd',
      validatedConfig.platform === 'github' ? 'github-actions.yml' : 'gitlab-ci.yml',
    )

    const templateContent = await readFile(templatePath, 'utf-8')

    const context = {
      ...validatedConfig,
      useNode: validatedConfig.runtime === 'nodejs',
      useBun: validatedConfig.runtime === 'bun',
      usePython: validatedConfig.runtime === 'python',
      nodeVersion: validatedConfig.runtime === 'nodejs' ? validatedConfig.version : undefined,
      pythonVersion: validatedConfig.runtime === 'python' ? validatedConfig.version : undefined,
      testImage: this.getTestImage(validatedConfig.runtime, validatedConfig.version),
      REGISTRY: validatedConfig.registry || 'docker.io',
      IMAGE_NAME: validatedConfig.imageName || '${{ github.repository }}',
    }

    return ejs.render(templateContent, context, this.ejsOptions)
  }

  private getTestImage(runtime: string, version: string): string {
    switch (runtime) {
      case 'nodejs':
        return `node:${version}-alpine`
      case 'python':
        return `python:${version}-slim`
      case 'bun':
        return `oven/bun:${version}-alpine`
      default:
        return 'alpine:latest'
    }
  }

  // Preset configurations for common stacks
  @Trace('templates.getNodeJSPreset')
  getNodeJSPreset(framework?: 'express' | 'nestjs' | 'fastify'): Partial<DockerfileConfig> {
    const base = {
      runtime: 'nodejs' as const,
      version: '20',
      port: 3000,
      packageManager: 'npm' as const,
      healthCheck: true,
      healthCheckPath: '/health',
    }

    switch (framework) {
      case 'nestjs':
        return {
          ...base,
          hasBuildStep: true,
          buildCommand: 'npm run build',
          buildOutput: 'dist',
          startCommand: 'node dist/main.js',
        }
      case 'express':
        return {
          ...base,
          startCommand: 'node index.js',
        }
      case 'fastify':
        return {
          ...base,
          startCommand: 'node server.js',
        }
      default:
        return base
    }
  }

  @Trace('templates.getPythonPreset')
  getPythonPreset(framework?: 'django' | 'flask' | 'fastapi'): Partial<DockerfileConfig> {
    const base = {
      runtime: 'python' as const,
      version: '3.11',
      port: 8000,
      healthCheck: true,
      healthCheckPath: '/health',
    }

    switch (framework) {
      case 'django':
        return {
          ...base,
          startCommand: 'gunicorn myproject.wsgi:application --bind 0.0.0.0:8000',
        }
      case 'flask':
        return {
          ...base,
          port: 5000,
          startCommand: 'gunicorn app:app --bind 0.0.0.0:5000',
        }
      case 'fastapi':
        return {
          ...base,
          startCommand: 'uvicorn main:app --host 0.0.0.0 --port 8000',
        }
      default:
        return base
    }
  }

  @Trace('templates.getBunPreset')
  getBunPreset(): Partial<DockerfileConfig> {
    return {
      runtime: 'bun',
      version: '1.1',
      port: 3000,
      hasBuildStep: true,
      buildCommand: 'bun run build',
      buildOutput: 'dist',
      startCommand: 'bun run start:prod',
      healthCheck: true,
      healthCheckPath: '/health',
    }
  }
}
