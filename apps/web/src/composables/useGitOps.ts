import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

/**
 * GitOps 管理 Composable
 * 提供 GitOps 资源管理、Flux 管理和双向部署功能
 */
export function useGitOps() {
  const toast = useToast()

  // 状态
  const loading = ref(false)
  const resources = ref<any[]>([])
  const fluxHealth = ref<any>(null)

  // ============================================
  // ============================================
  // GitOps 资源管理
  // ============================================

  /**
   * 创建 GitOps 资源
   */
  async function createGitOpsResource(data: {
    projectId: string
    environmentId: string
    repositoryId: string
    type: 'kustomization' | 'helm'
    name: string
    namespace: string
    config: any
  }) {
    loading.value = true
    try {
      const result = await trpc.gitops.createGitOpsResource.mutate(data)
      toast.success('GitOps 资源已创建', `${result.name} 创建成功`)
      return result
    } catch (error: any) {
      toast.error('创建 GitOps 资源失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取项目的 GitOps 资源列表
   */
  async function listGitOpsResources(projectId: string) {
    loading.value = true
    try {
      const result = await trpc.gitops.listGitOpsResources.query({ projectId })
      resources.value = result
      return result
    } catch (error: any) {
      toast.error('获取 GitOps 资源失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取单个 GitOps 资源详情
   */
  async function getGitOpsResource(resourceId: string) {
    loading.value = true
    try {
      const result = await trpc.gitops.getGitOpsResource.query({ id: resourceId })
      return result
    } catch (error: any) {
      toast.error('获取资源详情失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新 GitOps 资源
   */
  async function updateGitOpsResource(resourceId: string, data: any) {
    loading.value = true
    try {
      const result = await trpc.gitops.updateGitOpsResource.mutate({
        resourceId,
        ...data,
      })
      toast.success('GitOps 资源已更新')
      return result
    } catch (error: any) {
      toast.error('更新 GitOps 资源失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除 GitOps 资源
   */
  async function deleteGitOpsResource(resourceId: string) {
    loading.value = true
    try {
      await trpc.gitops.deleteGitOpsResource.mutate({ id: resourceId })
      toast.success('GitOps 资源已删除')
      // 从列表中移除
      resources.value = resources.value.filter((r) => r.id !== resourceId)
    } catch (error: any) {
      toast.error('删除 GitOps 资源失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 手动触发同步
   */
  async function triggerSync(data: {
    kind: 'GitRepository' | 'Kustomization' | 'HelmRelease'
    name: string
    namespace: string
  }) {
    loading.value = true
    try {
      const result = await trpc.gitops.triggerSync.mutate(data)
      toast.success('同步已触发', result.message)
      return result
    } catch (error: any) {
      toast.error('触发同步失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // 双向部署（核心功能）
  // ============================================

  /**
   * 通过 GitOps 部署（UI → Git → Flux → K8s）
   */
  async function deployWithGitOps(data: {
    projectId: string
    environmentId: string
    changes: {
      image?: string
      replicas?: number
      env?: Record<string, string>
      resources?: {
        requests?: { cpu?: string; memory?: string }
        limits?: { cpu?: string; memory?: string }
      }
    }
    commitMessage?: string
  }) {
    loading.value = true
    try {
      // 转换参数格式以匹配 router 期望的格式
      const payload = {
        projectId: data.projectId,
        environmentId: data.environmentId,
        config: {
          image: data.changes.image,
          replicas: data.changes.replicas,
          resources: data.changes.resources
            ? {
                cpu: data.changes.resources.requests?.cpu || data.changes.resources.limits?.cpu,
                memory:
                  data.changes.resources.requests?.memory || data.changes.resources.limits?.memory,
              }
            : undefined,
        },
        commitMessage: data.commitMessage,
      }
      const result = await trpc.gitops.deployWithGitOps.mutate(payload)
      toast.success('部署已提交', result.message)
      return result
    } catch (error: any) {
      toast.error('GitOps 部署失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 提交配置变更到 Git
   */
  async function commitConfigChanges(data: {
    projectId: string
    environmentId: string
    changes: any
    commitMessage?: string
  }) {
    loading.value = true
    try {
      const result = await trpc.gitops.commitConfigChanges.mutate(data)
      toast.success('配置已提交', result.message)
      return result
    } catch (error: any) {
      toast.error('提交配置失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 预览配置变更（不提交）
   */
  async function previewChanges(data: { projectId: string; environmentId: string; changes: any }) {
    loading.value = true
    try {
      const result = await trpc.gitops.previewChanges.query(data)
      return result
    } catch (error: any) {
      toast.error('预览变更失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 验证 YAML 语法
   */
  async function validateYAML(content: string) {
    loading.value = true
    try {
      const result = await trpc.gitops.validateYAML.query({ content })
      return result
    } catch (error: any) {
      toast.error('验证 YAML 失败', error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // 计算属性
  // ============================================

  const readyResources = computed(() => resources.value.filter((r) => r.status === 'ready'))

  const reconcilingResources = computed(() =>
    resources.value.filter((r) => r.status === 'reconciling'),
  )

  const failedResources = computed(() => resources.value.filter((r) => r.status === 'failed'))

  const isFluxHealthy = computed(() => fluxHealth.value?.overall === 'healthy')

  return {
    // 状态
    loading,
    resources,
    fluxHealth,

    // GitOps 资源管理
    createGitOpsResource,
    listGitOpsResources,
    getGitOpsResource,
    updateGitOpsResource,
    deleteGitOpsResource,
    triggerSync,

    // 双向部署
    deployWithGitOps,
    commitConfigChanges,
    previewChanges,
    validateYAML,

    // 计算属性
    readyResources,
    reconcilingResources,
    failedResources,
    isFluxHealthy,
  }
}
