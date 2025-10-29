import { Injectable } from '@nestjs/common'
import { readFile } from 'fs/promises'
import Handlebars from 'handlebars'
import { join } from 'path'

export interface DockerfileConfig {
  runtime: 'nodejs' | 'python' | 'bun'
  version: string
  port: number
  packageManager?: 'npm' | 'yarn' | 'pnpm'
  hasBuildStep?: boolean
  buildCommand?: string
  buildOutput?: string
  startCommand: string
  healthCheck?: boolean
  healthCheckPath?: string
}

export interface CICDConfig {
  platform: 'github' | 'gitlab'
  runtime: 'nodejs' | 'python' | 'bun'
  version: string
  packageManager?: string
  installCommand: string
  hasLinter?: boolean
  lintCommand?: string
  hasTypeCheck?: boolean
  typeCheckCommand?: string
  hasTests?: boolean
  testCommand?: string
  hasCoverage?: boolean
  coverageFile?: string
  coverageRegex?: string
  testEnvVars?: Record<string, string>
  services?: string[]
  buildArgs?: Record<string, string>
  deployBranch: string
  environment: string
  environmentUrl: string
  deployScript: string
  manualDeploy?: boolean
  registry?: string
  imageName?: string
}

@Injectable()
export class TemplatesService {
  private templatesPath = join(__dirname, '../../templates')

  async generateDockerfile(config: DockerfileConfig): Promise<string> {
    const templatePath = join(this.templatesPath, 'dockerfiles', `${config.runtime}.Dockerfile`)

    const templateContent = await readFile(templatePath, 'utf-8')
    const template = Handlebars.compile(templateContent)

    const context = {
      ...config,
      nodeVersion: config.runtime === 'nodejs' ? config.version : undefined,
      pythonVersion: config.runtime === 'python' ? config.version : undefined,
      bunVersion: config.runtime === 'bun' ? config.version : undefined,
      useYarn: config.packageManager === 'yarn',
      usePnpm: config.packageManager === 'pnpm',
    }

    return template(context)
  }

  async generateCICD(config: CICDConfig): Promise<string> {
    const templatePath = join(
      this.templatesPath,
      'ci-cd',
      config.platform === 'github' ? 'github-actions.yml' : 'gitlab-ci.yml',
    )

    const templateContent = await readFile(templatePath, 'utf-8')
    const template = Handlebars.compile(templateContent)

    const context = {
      ...config,
      useNode: config.runtime === 'nodejs',
      useBun: config.runtime === 'bun',
      usePython: config.runtime === 'python',
      nodeVersion: config.runtime === 'nodejs' ? config.version : undefined,
      pythonVersion: config.runtime === 'python' ? config.version : undefined,
      testImage: this.getTestImage(config.runtime, config.version),
      REGISTRY: config.registry || 'docker.io',
      IMAGE_NAME: config.imageName || '${{ github.repository }}',
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
