import { computed, ref } from 'vue'
import type {
  ConfigChange,
  ConfigChangePreview,
  DeploymentConfig,
  FluxHealth,
  FluxResourceKind,
  GitOpsResource,
  ResourceRequirements,
  SyncResult,
  YAMLValidationResult,
} from '@juanie/types'
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
  const resources = ref<GitOpsResource[]>([])
  const fluxHealth = ref<FluxHealth | null>(null)

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
    type: string
    name: string
    namespace: string
    config: Record<string, unknown>
  }) {
    loading.value = true
    try {
      const result = await trpc.gitops.createGitOpsResource.mutate(data)
      toast.success('GitOps 资源已创建', `${result.name} 创建成功`)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('创建 GitOps 资源失败', message)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('获取 GitOps 资源失败', message)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('获取资源详情失败', message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新 GitOps 资源
   */
  async function updateGitOpsResource(
    resourceId: string,
    data: Partial<Omit<GitOpsResource, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    loading.value = true
    try {
      const result = await trpc.gitops.updateGitOpsResource.mutate({
        resourceId,
        ...data,
      })
      toast.success('GitOps 资源已更新')
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('更新 GitOps 资源失败', message)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('删除 GitOps 资源失败', message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 手动触发同步
   */
  async function triggerSync(data: { kind: FluxResourceKind; name: string; namespace: string }) {
    loading.value = true
    try {
      const result = await trpc.gitops.triggerSync.mutate(data)
      toast.success('同步已触发', result.message)
      return result as SyncResult
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('触发同步失败', message)
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
    changes: DeploymentConfig
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
          resources: data.changes.resources,
        },
        commitMessage: data.commitMessage,
      }
      const result = await trpc.gitops.deployWithGitOps.mutate(payload)
      toast.success('部署已提交', result.message)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('GitOps 部署失败', message)
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
    changes: ConfigChange[]
    commitMessage?: string
  }) {
    loading.value = true
    try {
      const result = await trpc.gitops.commitConfigChanges.mutate(data)
      toast.success('配置已提交', result.message)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('提交配置失败', message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 预览配置变更（不提交）
   */
  async function previewChanges(data: {
    projectId: string
    environmentId: string
    changes: ConfigChange[]
  }): Promise<ConfigChangePreview | undefined> {
    loading.value = true
    try {
      const result = await trpc.gitops.previewChanges.query(data)
      return result as ConfigChangePreview
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('预览变更失败', message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 验证 YAML 语法
   */
  async function validateYAML(content: string): Promise<YAMLValidationResult | undefined> {
    loading.value = true
    try {
      const result = await trpc.gitops.validateYAML.query({ content })
      return result as YAMLValidationResult
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('验证 YAML 失败', message)
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
