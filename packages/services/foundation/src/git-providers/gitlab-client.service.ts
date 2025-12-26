import type { AccessLevel } from '@gitbeaker/core'
import { Gitlab } from '@gitbeaker/rest'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'

/**
 * GitLab Client Service
 * 封装 Gitbeaker SDK，提供类型安全的 GitLab API 调用
 */
@Injectable()
export class GitLabClientService {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitLabClientService.name)
  }

  /**
   * 创建 Gitlab 实例
   */
  createClient(accessToken: string): InstanceType<typeof Gitlab> {
    const host = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
    return new Gitlab({
      token: accessToken,
      host,
    })
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(accessToken: string) {
    const gitlab = this.createClient(accessToken)
    return await gitlab.Users.showCurrentUser()
  }

  /**
   * 创建项目
   */
  async createProject(
    accessToken: string,
    options: {
      name: string
      path?: string
      description?: string
      visibility?: 'private' | 'internal' | 'public'
      initialize_with_readme?: boolean
      default_branch?: string
    },
  ) {
    const gitlab = this.createClient(accessToken)
    return await gitlab.Projects.create(options)
  }

  /**
   * 获取项目信息
   */
  async getProject(accessToken: string, projectId: string | number) {
    const gitlab = this.createClient(accessToken)
    return await gitlab.Projects.show(projectId)
  }

  /**
   * 删除项目
   */
  async deleteProject(accessToken: string, projectId: string | number) {
    const gitlab = this.createClient(accessToken)
    await gitlab.Projects.remove(projectId)
  }

  /**
   * 添加项目成员
   */
  async addProjectMember(
    accessToken: string,
    projectId: string | number,
    userId: number,
    accessLevel: Exclude<AccessLevel, AccessLevel.ADMIN>,
  ) {
    const gitlab = this.createClient(accessToken)
    await gitlab.ProjectMembers.add(projectId, accessLevel, { userId })
  }

  /**
   * 移除项目成员
   */
  async removeProjectMember(accessToken: string, projectId: string | number, userId: number) {
    const gitlab = this.createClient(accessToken)
    await gitlab.ProjectMembers.remove(projectId, userId)
  }

  /**
   * 列出项目成员
   */
  async listProjectMembers(accessToken: string, projectId: string | number) {
    const gitlab = this.createClient(accessToken)
    return await gitlab.ProjectMembers.all(projectId)
  }

  /**
   * 更新项目成员权限
   */
  async updateProjectMember(
    accessToken: string,
    projectId: string | number,
    userId: number,
    accessLevel: Exclude<AccessLevel, AccessLevel.ADMIN>,
  ) {
    const gitlab = this.createClient(accessToken)
    await gitlab.ProjectMembers.edit(projectId, userId, accessLevel)
  }

  /**
   * 创建 CI/CD 变量
   */
  async createVariable(
    accessToken: string,
    projectId: string | number,
    options: {
      key: string
      value: string
      protected?: boolean
      masked?: boolean
      environmentScope?: string
    },
  ) {
    const gitlab = this.createClient(accessToken)
    await gitlab.ProjectVariables.create(projectId, options.key, options.value, {
      protected: options.protected,
      masked: options.masked,
      environmentScope: options.environmentScope,
    })
  }

  /**
   * 使用 Commits API 批量推送文件
   */
  async pushFilesBatch(
    accessToken: string,
    projectId: string | number,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
  ) {
    const gitlab = this.createClient(accessToken)

    const actions = files.map((file) => ({
      action: 'create' as const,
      filePath: file.path,
      content: file.content,
    }))

    await gitlab.Commits.create(projectId, branch, commitMessage, actions)

    this.logger.info(`✅ Pushed ${files.length} files to GitLab in a single commit`)
  }

  /**
   * 创建 Group
   */
  async createGroup(
    accessToken: string,
    options: {
      name: string
      path: string
      description?: string
      visibility?: 'private' | 'internal' | 'public'
    },
  ) {
    const gitlab = this.createClient(accessToken)
    return await gitlab.Groups.create(options.name, options.path, {
      description: options.description,
      visibility: options.visibility,
    })
  }

  /**
   * 添加 Group 成员
   */
  async addGroupMember(
    accessToken: string,
    groupId: string | number,
    userId: number,
    accessLevel: Exclude<AccessLevel, AccessLevel.ADMIN>,
  ) {
    const gitlab = this.createClient(accessToken)
    await gitlab.GroupMembers.add(groupId, accessLevel, { userId })
  }

  /**
   * 移除 Group 成员
   */
  async removeGroupMember(accessToken: string, groupId: string | number, userId: number) {
    const gitlab = this.createClient(accessToken)
    await gitlab.GroupMembers.remove(groupId, userId)
  }
}
