import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface CreateRepositoryOptions {
  name: string
  description?: string
  visibility: 'public' | 'private'
  defaultBranch?: string
  autoInit?: boolean
  gitignoreTemplate?: string
  licenseTemplate?: string
}

export interface RepositoryInfo {
  id: string | number
  name: string
  fullName: string
  cloneUrl: string
  sshUrl: string
  defaultBranch: string
  visibility: 'public' | 'private'
  htmlUrl: string
}

/**
 * Git Provider Service
 * 统一处理 GitHub 和 GitLab 的 API 调用
 */
@Injectable()
export class GitProviderService {
  private readonly logger = new Logger(GitProviderService.name)

  constructor(private readonly config: ConfigService) {}

  /**
   * 创建 GitHub 仓库
   */
  async createGitHubRepository(
    accessToken: string,
    options: CreateRepositoryOptions,
  ): Promise<RepositoryInfo> {
    this.logger.log(`Creating GitHub repository: ${options.name}`)

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        name: options.name,
        description: options.description || '',
        private: options.visibility === 'private',
        auto_init: options.autoInit ?? true,
        gitignore_template: options.gitignoreTemplate,
        license_template: options.licenseTemplate,
      }),
    })

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}))
      const message = error.message || error.errors?.[0]?.message || response.statusText

      if (response.status === 401) {
        throw new Error('GitHub 访问令牌无效，请重新连接账户')
      }

      if (response.status === 403) {
        throw new Error('GitHub 令牌权限不足，需要 repo 权限')
      }

      throw new Error(`GitHub API 错误: ${message}`)
    }

    const data = (await response.json()) as any

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      defaultBranch: data.default_branch || options.defaultBranch || 'main',
      visibility: data.private ? 'private' : 'public',
      htmlUrl: data.html_url,
    }
  }

  /**
   * 创建 GitLab 仓库（项目）
   */
  async createGitLabRepository(
    accessToken: string,
    options: CreateRepositoryOptions,
  ): Promise<RepositoryInfo> {
    this.logger.log(`Creating GitLab repository: ${options.name}`)

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const apiUrl = `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        name: options.name,
        description: options.description || '',
        visibility: options.visibility,
        initialize_with_readme: options.autoInit ?? true,
        default_branch: options.defaultBranch || 'main',
      }),
    })

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}))
      const message = error.message || error.error || response.statusText

      if (response.status === 401) {
        throw new Error('GitLab 访问令牌无效，请重新连接账户')
      }

      if (response.status === 403) {
        throw new Error('GitLab 令牌权限不足，需要 api 权限')
      }

      if (response.status === 422) {
        throw new Error(`仓库名称 "${options.name}" 已存在或不符合命名规范`)
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error('GitLab 服务暂时不可用，请稍后重试')
      }

      if (response.status >= 500) {
        throw new Error(`GitLab 服务器错误 (${response.status})，请稍后重试`)
      }

      throw new Error(`GitLab API 错误: ${message}`)
    }

    const data = (await response.json()) as any

    return {
      id: data.id,
      name: data.name,
      fullName: data.path_with_namespace,
      cloneUrl: data.http_url_to_repo,
      sshUrl: data.ssh_url_to_repo,
      defaultBranch: data.default_branch || options.defaultBranch || 'main',
      visibility: data.visibility as 'public' | 'private',
      htmlUrl: data.web_url,
    }
  }

  /**
   * 获取 GitHub 用户信息
   */
  async getGitHubUser(accessToken: string): Promise<{ login: string; id: number }> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-DevOps-Platform',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API 错误: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as any
    return { login: data.login, id: data.id }
  }

  /**
   * 获取 GitLab 用户信息
   */
  async getGitLabUser(accessToken: string): Promise<{ username: string; id: number }> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const apiUrl = `${gitlabUrl.replace(/\/+$/, '')}/api/v4/user`

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'AI-DevOps-Platform',
      },
    })

    if (!response.ok) {
      throw new Error(`GitLab API 错误: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as any
    return { username: data.username, id: data.id }
  }

  /**
   * 推送初始文件到仓库
   */
  async pushInitialFiles(
    provider: 'github' | 'gitlab',
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string = 'main',
  ): Promise<void> {
    this.logger.log(`Pushing initial files to ${provider} repository: ${fullName}`)

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
    // GitHub 使用 Contents API 创建/更新文件
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
        const error = await response.json().catch(() => ({}))
        this.logger.error(`Failed to push ${file.path} to GitHub:`, error)
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

    // GitLab 使用 Commits API 批量创建文件
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
      const error = await response.json().catch(() => ({}))
      throw new Error(`Failed to push files to GitLab: ${JSON.stringify(error)}`)
    }
  }

  /**
   * 检查仓库是否存在
   */
  async checkRepositoryExists(
    provider: 'github' | 'gitlab',
    accessToken: string,
    fullName: string,
  ): Promise<boolean> {
    try {
      if (provider === 'github') {
        const response = await fetch(`https://api.github.com/repos/${fullName}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          },
        })
        return response.ok
      } else {
        const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
        const projectPath = encodeURIComponent(fullName)
        const response = await fetch(
          `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${projectPath}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'AI-DevOps-Platform',
            },
          },
        )
        return response.ok
      }
    } catch {
      return false
    }
  }

  /**
   * 验证仓库是否可访问
   * Requirements: 4.1, 4.2, 4.3
   */
  async validateRepository(
    provider: 'github' | 'gitlab',
    accessToken: string,
    fullName: string,
  ): Promise<{ valid: boolean; error?: string }> {
    this.logger.log(`Validating ${provider} repository: ${fullName}`)

    try {
      if (provider === 'github') {
        const response = await fetch(`https://api.github.com/repos/${fullName}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          },
        })

        if (response.ok) {
          return { valid: true }
        }

        if (response.status === 404) {
          return { valid: false, error: '仓库不存在或无法访问' }
        }

        if (response.status === 401 || response.status === 403) {
          return { valid: false, error: '访问令牌无效或权限不足' }
        }

        const error = await response.json().catch(() => ({}))
        return {
          valid: false,
          error: `GitHub API 错误: ${response.status} - ${JSON.stringify(error)}`,
        }
      } else {
        const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
        const projectPath = encodeURIComponent(fullName)
        const response = await fetch(
          `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${projectPath}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'User-Agent': 'AI-DevOps-Platform',
            },
          },
        )

        if (response.ok) {
          return { valid: true }
        }

        if (response.status === 404) {
          return { valid: false, error: '仓库不存在或无法访问' }
        }

        if (response.status === 401 || response.status === 403) {
          return { valid: false, error: '访问令牌无效或权限不足' }
        }

        const error = await response.json().catch(() => ({}))
        return {
          valid: false,
          error: `GitLab API 错误: ${response.status} - ${JSON.stringify(error)}`,
        }
      }
    } catch (error) {
      this.logger.error(`Failed to validate repository ${fullName}:`, error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : '网络错误或服务不可用',
      }
    }
  }

  /**
   * 统一的仓库创建接口
   * Requirements: 4.1, 4.2, 4.3
   */
  async createRepository(
    provider: 'github' | 'gitlab',
    accessToken: string,
    options: CreateRepositoryOptions,
  ): Promise<RepositoryInfo> {
    this.logger.log(`Creating ${provider} repository: ${options.name}`)

    try {
      if (provider === 'github') {
        return await this.createGitHubRepository(accessToken, options)
      } else {
        return await this.createGitLabRepository(accessToken, options)
      }
    } catch (err) {
      this.logger.error(`Failed to create ${provider} repository:`, err)

      // 改进错误处理，提供更友好的错误信息
      if (err instanceof Error) {
        const message = err.message

        // 检查常见错误
        if (
          message.includes('422') ||
          message.includes('already exists') ||
          message.includes('已存在')
        ) {
          throw new Error(`仓库名称 "${options.name}" 已存在，请使用其他名称`)
        }

        if (message.includes('401') || message.includes('403') || message.includes('令牌')) {
          throw new Error('访问令牌无效或权限不足，请重新连接账户')
        }

        if (message.includes('404')) {
          throw new Error('API 端点不存在，请检查配置')
        }

        if (
          message.includes('502') ||
          message.includes('503') ||
          message.includes('504') ||
          message.includes('Bad Gateway') ||
          message.includes('不可用')
        ) {
          throw new Error(
            `${provider === 'github' ? 'GitHub' : 'GitLab'} 服务暂时不可用，请稍后重试`,
          )
        }

        if (message.includes('500') || message.includes('服务器错误')) {
          throw new Error(`${provider === 'github' ? 'GitHub' : 'GitLab'} 服务器错误，请稍后重试`)
        }

        // 返回原始错误
        throw err
      }

      throw new Error(`创建仓库失败: ${err}`)
    }
  }
}
