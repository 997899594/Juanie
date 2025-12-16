import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../database'
import { Logger } from '../../logger'
import { DATABASE } from '../../tokens'

@Injectable()
export class RepositoryWorker implements OnModuleInit {
  private worker!: Worker

  constructor(
    private readonly config: ConfigService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(RepositoryWorker.name)
  }

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.worker = new Worker(
      'repository',
      async (job: Job) => {
        this.logger.info(`Processing ${job.name} (${job.id})`)
        try {
          switch (job.name) {
            case 'create-repository':
              await this.handleCreateRepository(job)
              break
            case 'delete-repository':
              await this.handleDeleteRepository(job)
              break
            case 'archive-repository':
              await this.handleArchiveRepository(job)
              break
            default:
              this.logger.warn(`Unknown job: ${job.name}`)
          }
        } catch (error) {
          this.logger.error(`Job ${job.id} failed:`, error)
          throw error
        }
      },
      {
        connection: { url: redisUrl, maxRetriesPerRequest: null },
        concurrency: 5,
        limiter: { max: 10, duration: 1000 },
      },
    )

    this.worker.on('completed', (job) => this.logger.info(`Job ${job.id} completed`))
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed:`, err))
    this.logger.info('Repository Worker initialized')
  }

  private async handleCreateRepository(job: Job) {
    const {
      provider,
      name,
      visibility,
      accessToken,
      projectId,
      userId: _userId,
      pushInitialCode,
    } = job.data

    try {
      await job.updateProgress(10)
      await job.log(`开始创建 ${provider} 仓库: ${name}`)
      this.logger.info(`Creating repository: ${name} on ${provider}`)

      const result = await this.callAPI(provider, 'create', { name, visibility, accessToken })

      await job.updateProgress(40)
      await job.log(`仓库创建成功: ${result.fullName}`)
      this.logger.info(`Repository ${name} created on ${provider}`)

      if (result.success && projectId) {
        // 创建数据库记录
        const [repository] = await this.db
          .insert(schema.repositories)
          .values({
            projectId,
            provider,
            fullName: result.fullName,
            cloneUrl: result.cloneUrl,
            defaultBranch: result.defaultBranch || 'main',
            syncStatus: 'success',
            lastSyncAt: new Date(),
          })
          .returning()

        await job.updateProgress(60)
        await job.log('数据库记录已创建')
        this.logger.info(`Database record created for repository ${repository?.id}`)

        // 如果需要推送初始代码
        if (pushInitialCode && repository) {
          await job.log('准备推送初始代码...')
          this.logger.info(`Pushing initial code to ${result.fullName}`)

          try {
            await this.pushInitialCode(
              provider,
              accessToken,
              result.fullName,
              result.defaultBranch || 'main',
            )
            await job.updateProgress(80)
            await job.log('初始代码推送完成')
            this.logger.info(`Initial code pushed to ${result.fullName}`)
          } catch (error) {
            // 推送失败不应该导致整个流程失败（非致命错误）
            this.logger.error(`Failed to push initial code (non-fatal):`, error)
            await job.log(
              `初始代码推送失败: ${error instanceof Error ? error.message : '未知错误'}`,
            )
            // 继续执行，不抛出错误
          }
        }

        // 更新项目状态为 active
        // 注意：GitOps 资源创建需要 K3s 连接，这里只标记仓库部分完成
        await this.db
          .update(schema.projects)
          .set({
            status: 'active',
            initializationStatus: {
              step: 'completed',
              progress: 100,
              completedSteps: [
                'create_project',
                'load_template',
                'create_environments',
                'setup_repository',
              ],
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, projectId))

        await job.log('项目初始化完成')
        this.logger.info(`Project ${projectId} initialization completed`)
      }

      await job.updateProgress(100)
      await job.log('仓库创建流程完成')
      this.logger.info(`Repository ${name} created successfully`)

      return result
    } catch (error) {
      this.logger.error(`Failed to create repository ${name}:`, error)
      await job.log(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`)

      // 更新项目状态为失败
      if (projectId) {
        await this.db
          .update(schema.projects)
          .set({
            status: 'failed',
            initializationStatus: {
              step: 'failed',
              progress: 0,
              error: error instanceof Error ? error.message : '仓库创建失败',
              completedSteps: ['create_project', 'load_template', 'create_environments'],
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, projectId))
      }

      throw error
    }
  }

  private async handleDeleteRepository(job: Job) {
    const { provider, fullName, accessToken, repositoryId } = job.data

    try {
      await job.updateProgress(10)
      await job.log(`开始删除仓库: ${fullName}`)
      this.logger.info(`Deleting repository: ${fullName} from ${provider}`)

      await this.callAPI(provider, 'delete', { fullName, accessToken })

      await job.updateProgress(50)
      await job.log(`仓库已从 ${provider} 删除`)
      this.logger.info(`Repository ${fullName} deleted from ${provider}`)

      if (repositoryId) {
        await this.db.delete(schema.repositories).where(eq(schema.repositories.id, repositoryId))
        await job.log('数据库记录已删除')
        this.logger.info(`Database record deleted for repository ${repositoryId}`)
      }

      await job.updateProgress(100)
      await job.log('删除完成')
      this.logger.info(`Repository ${fullName} deleted successfully`)
    } catch (error) {
      this.logger.error(`Failed to delete repository ${fullName}:`, error)
      await job.log(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  private async handleArchiveRepository(job: Job) {
    const { provider, fullName, accessToken, repositoryId } = job.data

    try {
      await job.updateProgress(10)
      await job.log(`开始归档仓库: ${fullName}`)
      this.logger.info(`Archiving repository: ${fullName} on ${provider}`)

      await this.callAPI(provider, 'archive', { fullName, accessToken })

      await job.updateProgress(50)
      await job.log(`仓库已在 ${provider} 归档`)
      this.logger.info(`Repository ${fullName} archived on ${provider}`)

      if (repositoryId) {
        await this.db
          .update(schema.repositories)
          .set({ syncStatus: 'archived', updatedAt: new Date() })
          .where(eq(schema.repositories.id, repositoryId))
        await job.log('数据库状态已更新')
        this.logger.info(`Database record updated for repository ${repositoryId}`)
      }

      await job.updateProgress(100)
      await job.log('归档完成')
      this.logger.info(`Repository ${fullName} archived successfully`)
    } catch (error) {
      this.logger.error(`Failed to archive repository ${fullName}:`, error)
      await job.log(`归档失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  /**
   * 推送初始代码到仓库
   */
  private async pushInitialCode(
    provider: 'github' | 'gitlab',
    accessToken: string,
    fullName: string,
    branch: string,
  ): Promise<void> {
    const files = [
      {
        path: '.gitignore',
        content: `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`,
      },
      {
        path: 'README.md',
        content: `# Project

This repository was created by AI DevOps Platform.

## Getting Started

Add your application code here.

## Deployment

This project is configured for GitOps deployment with Flux.
`,
      },
      {
        path: 'k8s/base/kustomization.yaml',
        content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
`,
      },
      {
        path: 'k8s/base/deployment.yaml',
        content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app
  template:
    metadata:
      labels:
        app: app
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
`,
      },
      {
        path: 'k8s/base/service.yaml',
        content: `apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: app
  ports:
  - port: 80
    targetPort: 80
`,
      },
    ]

    if (provider === 'github') {
      await this.pushToGitHub(accessToken, fullName, files, branch)
    } else {
      await this.pushToGitLab(accessToken, fullName, files, branch)
    }
  }

  /**
   * 推送文件到 GitHub
   */
  private async pushToGitHub(
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
  ): Promise<void> {
    for (const file of files) {
      const url = `https://api.github.com/repos/${fullName}/contents/${file.path}`

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({
          message: `Add ${file.path}`,
          content: Buffer.from(file.content).toString('base64'),
          branch,
        }),
      })

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as any
        throw new Error(`Failed to push ${file.path}: ${error.message || response.statusText}`)
      }
    }
  }

  /**
   * 推送文件到 GitLab
   */
  private async pushToGitLab(
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
  ): Promise<void> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const projectPath = encodeURIComponent(fullName)

    const actions = files.map((file) => ({
      action: 'create',
      file_path: file.path,
      content: file.content,
    }))

    const url = `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${projectPath}/repository/commits`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        branch,
        commit_message: 'Initial commit: Add project files',
        actions,
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to push files to GitLab: ${JSON.stringify(error)}`)
    }
  }

  private async callAPI(provider: string, action: string, data: any): Promise<any> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const baseUrl = provider === 'github' ? 'https://api.github.com' : gitlabUrl

    if (action === 'create') {
      const { name, visibility, accessToken } = data
      const url = provider === 'github' ? `${baseUrl}/user/repos` : `${baseUrl}/api/v4/projects`
      const body =
        provider === 'github'
          ? { name, private: visibility === 'private', auto_init: true }
          : { name, visibility, initialize_with_readme: true }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(provider === 'github' && {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          }),
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error(`${provider} API error: ${response.status}`)

      const repo = (await response.json()) as any
      return {
        success: true,
        fullName: provider === 'github' ? repo.full_name : repo.path_with_namespace,
        cloneUrl: provider === 'github' ? repo.clone_url : repo.http_url_to_repo,
        defaultBranch: repo.default_branch,
      }
    }

    if (action === 'delete') {
      const { fullName, accessToken } = data
      const url =
        provider === 'github'
          ? `${baseUrl}/repos/${fullName}`
          : `${baseUrl}/api/v4/projects/${encodeURIComponent(fullName)}`

      this.logger.info(`Calling ${provider} API to delete: ${url}`)

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(provider === 'github' && {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          }),
        },
      })

      if (!response.ok && response.status !== 404) {
        let errorMessage = `${provider} API error: ${response.status}`
        try {
          const errorBody = (await response.json()) as any
          errorMessage += ` - ${errorBody.message || JSON.stringify(errorBody)}`
        } catch {
          // 无法解析错误响应
        }
        this.logger.error(`Delete API call failed: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      if (response.status === 404) {
        this.logger.warn(`Repository ${fullName} not found (404), considering as deleted`)
      } else {
        this.logger.info(`Repository ${fullName} deleted successfully (${response.status})`)
      }

      return { success: true }
    }

    if (action === 'archive') {
      const { fullName, accessToken } = data
      const url =
        provider === 'github'
          ? `${baseUrl}/repos/${fullName}`
          : `${baseUrl}/api/v4/projects/${encodeURIComponent(fullName)}`

      this.logger.info(`Calling ${provider} API to archive: ${url}`)

      const response = await fetch(url, {
        method: provider === 'github' ? 'PATCH' : 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(provider === 'github' && {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          }),
        },
        body: JSON.stringify({ archived: true }),
      })

      if (!response.ok) {
        let errorMessage = `${provider} API error: ${response.status}`
        try {
          const errorBody = (await response.json()) as any
          errorMessage += ` - ${errorBody.message || JSON.stringify(errorBody)}`
        } catch {
          // 无法解析错误响应
        }
        this.logger.error(`Archive API call failed: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      this.logger.info(`Repository ${fullName} archived successfully (${response.status})`)
      return { success: true }
    }

    throw new Error(`Unknown action: ${action}`)
  }
}
