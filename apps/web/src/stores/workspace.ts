import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Workspace {
  id: string
  type: 'personal' | 'organization'
  name: string
  avatar?: string

  // 组织特有
  organizationId?: string
  role?: 'owner' | 'admin' | 'member'

  // Git 配置
  provider?: 'github' | 'gitlab'
  defaultAuthType?: 'oauth' | 'pat' | 'github_app' | 'gitlab_group_token'
}

export const useWorkspaceStore = defineStore('workspace', () => {
  // State
  const currentWorkspace = ref<Workspace | null>(null)
  const availableWorkspaces = ref<Workspace[]>([])
  const loading = ref(false)

  // Getters
  const isPersonal = computed(() => currentWorkspace.value?.type === 'personal')
  const isOrganization = computed(() => currentWorkspace.value?.type === 'organization')

  const workspaceContext = computed(() => {
    if (!currentWorkspace.value) return '未选择工作空间'

    if (isPersonal.value) {
      return '个人工作空间 - 使用你的个人账户'
    }

    return `${currentWorkspace.value.name} - 组织工作空间`
  })

  const recommendedAuthType = computed(() => {
    if (!currentWorkspace.value) return null

    // 个人工作空间推荐 OAuth
    if (isPersonal.value) {
      return {
        type: 'oauth' as const,
        label: 'OAuth 认证',
        reason: '简单便捷，一键授权，适合个人项目',
        icon: 'Shield',
      }
    }

    // 组织工作空间根据 provider 推荐
    const provider = currentWorkspace.value.provider || 'github'

    if (provider === 'github') {
      return {
        type: 'github_app' as const,
        label: 'GitHub App',
        reason: '组织级别权限控制，最佳安全性和审计能力',
        icon: 'Github',
      }
    }

    return {
      type: 'gitlab_group_token' as const,
      label: 'GitLab Group Token',
      reason: '组级别管理，支持多项目共享',
      icon: 'GitlabIcon',
    }
  })

  const personalWorkspace = computed(() =>
    availableWorkspaces.value.find((w) => w.type === 'personal'),
  )

  const organizationWorkspaces = computed(() =>
    availableWorkspaces.value.filter((w) => w.type === 'organization'),
  )

  // Actions
  async function loadWorkspaces() {
    loading.value = true
    try {
      // TODO: 实现 API 调用
      // const workspaces = await trpc.workspaces.list.query()

      // 模拟数据
      availableWorkspaces.value = [
        {
          id: 'personal',
          type: 'personal',
          name: '我的工作空间',
          provider: 'github',
        },
        // 组织工作空间会从 API 加载
      ]

      // 从本地存储恢复上次选择的工作空间
      const lastWorkspaceId = localStorage.getItem('lastWorkspace')
      if (lastWorkspaceId) {
        const workspace = availableWorkspaces.value.find((w) => w.id === lastWorkspaceId)
        if (workspace) {
          currentWorkspace.value = workspace
          return
        }
      }

      // 默认选择个人工作空间
      currentWorkspace.value = personalWorkspace.value || availableWorkspaces.value[0]
    } finally {
      loading.value = false
    }
  }

  async function switchWorkspace(workspaceId: string) {
    const workspace = availableWorkspaces.value.find((w) => w.id === workspaceId)
    if (!workspace) {
      throw new Error('Workspace not found')
    }

    currentWorkspace.value = workspace

    // 保存到本地存储
    localStorage.setItem('lastWorkspace', workspaceId)

    // 触发相关数据刷新
    // TODO: 刷新项目列表等
  }

  async function createOrganization(_data: { name: string; provider: 'github' | 'gitlab' }) {
    // TODO: 实现创建组织
    // const org = await trpc.organizations.create.mutate(data)
    // 添加到可用工作空间
    // availableWorkspaces.value.push({
    //   id: org.id,
    //   type: 'organization',
    //   name: org.name,
    //   organizationId: org.id,
    //   provider: data.provider,
    //   role: 'owner'
    // })
    // 自动切换到新组织
    // await switchWorkspace(org.id)
  }

  return {
    // State
    currentWorkspace,
    availableWorkspaces,
    loading,

    // Getters
    isPersonal,
    isOrganization,
    workspaceContext,
    recommendedAuthType,
    personalWorkspace,
    organizationWorkspaces,

    // Actions
    loadWorkspaces,
    switchWorkspace,
    createOrganization,
  }
})
