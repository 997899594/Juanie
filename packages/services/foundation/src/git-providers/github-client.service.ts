import { Injectable } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import { PinoLogger } from 'nestjs-pino'

/**
 * GitHub Client Service
 * 封装 Octokit SDK，提供类型安全的 GitHub API 调用
 */
@Injectable()
export class GitHubClientService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GitHubClientService.name)
  }

  /**
   * 创建 Octokit 实例
   */
  createClient(accessToken: string): Octokit {
    return new Octokit({
      auth: accessToken,
      userAgent: 'AI-DevOps-Platform',
    })
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(accessToken: string) {
    const octokit = this.createClient(accessToken)
    const { data } = await octokit.users.getAuthenticated()
    return data
  }

  /**
   * 创建仓库
   */
  async createRepository(
    accessToken: string,
    options: {
      name: string
      description?: string
      private?: boolean
      auto_init?: boolean
      gitignore_template?: string
      license_template?: string
    },
  ) {
    const octokit = this.createClient(accessToken)
    const { data } = await octokit.repos.createForAuthenticatedUser(options)
    return data
  }

  /**
   * 获取仓库信息
   */
  async getRepository(accessToken: string, owner: string, repo: string) {
    const octokit = this.createClient(accessToken)
    const { data } = await octokit.repos.get({ owner, repo })
    return data
  }

  /**
   * 删除仓库
   */
  async deleteRepository(accessToken: string, owner: string, repo: string) {
    const octokit = this.createClient(accessToken)
    await octokit.repos.delete({ owner, repo })
  }

  /**
   * 添加协作者
   */
  async addCollaborator(
    accessToken: string,
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage' = 'push',
  ) {
    const octokit = this.createClient(accessToken)
    await octokit.repos.addCollaborator({ owner, repo, username, permission })
  }

  /**
   * 移除协作者
   */
  async removeCollaborator(accessToken: string, owner: string, repo: string, username: string) {
    const octokit = this.createClient(accessToken)
    await octokit.repos.removeCollaborator({ owner, repo, username })
  }

  /**
   * 列出协作者
   */
  async listCollaborators(accessToken: string, owner: string, repo: string) {
    const octokit = this.createClient(accessToken)
    const { data } = await octokit.repos.listCollaborators({
      owner,
      repo,
      affiliation: 'direct',
    })
    return data
  }

  /**
   * 创建 Secret
   */
  async createSecret(
    accessToken: string,
    owner: string,
    repo: string,
    secretName: string,
    encryptedValue: string,
    keyId: string,
  ) {
    const octokit = this.createClient(accessToken)
    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_id: keyId,
    })
  }

  /**
   * 获取公钥（用于加密 Secret）
   */
  async getPublicKey(accessToken: string, owner: string, repo: string) {
    const octokit = this.createClient(accessToken)
    const { data } = await octokit.actions.getRepoPublicKey({ owner, repo })
    return data
  }

  /**
   * 创建或更新仓库变量
   */
  async createOrUpdateVariable(
    accessToken: string,
    owner: string,
    repo: string,
    variableName: string,
    value: string,
  ) {
    const octokit = this.createClient(accessToken)
    try {
      // 尝试更新
      await octokit.actions.updateRepoVariable({
        owner,
        repo,
        name: variableName,
        value,
      })
    } catch (error: any) {
      // 如果不存在，创建
      if (error.status === 404) {
        await octokit.actions.createRepoVariable({
          owner,
          repo,
          name: variableName,
          value,
        })
      } else {
        throw error
      }
    }
  }

  /**
   * 触发 Workflow
   */
  async triggerWorkflow(
    accessToken: string,
    owner: string,
    repo: string,
    workflowId: string,
    ref: string,
    inputs?: Record<string, string>,
  ) {
    const octokit = this.createClient(accessToken)
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
      inputs,
    })
  }

  /**
   * 使用 Git Tree API 批量推送文件
   */
  async pushFilesBatch(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
  ) {
    const octokit = this.createClient(accessToken)

    // 1. 获取当前分支的最新 commit
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    })
    const latestCommitSha = ref.object.sha

    // 2. 获取最新 commit 的 tree
    const { data: commit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    })
    const baseTreeSha = commit.tree.sha

    // 3. 创建新的 tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: files.map((file) => ({
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        content: file.content,
      })),
    })

    // 4. 创建新的 commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: tree.sha,
      parents: [latestCommitSha],
    })

    // 5. 更新分支引用
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
      force: false,
    })

    this.logger.info(`✅ Pushed ${files.length} files to GitHub in a single commit`)
  }

  // ==================== 组织成员管理 ====================

  /**
   * 添加成员到组织
   */
  async addOrgMember(
    accessToken: string,
    org: string,
    username: string,
    role: 'admin' | 'member' = 'member',
  ) {
    const octokit = this.createClient(accessToken)
    await octokit.orgs.setMembershipForUser({
      org,
      username,
      role,
    })
  }

  /**
   * 从组织移除成员
   */
  async removeOrgMember(accessToken: string, org: string, username: string) {
    const octokit = this.createClient(accessToken)
    await octokit.orgs.removeMembershipForUser({
      org,
      username,
    })
  }

  // ==================== 用户仓库列表 ====================

  /**
   * 列出用户的仓库
   */
  async listUserRepositories(accessToken: string, username?: string) {
    const octokit = this.createClient(accessToken)

    if (username) {
      // 列出指定用户的公开仓库
      const { data } = await octokit.repos.listForUser({
        username,
        per_page: 100,
      })
      return data
    } else {
      // 列出当前认证用户的所有仓库（包括私有）
      const { data } = await octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        affiliation: 'owner,collaborator,organization_member',
      })
      return data
    }
  }
}
