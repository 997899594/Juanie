import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
type RouterInput = inferRouterInputs<AppRouter>
type Project = RouterOutput['projects']['list'][number]
type ProjectDetail = RouterOutput['projects']['get']
type ProjectMember = RouterOutput['projects']['listMembers'][number]
type ProjectTeam = RouterOutput['projects']['listTeams'][number]

/**
 * 项目管理组合式函数
 * 提供项目的 CRUD 操作、成员管理和团队管理
 */
export function useProjects() {
  const toast = useToast()

  // 状态
  const projects = ref<Project[]>([])
  const currentProject = ref<ProjectDetail | null>(null)
  const members = ref<ProjectMember[]>([])
  const teams = ref<ProjectTeam[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasProjects = computed(() => projects.value.length > 0)
  const currentProjectId = computed(() => currentProject.value?.id)

  /**
   * 获取组织的项目列表
   */
  async function fetchProjects(organizationId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.list.query({ organizationId })
      projects.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      error.value = '获取项目列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取项目列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目详情
   */
  async function fetchProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.get.query({ projectId })
      currentProject.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch project:', err)
      error.value = '获取项目详情失败'

      if (isTRPCClientError(err)) {
        toast.error('获取项目详情失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建项目（支持模板和仓库配置）
   * 返回项目信息和任务 ID（如果有异步任务）
   */
  async function createProject(
    data: RouterInput['projects']['create'] & {
      templateId?: string
      templateConfig?: Record<string, any>
      repository?:
        | {
            mode: 'existing'
            provider: 'github' | 'gitlab'
            url: string
            accessToken: string
            defaultBranch?: string
          }
        | {
            mode: 'create'
            provider: 'github' | 'gitlab'
            name: string
            visibility: 'public' | 'private'
            accessToken: string
            defaultBranch?: string
            includeAppCode?: boolean
          }
    },
  ): Promise<{ project: Project; jobIds?: string[] }> {
    loading.value = true
    error.value = null

    try {
      // 验证基本字段
      if (!data.name || !data.slug) {
        throw new Error('项目名称和标识不能为空')
      }

      // 验证仓库配置（如果提供）
      if (data.repository) {
        if (data.repository.mode === 'existing') {
          if (!data.repository.url) {
            throw new Error('请输入仓库 URL')
          }
        } else if (data.repository.mode === 'create') {
          if (!data.repository.name) {
            throw new Error('请输入仓库名称')
          }
        }

        // 确保有访问令牌
        if (!data.repository.accessToken) {
          throw new Error('请提供访问令牌或连接 OAuth 账户')
        }
      }

      // 统一使用 create 方法（现在支持模板和仓库配置）
      const result = await trpc.projects.create.mutate(data)

      // 刷新项目列表
      await fetchProjects(data.organizationId)

      // 根据是否配置了仓库显示不同的提示
      if (data.repository || data.templateId) {
        toast.success('创建成功', '项目正在初始化，请稍候...')
      } else {
        toast.success('创建成功', `项目 "${data.name}" 已创建`)
      }

      return { project: result, jobIds: [] }
    } catch (err) {
      console.error('Failed to create project:', err)
      error.value = '创建项目失败'

      // 提供友好的错误提示
      if (isTRPCClientError(err)) {
        const message = err.message

        // 重复/冲突错误
        if (
          message.includes('已存在') ||
          message.includes('duplicate') ||
          message.includes('unique')
        ) {
          toast.error('创建失败', message)
        }
        // OAuth 相关错误
        else if (
          message.includes('OAuth') ||
          message.includes('未找到') ||
          message.includes('连接')
        ) {
          toast.error(
            'OAuth 授权失败',
            '请前往"设置 > 账户连接"页面连接您的 GitHub/GitLab 账户，或手动输入访问令牌',
          )
        }
        // 仓库相关错误
        else if (message.includes('仓库') || message.includes('repository')) {
          toast.error('仓库操作失败', message)
        }
        // 权限错误
        else if (message.includes('权限')) {
          toast.error('权限不足', message)
        }
        // 其他错误
        else {
          toast.error('创建项目失败', message)
        }
      } else {
        toast.error('创建项目失败', '请稍后重试')
      }

      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新项目
   */
  async function updateProject(
    projectId: string,
    data: Omit<RouterInput['projects']['update'], 'projectId'> & { repositoryUrl?: string },
  ) {
    loading.value = true
    error.value = null

    try {
      const { repositoryUrl, ...updateInput } = data
      const result = await trpc.projects.update.mutate({
        projectId,
        ...updateInput,
      })

      // 如提供仓库URL，尝试连接仓库
      if (repositoryUrl) {
        await connectRepositoryIfNeeded(projectId, repositoryUrl)
      }

      // 更新本地数据
      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, ...result }
      }

      // 更新列表中的项目
      const projectIndex = projects.value.findIndex((p) => p.id === projectId)
      if (projectIndex !== -1 && projects.value[projectIndex]) {
        projects.value[projectIndex] = { ...projects.value[projectIndex], ...result }
      }

      toast.success('更新成功', '项目信息已更新')
      return result
    } catch (err) {
      console.error('Failed to update project:', err)
      error.value = '更新项目失败'

      if (isTRPCClientError(err)) {
        toast.error('更新项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  // 解析仓库URL，返回provider与fullName
  function parseRepositoryUrl(
    url: string,
  ): { provider: 'github' | 'gitlab'; fullName: string; cloneUrl: string } | null {
    const raw = url.trim()
    if (!raw) return null
    const match = raw
      .replace(/\.git$/i, '')
      .match(/(?:https?:\/\/|git@)?(github\.com|gitlab\.com)(?::|\/)([^?#]+?)(?:\/+)?(?:[?#].*)?$/i)
    if (!match) return null
    const host = match[1]
    const repoPath = match[2]?.replace(/\/+$/, '')
    if (!host || !repoPath || !repoPath.includes('/')) return null
    const provider = host.toLowerCase().includes('github') ? 'github' : 'gitlab'
    return { provider, fullName: repoPath, cloneUrl: raw }
  }

  // 若仓库未连接则连接
  async function connectRepositoryIfNeeded(projectId: string, repositoryUrl: string) {
    const parsed = parseRepositoryUrl(repositoryUrl)
    if (!parsed) {
      toast.error('仓库URL不合法', '无法解析仓库地址')
      return
    }
    const existing = await trpc.repositories.list.query({ projectId })
    const already = existing.some((r) => r.fullName === parsed.fullName)
    if (already) return
    await trpc.repositories.connect.mutate({
      projectId,
      provider: parsed.provider,
      fullName: parsed.fullName,
      cloneUrl: parsed.cloneUrl,
    })
  }

  /**
   * 删除项目
   * 返回任务 ID 列表供监听进度
   */
  async function deleteProject(
    projectId: string,
    options?: { repositoryAction?: 'keep' | 'archive' | 'delete' },
  ): Promise<string[]> {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.delete.mutate({
        projectId,
        repositoryAction: options?.repositoryAction || 'keep',
      })

      projects.value = projects.value.filter((p) => p.id !== projectId)

      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }

      const action = options?.repositoryAction || 'keep'
      if (action === 'keep') {
        toast.success('删除成功', '项目已删除')
      } else {
        toast.success(
          '删除成功',
          `项目已删除，正在${action === 'archive' ? '归档' : '删除'}仓库...`,
        )
      }

      return result.jobIds || []
    } catch (err) {
      console.error('Failed to delete project:', err)
      error.value = '删除项目失败'

      if (isTRPCClientError(err)) {
        toast.error('删除项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目成员列表
   */
  async function fetchMembers(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.listMembers.query({ projectId })
      members.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch members:', err)
      error.value = '获取成员列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取成员列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 添加项目成员
   */
  async function addMember(
    projectId: string,
    data: {
      memberId: string
      role: 'admin' | 'developer' | 'viewer'
    },
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.addMember.mutate({
        projectId,
        ...data,
      })

      // 刷新成员列表
      await fetchMembers(projectId)

      toast.success('添加成功', '成员已添加到项目')
      return result
    } catch (err) {
      console.error('Failed to add member:', err)
      error.value = '添加成员失败'

      if (isTRPCClientError(err)) {
        toast.error('添加成员失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新成员角色
   */
  async function updateMemberRole(
    projectId: string,
    memberId: string,
    role: 'admin' | 'developer' | 'viewer',
  ) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.updateMemberRole.mutate({
        projectId,
        memberId,
        role,
      })

      // 刷新成员列表以获取最新数据
      await fetchMembers(projectId)

      toast.success('更新成功', '成员角色已更新')
    } catch (err) {
      console.error('Failed to update member role:', err)
      error.value = '更新成员角色失败'

      if (isTRPCClientError(err)) {
        toast.error('更新成员角色失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 移除项目成员
   */
  async function removeMember(projectId: string, memberId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.removeMember.mutate({
        projectId,
        memberId,
      })

      // 更新本地成员列表
      members.value = members.value.filter((m) => m.id !== memberId)

      toast.success('移除成功', '成员已移除')
    } catch (err) {
      console.error('Failed to remove member:', err)
      error.value = '移除成员失败'

      if (isTRPCClientError(err)) {
        toast.error('移除成员失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目的团队列表
   */
  async function fetchTeams(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.listTeams.query({ projectId })
      teams.value = result
      return result
    } catch (err) {
      console.error('Failed to fetch teams:', err)
      error.value = '获取团队列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取团队列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 分配团队到项目
   */
  async function assignTeam(projectId: string, teamId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.assignTeam.mutate({
        projectId,
        teamId,
      })

      // 刷新团队列表
      await fetchTeams(projectId)

      toast.success('分配成功', '团队已分配到项目')
      return result
    } catch (err) {
      console.error('Failed to assign team:', err)
      error.value = '分配团队失败'

      if (isTRPCClientError(err)) {
        toast.error('分配团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 从项目移除团队
   */
  async function removeTeam(projectId: string, teamId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.removeTeam.mutate({
        projectId,
        teamId,
      })

      // 更新本地团队列表
      teams.value = teams.value.filter((t) => t.id !== teamId)

      toast.success('移除成功', '团队已移除')
    } catch (err) {
      console.error('Failed to remove team:', err)
      error.value = '移除团队失败'

      if (isTRPCClientError(err)) {
        toast.error('移除团队失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 上传项目 Logo
   */
  async function uploadLogo(projectId: string, file: string, contentType: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.uploadLogo.mutate({
        projectId,
        file,
        contentType,
      })

      // 更新本地项目数据
      if (currentProject.value?.id === projectId && result.project) {
        currentProject.value = { ...currentProject.value, ...result.project }
      }

      toast.success('上传成功', 'Logo 已更新')
      return result
    } catch (err) {
      console.error('Failed to upload logo:', err)
      error.value = '上传 Logo 失败'

      if (isTRPCClientError(err)) {
        toast.error('上传 Logo 失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除项目 Logo
   */
  async function deleteLogo(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.deleteLogo.mutate({ projectId })

      // 更新本地项目数据
      if (currentProject.value?.id === projectId && result.project) {
        currentProject.value = { ...currentProject.value, ...result.project }
      }

      toast.success('删除成功', 'Logo 已删除')
      return result
    } catch (err) {
      console.error('Failed to delete logo:', err)
      error.value = '删除 Logo 失败'

      if (isTRPCClientError(err)) {
        toast.error('删除 Logo 失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目完整状态
   */
  async function getStatus(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.getStatus.query({ projectId })
      return result
    } catch (err) {
      console.error('Failed to get project status:', err)
      error.value = '获取项目状态失败'

      if (isTRPCClientError(err)) {
        toast.error('获取项目状态失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目健康度
   */
  async function getHealth(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.getHealth.query({ projectId })
      return result
    } catch (err) {
      console.error('Failed to get project health:', err)
      error.value = '获取项目健康度失败'

      if (isTRPCClientError(err)) {
        toast.error('获取项目健康度失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 归档项目
   */
  async function archiveProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.archive.mutate({ projectId })

      // 更新本地项目数据
      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, status: 'archived' }
      }

      toast.success('归档成功', '项目已归档')
      return result
    } catch (err) {
      console.error('Failed to archive project:', err)
      error.value = '归档项目失败'

      if (isTRPCClientError(err)) {
        toast.error('归档项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 恢复项目
   */
  async function restoreProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.restore.mutate({ projectId })

      // 更新本地项目数据
      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, status: 'active' }
      }

      toast.success('恢复成功', '项目已恢复')
      return result
    } catch (err) {
      console.error('Failed to restore project:', err)
      error.value = '恢复项目失败'

      if (isTRPCClientError(err)) {
        toast.error('恢复项目失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    // 状态
    projects,
    currentProject,
    members,
    teams,
    loading,
    error,

    // 计算属性
    hasProjects,
    currentProjectId,

    // 方法 - 项目管理
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,

    // 方法 - 成员管理
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,

    // 方法 - 团队管理
    fetchTeams,
    assignTeam,
    removeTeam,

    // 方法 - Logo 管理
    uploadLogo,
    deleteLogo,

    // 方法 - 项目状态和健康度
    getStatus,
    getHealth,
    archiveProject,
    restoreProject,
  }
}
