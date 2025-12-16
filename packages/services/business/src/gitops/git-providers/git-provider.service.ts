import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
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

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(GitProviderService.name)}

  /**
   * 清理仓库名称，使其符合 GitHub/GitLab 命名规范
   * 规则：
   * - 只能包含字母、数字、连字符和下划线
   * - 不能以连字符开头
   * - 最长 100 个字符
   */
  private sanitizeRepositoryName(name: string): string {
    // 移除所有非法字符，只保留字母、数字、连字符和下划线
    let sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-') // 将非法字符替换为连字符
      .replace(/^-+/, '') // 移除开头的连字符
      .replace(/-+/g, '-') // 合并多个连续的连字符
      .replace(/-+$/, '') // 移除结尾的连字符
      .substring(0, 100) // 限制长度

    // 如果清理后为空，使用默认名称
    if (!sanitized) {
      sanitized = `project-${Date.now()}`
    }

    return sanitized
  }

  /**
   * 创建 GitHub 仓库
   */
  async createGitHubRepository(
    accessToken: string,
    options: CreateRepositoryOptions,
  ): Promise<RepositoryInfo> {
    // 清理仓库名称
    const sanitizedName = this.sanitizeRepositoryName(options.name)

    if (sanitizedName !== options.name) {
      this.logger.warn(`Repository name sanitized: "${options.name}" -> "${sanitizedName}"`)
    }

    this.logger.info(`Creating GitHub repository: ${sanitizedName}`)

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        name: sanitizedName,
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
    // 清理仓库名称
    const sanitizedName = this.sanitizeRepositoryName(options.name)

    if (sanitizedName !== options.name) {
      this.logger.warn(`Repository name sanitized: "${options.name}" -> "${sanitizedName}"`)
    }

    this.logger.info(`Creating GitLab repository: ${sanitizedName}`)

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
        name: sanitizedName,
        description: options.description || '',
        visibility: options.visibility,
        initialize_with_readme: options.autoInit ?? true,
        default_branch: options.defaultBranch || 'main',
      }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('GitLab 访问令牌无效，请重新连接账户')
      }

      if (response.status === 403) {
        throw new Error('GitLab 令牌权限不足，需要 api 权限')
      }

      if (response.status === 400 || response.status === 422) {
        throw new Error(`仓库名称 "${options.name}" 已存在或不符合命名规范`)
      }

      if (response.status >= 500) {
        throw new Error(`GitLab 服务器错误，请稍后重试`)
      }

      throw new Error(`GitLab API 请求失败 (${response.status})`)
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
  async getGitHubUser(accessToken: string): Promise<{
    login: string
    id: number
    type: 'User' | 'Organization'
    name: string | null
    email: string | null
  }> {
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
    return {
      login: data.login,
      id: data.id,
      type: data.type || 'User',
      name: data.name,
      email: data.email,
    }
  }

  /**
   * 检查 GitHub 用户是否有创建 Organization 的权限
   * 个人账号无法通过 API 创建 Organization
   */
  async canCreateGitHubOrganization(accessToken: string): Promise<{
    canCreate: boolean
    reason?: string
    accountType: 'personal' | 'enterprise'
  }> {
    try {
      const user = await this.getGitHubUser(accessToken)

      // 检查用户类型
      if (user.type === 'Organization') {
        return {
          canCreate: false,
          reason: '当前令牌属于组织账号，无法创建新组织',
          accountType: 'enterprise',
        }
      }

      // 尝试获取用户的组织列表，判断是否有企业账号
      const orgsResponse = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-DevOps-Platform',
        },
      })

      if (orgsResponse.ok) {
        const orgs = (await orgsResponse.json()) as any[]

        // 如果用户已经是某些组织的 owner，可能有企业账号
        const ownedOrgs = orgs.filter((org) => org.role === 'admin')

        if (ownedOrgs.length > 0) {
          // 有管理的组织，可能是企业用户，但仍然无法通过 API 创建
          return {
            canCreate: false,
            reason: 'GitHub 个人账号无法通过 API 创建 Organization，请在 GitHub 网站手动创建',
            accountType: 'personal',
          }
        }
      }

      // 个人账号
      return {
        canCreate: false,
        reason: 'GitHub 个人账号无法通过 API 创建 Organization，请在 GitHub 网站手动创建',
        accountType: 'personal',
      }
    } catch (error) {
      this.logger.error('Failed to check GitHub organization creation permission:', error)
      return {
        canCreate: false,
        reason: '无法检查账号权限',
        accountType: 'personal',
      }
    }
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
   * 推送初始文件到仓库（使用批量提交）
   * 这是推荐的方法，使用 Git Tree API (GitHub) 或 Commits API (GitLab) 一次性提交所有文件
   */
  async pushFiles(
    provider: 'github' | 'gitlab',
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string = 'main',
    commitMessage: string = 'Initial commit: Add project files',
  ): Promise<void> {
    this.logger.info(`Pushing ${files.length} files to ${provider} repository: ${fullName}`)

    if (provider === 'github') {
      await this.pushToGitHubBatch(accessToken, fullName, files, branch, commitMessage)
    } else {
      await this.pushToGitLabBatch(accessToken, fullName, files, branch, commitMessage)
    }
  }

  /**
   * 使用 Git Tree API 批量推送文件到 GitHub（高效，一次提交）
   */
  private async pushToGitHubBatch(
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
    commitMessage: string,
  ): Promise<void> {
    const baseUrl = 'https://api.github.com'
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'AI-DevOps-Platform',
    }

    // 1. 获取当前分支的最新 commit
    const refResponse = await fetch(`${baseUrl}/repos/${fullName}/git/ref/heads/${branch}`, {
      headers,
    })
    if (!refResponse.ok) {
      throw new Error(`Failed to get branch ref: ${refResponse.statusText}`)
    }
    const refData = (await refResponse.json()) as any
    const latestCommitSha = refData.object.sha

    // 2. 获取最新 commit 的 tree
    const commitResponse = await fetch(
      `${baseUrl}/repos/${fullName}/git/commits/${latestCommitSha}`,
      { headers },
    )
    if (!commitResponse.ok) {
      throw new Error(`Failed to get commit: ${commitResponse.statusText}`)
    }
    const commitData = (await commitResponse.json()) as any
    const baseTreeSha = commitData.tree.sha

    // 3. 创建新的 tree（包含所有文件）
    const tree = files.map((file) => ({
      path: file.path,
      mode: '100644', // 普通文件
      type: 'blob',
      content: file.content,
    }))

    const treeResponse = await fetch(`${baseUrl}/repos/${fullName}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree,
      }),
    })

    if (!treeResponse.ok) {
      const error = (await treeResponse.json().catch(() => ({}))) as any
      throw new Error(`Failed to create tree: ${error.message || treeResponse.statusText}`)
    }
    const treeData = (await treeResponse.json()) as any

    // 4. 创建新的 commit
    const commitCreateResponse = await fetch(`${baseUrl}/repos/${fullName}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    })

    if (!commitCreateResponse.ok) {
      const error = (await commitCreateResponse.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to create commit: ${error.message || commitCreateResponse.statusText}`,
      )
    }
    const newCommitData = (await commitCreateResponse.json()) as any

    // 5. 更新分支引用
    const updateRefResponse = await fetch(`${baseUrl}/repos/${fullName}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: false,
      }),
    })

    if (!updateRefResponse.ok) {
      const error = (await updateRefResponse.json().catch(() => ({}))) as any
      throw new Error(`Failed to update ref: ${error.message || updateRefResponse.statusText}`)
    }

    this.logger.info(`✅ Successfully pushed ${files.length} files to GitHub in a single commit`)
  }

  /**
   * 使用 Commits API 批量推送文件到 GitLab（高效，一次提交）
   */
  private async pushToGitLabBatch(
    accessToken: string,
    fullName: string,
    files: Array<{ path: string; content: string }>,
    branch: string,
    commitMessage: string,
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
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PRIVATE-TOKEN': accessToken,
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        branch,
        commit_message: commitMessage,
        actions,
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to push files to GitLab: ${JSON.stringify(error)}`)
    }

    this.logger.info(`✅ Successfully pushed ${files.length} files to GitLab in a single commit`)
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
    this.logger.info(`Validating ${provider} repository: ${fullName}`)

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
    this.logger.info(`Creating ${provider} repository: ${options.name}`)

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

  /**
   * 创建仓库（带重试逻辑，用于处理 GitLab path 冲突）
   * 如果仓库名称冲突，会自动添加随机后缀重试
   */
  async createRepositoryWithRetry(
    provider: 'github' | 'gitlab',
    accessToken: string,
    options: CreateRepositoryOptions,
    maxRetries: number = 3,
  ): Promise<RepositoryInfo> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const baseUrl = provider === 'github' ? 'https://api.github.com' : gitlabUrl
    const url = provider === 'github' ? `${baseUrl}/user/repos` : `${baseUrl}/api/v4/projects`

    // 为 GitLab 生成安全的 path
    const basePath = options.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    let attempt = 0
    let lastError: any = null

    while (attempt < maxRetries) {
      const safePath =
        attempt === 0 ? basePath : `${basePath}-${Math.random().toString(36).slice(2, 8)}`

      const body =
        provider === 'github'
          ? {
              name: options.name,
              private: options.visibility === 'private',
              auto_init: options.autoInit ?? true,
              description: options.description || '',
            }
          : {
              name: options.name,
              path: safePath,
              visibility: options.visibility,
              description: options.description || '',
              initialize_with_readme: options.autoInit ?? true,
              default_branch: options.defaultBranch || 'main',
            }

      this.logger.info(`Creating ${provider} repository (attempt ${attempt + 1}):`, {
        url,
        name: options.name,
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider === 'github'
            ? {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'AI-DevOps-Platform',
              }
            : {
                Authorization: `Bearer ${accessToken}`,
                'PRIVATE-TOKEN': accessToken,
                'User-Agent': 'AI-DevOps-Platform',
              }),
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const repo = (await response.json()) as any
        return {
          id: repo.id,
          name: repo.name,
          fullName: provider === 'github' ? repo.full_name : repo.path_with_namespace,
          cloneUrl: provider === 'github' ? repo.clone_url : repo.http_url_to_repo,
          sshUrl: provider === 'github' ? repo.ssh_url : repo.ssh_url_to_repo,
          defaultBranch: repo.default_branch || options.defaultBranch || 'main',
          visibility:
            provider === 'github' ? (repo.private ? 'private' : 'public') : repo.visibility,
          htmlUrl: provider === 'github' ? repo.html_url : repo.web_url,
        }
      }

      const error = (await response.json().catch(() => ({}))) as any
      lastError = error

      // GitHub 422 错误特殊处理：可能仓库已创建但 auto_init 失败
      if (provider === 'github' && response.status === 422) {
        this.logger.warn(`GitHub returned 422, checking if repository exists...`)
        const exists = await this.checkRepositoryExists(
          provider,
          accessToken,
          `${error.repository?.owner?.login || 'user'}/${options.name}`,
        )
        if (exists) {
          // 获取已存在的仓库信息
          const repoResponse = await fetch(
            `${baseUrl}/repos/${error.repository?.owner?.login || 'user'}/${options.name}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'AI-DevOps-Platform',
              },
            },
          )
          if (repoResponse.ok) {
            const repo = (await repoResponse.json()) as any
            return {
              id: repo.id,
              name: repo.name,
              fullName: repo.full_name,
              cloneUrl: repo.clone_url,
              sshUrl: repo.ssh_url,
              defaultBranch: repo.default_branch || options.defaultBranch || 'main',
              visibility: repo.private ? 'private' : 'public',
              htmlUrl: repo.html_url,
            }
          }
        }
      }

      // 检查是否是 path/name 冲突错误
      const isConflictError =
        (typeof error.message === 'object' &&
          (error.message.path?.includes('taken') || error.message.name?.includes('taken'))) ||
        (typeof error.message === 'string' && error.message.includes('taken'))

      // 如果是冲突错误且是 GitLab，重试
      if (isConflictError && provider === 'gitlab' && attempt < maxRetries - 1) {
        this.logger.warn(`Path conflict detected, retrying with random suffix...`)
        attempt++
        continue
      }

      // 其他错误，直接抛出
      let errorMsg = ''
      if (typeof error.message === 'string') {
        errorMsg = error.message
      } else if (typeof error.message === 'object') {
        errorMsg = Object.entries(error.message)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('; ')
      } else if (error.error) {
        errorMsg = error.error_description || error.error
      } else {
        errorMsg = JSON.stringify(error)
      }

      throw new Error(`${provider} API error: ${response.status} - ${errorMsg}`)
    }

    throw new Error(
      `Failed to create repository after ${attempt} attempts: ${JSON.stringify(lastError)}`,
    )
  }

  /**
   * 归档仓库
   */
  async archiveRepository(
    provider: 'github' | 'gitlab',
    fullName: string,
    accessToken: string,
  ): Promise<void> {
    if (provider === 'github') {
      const url = `https://api.github.com/repos/${fullName}`
      await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({ archived: true }),
      })
    } else {
      const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
      const projectId = encodeURIComponent(fullName)
      const url = `${gitlabUrl}/api/v4/projects/${projectId}`
      await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      })
    }
  }

  /**
   * 删除仓库
   */
  async deleteRepository(
    provider: 'github' | 'gitlab',
    fullName: string,
    accessToken: string,
  ): Promise<void> {
    if (provider === 'github') {
      const url = `https://api.github.com/repos/${fullName}`
      await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-DevOps-Platform',
        },
      })
    } else {
      const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
      const projectId = encodeURIComponent(fullName)
      const url = `${gitlabUrl}/api/v4/projects/${projectId}`
      await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    }
  }

  /**
   * 获取用户有权限的仓库列表
   */
  async listUserRepositories(
    provider: 'github' | 'gitlab',
    accessToken: string,
  ): Promise<Array<{ id: string; name: string; fullName: string; url: string; private: boolean }>> {
    if (provider === 'github') {
      const url = 'https://api.github.com/user/repos?per_page=100&sort=updated'
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-DevOps-Platform',
        },
      })

      if (!response.ok) {
        throw new Error('获取 GitHub 仓库列表失败')
      }

      const repos = (await response.json()) as any[]
      return repos.map((repo: any) => ({
        id: String(repo.id),
        name: repo.name,
        fullName: repo.full_name,
        url: repo.clone_url,
        private: repo.private,
      }))
    } else {
      const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
      const url = `${gitlabUrl}/api/v4/projects?membership=true&per_page=100&order_by=updated_at`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('获取 GitLab 仓库列表失败')
      }

      const repos = (await response.json()) as any[]
      return repos.map((repo: any) => ({
        id: String(repo.id),
        name: repo.name,
        fullName: repo.path_with_namespace,
        url: repo.http_url_to_repo,
        private: repo.visibility === 'private',
      }))
    }
  }

  /**
   * 添加协作者到 GitHub 仓库
   * Requirements: 4.2, 4.7
   */
  async addGitHubCollaborator(
    accessToken: string,
    fullName: string,
    username: string,
    permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage' = 'push',
  ): Promise<void> {
    this.logger.info(`Adding collaborator ${username} to GitHub repository ${fullName}`)

    const response = await fetch(
      `https://api.github.com/repos/${fullName}/collaborators/${username}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({ permission }),
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to add GitHub collaborator: ${error.message || response.statusText}`)
    }

    this.logger.info(`Successfully added ${username} as collaborator with ${permission} permission`)
  }

  /**
   * 添加成员到 GitLab 项目
   * Requirements: 4.2, 4.7
   */
  async addGitLabMember(
    accessToken: string,
    projectId: string | number,
    userId: number,
    accessLevel: 10 | 20 | 30 | 40 | 50 = 30,
  ): Promise<void> {
    this.logger.info(`Adding member ${userId} to GitLab project ${projectId}`)

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const encodedProjectId = encodeURIComponent(projectId)

    const response = await fetch(
      `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${encodedProjectId}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({
          user_id: userId,
          access_level: accessLevel,
        }),
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to add GitLab member: ${error.message || response.statusText}`)
    }

    this.logger.info(`Successfully added user ${userId} as member with access level ${accessLevel}`)
  }

  /**
   * 移除 GitHub 协作者
   * Requirements: 4.8
   */
  async removeGitHubCollaborator(
    accessToken: string,
    fullName: string,
    username: string,
  ): Promise<void> {
    this.logger.info(`Removing collaborator ${username} from GitHub repository ${fullName}`)

    const response = await fetch(
      `https://api.github.com/repos/${fullName}/collaborators/${username}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-DevOps-Platform',
        },
      },
    )

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to remove GitHub collaborator: ${error.message || response.statusText}`,
      )
    }

    this.logger.info(`Successfully removed ${username} from repository`)
  }

  /**
   * 移除 GitLab 项目成员
   * Requirements: 4.8
   */
  async removeGitLabMember(
    accessToken: string,
    projectId: string | number,
    userId: number,
  ): Promise<void> {
    this.logger.info(`Removing member ${userId} from GitLab project ${projectId}`)

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const encodedProjectId = encodeURIComponent(projectId)

    const response = await fetch(
      `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${encodedProjectId}/members/${userId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'AI-DevOps-Platform',
        },
      },
    )

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to remove GitLab member: ${error.message || response.statusText}`)
    }

    this.logger.info(`Successfully removed user ${userId} from project`)
  }

  /**
   * 更新 GitHub 协作者权限
   * Requirements: 4.7
   */
  async updateGitHubCollaboratorPermission(
    accessToken: string,
    fullName: string,
    username: string,
    permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage',
  ): Promise<void> {
    this.logger.info(
      `Updating collaborator ${username} permission to ${permission} in GitHub repository ${fullName}`,
    )

    // GitHub 使用相同的 PUT 端点来添加和更新权限
    await this.addGitHubCollaborator(accessToken, fullName, username, permission)
  }

  /**
   * 更新 GitLab 项目成员权限
   * Requirements: 4.7
   */
  async updateGitLabMemberPermission(
    accessToken: string,
    projectId: string | number,
    userId: number,
    accessLevel: 10 | 20 | 30 | 40 | 50,
  ): Promise<void> {
    this.logger.info(
      `Updating member ${userId} access level to ${accessLevel} in GitLab project ${projectId}`,
    )

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const encodedProjectId = encodeURIComponent(projectId)

    const response = await fetch(
      `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${encodedProjectId}/members/${userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({
          access_level: accessLevel,
        }),
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to update GitLab member permission: ${error.message || response.statusText}`,
      )
    }

    this.logger.info(`Successfully updated user ${userId} access level to ${accessLevel}`)
  }

  /**
   * 列出 GitHub 仓库协作者
   * Requirements: 4.2
   */
  async listGitHubCollaborators(
    accessToken: string,
    fullName: string,
  ): Promise<
    Array<{
      username: string
      id: number
      permission: string
      role_name: string
    }>
  > {
    this.logger.info(`Listing collaborators for GitHub repository ${fullName}`)

    const response = await fetch(
      `https://api.github.com/repos/${fullName}/collaborators?affiliation=direct`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-DevOps-Platform',
        },
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to list GitHub collaborators: ${error.message || response.statusText}`,
      )
    }

    const collaborators = (await response.json()) as any[]

    return collaborators.map((collab) => ({
      username: collab.login,
      id: collab.id,
      permission: collab.permissions
        ? Object.keys(collab.permissions).find((key) => collab.permissions[key]) || 'read'
        : 'read',
      role_name: collab.role_name || 'direct_member',
    }))
  }

  /**
   * 列出 GitLab 项目成员
   * Requirements: 4.2
   */
  async listGitLabMembers(
    accessToken: string,
    projectId: string | number,
  ): Promise<
    Array<{
      username: string
      id: number
      access_level: number
      access_level_description: string
    }>
  > {
    this.logger.info(`Listing members for GitLab project ${projectId}`)

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const encodedProjectId = encodeURIComponent(projectId)

    const response = await fetch(
      `${gitlabUrl.replace(/\/+$/, '')}/api/v4/projects/${encodedProjectId}/members`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'AI-DevOps-Platform',
        },
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to list GitLab members: ${error.message || response.statusText}`)
    }

    const members = (await response.json()) as any[]

    const accessLevelMap: Record<number, string> = {
      10: 'Guest',
      20: 'Reporter',
      30: 'Developer',
      40: 'Maintainer',
      50: 'Owner',
    }

    return members.map((member) => ({
      username: member.username,
      id: member.id,
      access_level: member.access_level,
      access_level_description: accessLevelMap[member.access_level] || 'Unknown',
    }))
  }

  /**
   * 统一的添加协作者接口
   * Requirements: 4.2, 4.7
   */
  async addCollaborator(
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoIdentifier: string,
    userIdentifier: string | number,
    permission: string,
  ): Promise<void> {
    if (provider === 'github') {
      const githubPermission = permission as 'pull' | 'push' | 'admin' | 'maintain' | 'triage'
      await this.addGitHubCollaborator(
        accessToken,
        repoIdentifier,
        userIdentifier as string,
        githubPermission,
      )
    } else {
      // GitLab 使用数字访问级别
      const accessLevel = this.mapPermissionToGitLabAccessLevel(permission)
      await this.addGitLabMember(accessToken, repoIdentifier, userIdentifier as number, accessLevel)
    }
  }

  /**
   * 统一的移除协作者接口
   * Requirements: 4.8
   */
  async removeCollaborator(
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoIdentifier: string,
    userIdentifier: string | number,
  ): Promise<void> {
    if (provider === 'github') {
      await this.removeGitHubCollaborator(accessToken, repoIdentifier, userIdentifier as string)
    } else {
      await this.removeGitLabMember(accessToken, repoIdentifier, userIdentifier as number)
    }
  }

  /**
   * 统一的更新协作者权限接口
   * Requirements: 4.7
   */
  async updateCollaboratorPermission(
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoIdentifier: string,
    userIdentifier: string | number,
    permission: string,
  ): Promise<void> {
    if (provider === 'github') {
      const githubPermission = permission as 'pull' | 'push' | 'admin' | 'maintain' | 'triage'
      await this.updateGitHubCollaboratorPermission(
        accessToken,
        repoIdentifier,
        userIdentifier as string,
        githubPermission,
      )
    } else {
      const accessLevel = this.mapPermissionToGitLabAccessLevel(permission)
      await this.updateGitLabMemberPermission(
        accessToken,
        repoIdentifier,
        userIdentifier as number,
        accessLevel,
      )
    }
  }

  /**
   * 统一的列出协作者接口
   * Requirements: 4.2
   */
  async listCollaborators(
    provider: 'github' | 'gitlab',
    accessToken: string,
    repoIdentifier: string,
  ): Promise<
    Array<{
      username: string
      id: number
      permission: string
    }>
  > {
    if (provider === 'github') {
      const collaborators = await this.listGitHubCollaborators(accessToken, repoIdentifier)
      return collaborators.map((collab) => ({
        username: collab.username,
        id: collab.id,
        permission: collab.permission,
      }))
    } else {
      const members = await this.listGitLabMembers(accessToken, repoIdentifier)
      return members.map((member) => ({
        username: member.username,
        id: member.id,
        permission: member.access_level_description,
      }))
    }
  }

  /**
   * 将通用权限映射到 GitLab 访问级别
   * Requirements: 4.3, 4.4, 4.5, 4.6
   */
  private mapPermissionToGitLabAccessLevel(permission: string): 10 | 20 | 30 | 40 | 50 {
    const permissionMap: Record<string, 10 | 20 | 30 | 40 | 50> = {
      read: 20, // Reporter
      pull: 20, // Reporter
      triage: 20, // Reporter
      write: 30, // Developer
      push: 30, // Developer
      maintain: 40, // Maintainer
      admin: 50, // Owner
    }

    return permissionMap[permission.toLowerCase()] || 30 // 默认 Developer
  }

  // ============================================================================
  // 组织管理方法 (Organization Management)
  // Requirements: 2.1, 2.2, 4.1
  // ============================================================================

  /**
   * 创建 GitHub Organization
   * Requirements: 2.1
   *
   * 注意：创建 GitHub Organization 需要企业账号或特殊权限
   * 个人账号无法通过 API 创建 Organization
   */
  async createGitHubOrganization(
    accessToken: string,
    name: string,
    displayName?: string,
    _description?: string,
  ): Promise<{
    id: number
    login: string
    name: string
    url: string
    avatarUrl: string
  }> {
    this.logger.info(`Creating GitHub organization: ${name}`)

    const response = await fetch('https://api.github.com/admin/organizations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        login: name,
        profile_name: displayName || name,
        admin: 'admin', // 需要指定管理员用户名
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any

      // GitHub 个人账号无法创建 Organization
      if (response.status === 403) {
        throw new Error('GitHub 个人账号无法通过 API 创建 Organization，请在 GitHub 网站手动创建')
      }

      throw new Error(
        `Failed to create GitHub organization: ${error.message || response.statusText}`,
      )
    }

    const data = (await response.json()) as any

    return {
      id: data.id,
      login: data.login,
      name: data.name || data.login,
      url: data.html_url,
      avatarUrl: data.avatar_url,
    }
  }

  /**
   * 创建 GitLab Group
   * Requirements: 2.2
   */
  async createGitLabGroup(
    accessToken: string,
    name: string,
    path: string,
    description?: string,
    visibility: 'private' | 'internal' | 'public' = 'private',
  ): Promise<{
    id: number
    name: string
    path: string
    fullPath: string
    url: string
    avatarUrl: string | null
  }> {
    this.logger.info(`Creating GitLab group: ${name} (path: ${path})`)

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'

    const response = await fetch(`${gitlabUrl.replace(/\/+$/, '')}/api/v4/groups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({
        name,
        path,
        description: description || '',
        visibility,
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any

      if (response.status === 400 && error.message?.path) {
        throw new Error(`GitLab group path "${path}" 已存在或不符合命名规范`)
      }

      throw new Error(`Failed to create GitLab group: ${error.message || response.statusText}`)
    }

    const data = (await response.json()) as any

    return {
      id: data.id,
      name: data.name,
      path: data.path,
      fullPath: data.full_path,
      url: data.web_url,
      avatarUrl: data.avatar_url,
    }
  }

  /**
   * 添加成员到 GitHub Organization
   * Requirements: 4.1
   */
  async addGitHubOrgMember(
    accessToken: string,
    orgName: string,
    username: string,
    role: 'admin' | 'member' = 'member',
  ): Promise<void> {
    this.logger.info(`Adding member ${username} to GitHub organization ${orgName} with role ${role}`)

    // GitHub 需要先邀请用户，然后用户接受邀请
    const response = await fetch(`https://api.github.com/orgs/${orgName}/memberships/${username}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-DevOps-Platform',
      },
      body: JSON.stringify({ role }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to add GitHub organization member: ${error.message || response.statusText}`,
      )
    }

    this.logger.info(`Successfully added ${username} to organization ${orgName}`)
  }

  /**
   * 添加成员到 GitLab Group
   * Requirements: 4.1
   */
  async addGitLabGroupMember(
    accessToken: string,
    groupId: string | number,
    userId: number,
    accessLevel: 10 | 20 | 30 | 40 | 50 = 30,
  ): Promise<void> {
    this.logger.info(
      `Adding member ${userId} to GitLab group ${groupId} with access level ${accessLevel}`,
    )

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const encodedGroupId = encodeURIComponent(groupId)

    const response = await fetch(
      `${gitlabUrl.replace(/\/+$/, '')}/api/v4/groups/${encodedGroupId}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-DevOps-Platform',
        },
        body: JSON.stringify({
          user_id: userId,
          access_level: accessLevel,
        }),
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to add GitLab group member: ${error.message || response.statusText}`)
    }

    this.logger.info(`Successfully added user ${userId} to group ${groupId}`)
  }

  /**
   * 移除 GitHub Organization 成员
   * Requirements: 4.1
   */
  async removeGitHubOrgMember(
    accessToken: string,
    orgName: string,
    username: string,
  ): Promise<void> {
    this.logger.info(`Removing member ${username} from GitHub organization ${orgName}`)

    const response = await fetch(`https://api.github.com/orgs/${orgName}/memberships/${username}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-DevOps-Platform',
      },
    })

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to remove GitHub organization member: ${error.message || response.statusText}`,
      )
    }

    this.logger.info(`Successfully removed ${username} from organization ${orgName}`)
  }

  /**
   * 移除 GitLab Group 成员
   * Requirements: 4.1
   */
  async removeGitLabGroupMember(
    accessToken: string,
    groupId: string | number,
    userId: number,
  ): Promise<void> {
    this.logger.info(`Removing member ${userId} from GitLab group ${groupId}`)

    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    const encodedGroupId = encodeURIComponent(groupId)

    const response = await fetch(
      `${gitlabUrl.replace(/\/+$/, '')}/api/v4/groups/${encodedGroupId}/members/${userId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'AI-DevOps-Platform',
        },
      },
    )

    if (!response.ok && response.status !== 204) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(
        `Failed to remove GitLab group member: ${error.message || response.statusText}`,
      )
    }

    this.logger.info(`Successfully removed user ${userId} from group ${groupId}`)
  }

  /**
   * 统一的创建组织接口
   * Requirements: 2.1, 2.2
   */
  async createOrganization(
    provider: 'github' | 'gitlab',
    accessToken: string,
    name: string,
    options?: {
      displayName?: string
      description?: string
      visibility?: 'private' | 'internal' | 'public'
    },
  ): Promise<{
    id: number
    name: string
    path: string
    url: string
    avatarUrl: string | null
  }> {
    if (provider === 'github') {
      const result = await this.createGitHubOrganization(
        accessToken,
        name,
        options?.displayName,
        options?.description,
      )
      return {
        id: result.id,
        name: result.name,
        path: result.login,
        url: result.url,
        avatarUrl: result.avatarUrl,
      }
    } else {
      // GitLab 需要 path，使用 name 的小写版本
      const path = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const result = await this.createGitLabGroup(
        accessToken,
        name,
        path,
        options?.description,
        options?.visibility || 'private',
      )
      return {
        id: result.id,
        name: result.name,
        path: result.path,
        url: result.url,
        avatarUrl: result.avatarUrl,
      }
    }
  }

  /**
   * 统一的添加组织成员接口
   * Requirements: 4.1
   */
  async addOrgMember(
    provider: 'github' | 'gitlab',
    accessToken: string,
    orgIdentifier: string | number,
    userIdentifier: string | number,
    role: string,
  ): Promise<void> {
    if (provider === 'github') {
      const githubRole = role as 'admin' | 'member'
      await this.addGitHubOrgMember(
        accessToken,
        orgIdentifier as string,
        userIdentifier as string,
        githubRole,
      )
    } else {
      const accessLevel = this.mapOrgRoleToGitLabAccessLevel(role)
      await this.addGitLabGroupMember(
        accessToken,
        orgIdentifier,
        userIdentifier as number,
        accessLevel,
      )
    }
  }

  /**
   * 统一的移除组织成员接口
   * Requirements: 4.1
   */
  async removeOrgMember(
    provider: 'github' | 'gitlab',
    accessToken: string,
    orgIdentifier: string | number,
    userIdentifier: string | number,
  ): Promise<void> {
    if (provider === 'github') {
      await this.removeGitHubOrgMember(
        accessToken,
        orgIdentifier as string,
        userIdentifier as string,
      )
    } else {
      await this.removeGitLabGroupMember(accessToken, orgIdentifier, userIdentifier as number)
    }
  }

  /**
   * 将组织角色映射到 GitLab 访问级别
   * Requirements: 4.3
   */
  private mapOrgRoleToGitLabAccessLevel(role: string): 10 | 20 | 30 | 40 | 50 {
    const roleMap: Record<string, 10 | 20 | 30 | 40 | 50> = {
      owner: 50, // Owner
      admin: 40, // Maintainer
      maintainer: 40, // Maintainer
      member: 30, // Developer
      developer: 30, // Developer
      billing: 20, // Reporter
      guest: 10, // Guest
    }

    return roleMap[role.toLowerCase()] || 30 // 默认 Developer
  }
}
