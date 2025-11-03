import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

export interface SecurityPolicy {
  id: string
  organizationId: string
  name: string
  type: string
  status: 'active' | 'inactive'
  rules: Record<string, any>
  createdAt: string
  updatedAt: string
}

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
      toast.error('获取失败', error.value)
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

      const result = await trpc.securityPolicies.getById.query({ id })
      currentPolicy.value = result as SecurityPolicy

      return result
    } catch (err: any) {
      error.value = err.message || '获取安全策略详情失败'
      toast.error('获取失败', error.value)
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
    organizationId: string
    name: string
    type: string
    status?: 'active' | 'inactive'
    rules: Record<string, any>
  }) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.securityPolicies.create.mutate(data)

      policies.value.unshift(result as SecurityPolicy)
      toast.success('创建成功', `安全策略 "${data.name}" 已创建`)

      return result
    } catch (err: any) {
      error.value = err.message || '创建安全策略失败'
      toast.error('创建失败', error.value)
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
      type?: string
      status?: 'active' | 'inactive'
      rules?: Record<string, any>
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
      const index = policies.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        policies.value[index] = result as SecurityPolicy
      }

      // 更新当前策略
      if (currentPolicy.value?.id === id) {
        currentPolicy.value = result as SecurityPolicy
      }

      toast.success('更新成功', '安全策略已更新')

      return result
    } catch (err: any) {
      error.value = err.message || '更新安全策略失败'
      toast.error('更新失败', error.value)
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
      toast.error('删除失败', error.value)
      console.error('删除安全策略失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 切换策略状态
   */
  const togglePolicyStatus = async (id: string) => {
    const policy = policies.value.find((p) => p.id === id)
    if (!policy) return

    const newStatus = policy.status === 'active' ? 'inactive' : 'active'
    await updatePolicy(id, { status: newStatus })
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
