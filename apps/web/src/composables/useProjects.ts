import type { inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import type { AppRouter } from '@/lib/trpc'
import { isTRPCClientError, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
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
   * 创建项目
   */
  async function createProject(data: {
    organizationId: string
    name: string
    slug: string
    description?: string
    config?: {
      defaultBranch?: string
      enableCiCd?: boolean
      enableAi?: boolean
    }
  }) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.create.mutate(data)

      // 刷新项目列表
      await fetchProjects(data.organizationId)

      toast.success('创建成功', `项目 "${data.name}" 已创建`)
      return result
    } catch (err) {
      console.error('Failed to create project:', err)
      error.value = '创建项目失败'

      if (isTRPCClientError(err)) {
        toast.error('创建项目失败', err.message)
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
    data: {
      name?: string
      slug?: string
      description?: string
      config?: {
        defaultBranch?: string
        enableCiCd?: boolean
        enableAi?: boolean
      }
    },
  ) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.projects.update.mutate({
        projectId,
        ...data,
      })

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

  /**
   * 删除项目
   */
  async function deleteProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.projects.delete.mutate({ projectId })

      // 更新本地列表
      projects.value = projects.value.filter((p) => p.id !== projectId)

      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }

      toast.success('删除成功', '项目已删除')
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
  }
}
