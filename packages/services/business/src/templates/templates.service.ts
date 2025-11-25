import { Trace } from '@juanie/core/observability'
import { cicdConfigSchema, dockerfileConfigSchema } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { readFile } from 'fs/promises'
import Handlebars from 'handlebars'
import { join } from 'path'
import { z } from 'zod'

// 从 Zod schemas 推导类型
export type DockerfileConfig = z.infer<typeof dockerfileConfigSchema>
export type CICDConfig = z.infer<typeof cicdConfigSchema>

@Injectable()
export class TemplatesService {
  private templatesPath = join(__dirname, '../../templates')

  @Trace('templates.generateDockerfile')
  async generateDockerfile(config: DockerfileConfig): Promise<string> {
    const validatedConfig = dockerfileConfigSchema.parse(config)
    const templatePath = join(
      this.templatesPath,
      'dockerfiles',
      `${validatedConfig.runtime}.Dockerfile`,
    )

    const templateContent = await readFile(templatePath, 'utf-8')
    const template = Handlebars.compile(templateContent)

    const context = {
      ...validatedConfig,
      nodeVersion: validatedConfig.runtime === 'nodejs' ? validatedConfig.version : undefined,
      pythonVersion: validatedConfig.runtime === 'python' ? validatedConfig.version : undefined,
      bunVersion: validatedConfig.runtime === 'bun' ? validatedConfig.version : undefined,
      useYarn: validatedConfig.packageManager === 'yarn',
      usePnpm: validatedConfig.packageManager === 'pnpm',
    }

    return template(context)
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
    const template = Handlebars.compile(templateContent)

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

    return template(context)
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
