import type { inferRouterOutputs } from '@trpc/server'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { type AppRouter, trpc } from '@/lib/trpc'

type RouterOutput = inferRouterOutputs<AppRouter>
export type SecurityPolicy = NonNullable<RouterOutput['securityPolicies']['get']>

export function useSecurityPolicies() {
  const toast = useToast()

  const policies = ref<SecurityPolicy[]>([])
  const currentPolicy = ref<SecurityPolicy | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasPolicies = computed(() => policies.value.length > 0)
  const activePolicies = computed(() => policies.value.filter((p) => p.status === 'active'))

  /**
   * 获取安全策略列表
   */
  const fetchPolicies = async (organizationId?: string) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.securityPolicies.list.query({
        organizationId,
      })

      policies.value = result as SecurityPolicy[]
    } catch (err: any) {
      error.value = err.message || '获取安全策略失败'
      toast.error('获取失败', error.value || undefined)
      console.error('获取安全策略失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取单个安全策略
   */
  const fetchPolicy = async (id: string) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.securityPolicies.get.query({ id })
      currentPolicy.value = result

      return result
    } catch (err: any) {
      error.value = err.message || '获取安全策略详情失败'
      toast.error('获取失败', error.value || undefined)
      console.error('获取安全策略详情失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建安全策略
   */
  const createPolicy = async (data: {
    organizationId?: string
    projectId?: string
    name: string
    type: 'access-control' | 'network' | 'data-protection' | 'compliance'
    rules: {
      conditions: Array<{ field: string; operator: string; value: any }>
      actions: Array<{ type: 'block' | 'warn' | 'log'; message: string }>
    }
    isEnforced?: boolean
  }) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.securityPolicies.create.mutate(data)

      if (result) {
        policies.value.unshift(result)
      }
      toast.success('创建成功', `安全策略 "${data.name}" 已创建`)

      return result
    } catch (err: any) {
      error.value = err.message || '创建安全策略失败'
      toast.error('创建失败', error.value || undefined)
      console.error('创建安全策略失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新安全策略
   */
  const updatePolicy = async (
    id: string,
    data: {
      name?: string
      rules?: {
        conditions: Array<{ field: string; operator: string; value: any }>
        actions: Array<{ type: 'block' | 'warn' | 'log'; message: string }>
      }
      isEnforced?: boolean
    },
  ) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.securityPolicies.update.mutate({
        id,
        ...data,
      })

      // 更新列表中的策略
      if (result) {
        const index = policies.value.findIndex((p) => p.id === id)
        if (index !== -1) {
          policies.value[index] = result
        }

        // 更新当前策略
        if (currentPolicy.value?.id === id) {
          currentPolicy.value = result
        }
      }

      toast.success('更新成功', '安全策略已更新')

      return result
    } catch (err: any) {
      error.value = err.message || '更新安全策略失败'
      toast.error('更新失败', error.value || undefined)
      console.error('更新安全策略失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除安全策略
   */
  const deletePolicy = async (id: string) => {
    try {
      loading.value = true
      error.value = null

      await trpc.securityPolicies.delete.mutate({ id })

      // 从列表中移除
      policies.value = policies.value.filter((p) => p.id !== id)

      // 清除当前策略
      if (currentPolicy.value?.id === id) {
        currentPolicy.value = null
      }

      toast.success('删除成功', '安全策略已删除')
    } catch (err: any) {
      error.value = err.message || '删除安全策略失败'
      toast.error('删除失败', error.value || undefined)
      console.error('删除安全策略失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 切换策略状态
   * TODO: API 暂不支持更新 status 字段
   */
  const togglePolicyStatus = async (id: string) => {
    toast.error('功能暂未实现', 'API 暂不支持更新策略状态')
    // const policy = policies.value.find((p) => p.id === id)
    // if (!policy) return
    // const newStatus = policy.status === 'active' ? 'inactive' : 'active'
    // await updatePolicy(id, { status: newStatus })
  }

  return {
    // 状态
    policies,
    currentPolicy,
    loading,
    error,

    // 计算属性
    hasPolicies,
    activePolicies,

    // 方法
    fetchPolicies,
    fetchPolicy,
    createPolicy,
    updatePolicy,
    deletePolicy,
    togglePolicyStatus,
  }
}
