import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

export interface CostRecord {
  id: string
  organizationId: string
  projectId?: string
  date: string
  costs: {
    compute: number
    storage: number
    network: number
    database: number
    other?: number
    total: number
  }
  currency: string
  createdAt: string
}

export interface CostSummary {
  totalCompute: number
  totalStorage: number
  totalNetwork: number
  totalDatabase: number
  grandTotal: number
  currency: string
  recordCount: number
}

export interface CostAlert {
  type: string
  severity: 'low' | 'medium' | 'high'
  message: string
  currentCost: number
  budget: number
}

export interface CostFilters {
  organizationId: string
  projectId?: string
  startDate?: string
  endDate?: string
}

export function useCostTracking() {
  const toast = useToast()

  const costs = ref<CostRecord[]>([])
  const summary = ref<CostSummary | null>(null)
  const alerts = ref<CostAlert[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const hasCosts = computed(() => costs.value.length > 0)
  const hasAlerts = computed(() => alerts.value.length > 0)

  /**
   * 获取成本记录列表
   */
  const fetchCosts = async (filters: CostFilters) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.costTracking.list.query(filters)
      costs.value = result as CostRecord[]
    } catch (err: any) {
      const errorMessage = err.message || '获取成本记录失败'
      error.value = errorMessage
      toast.error('获取失败', errorMessage)
      console.error('获取成本记录失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取成本汇总
   */
  const fetchSummary = async (filters: CostFilters) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.costTracking.getSummary.query(filters)
      summary.value = result as CostSummary
    } catch (err: any) {
      const errorMessage = err.message || '获取成本汇总失败'
      error.value = errorMessage
      toast.error('获取失败', errorMessage)
      console.error('获取成本汇总失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 检查成本告警
   */
  const fetchAlerts = async (organizationId: string) => {
    try {
      const result = await trpc.costTracking.checkAlerts.query({ organizationId })
      alerts.value = result as CostAlert[]
    } catch (err: any) {
      console.error('获取成本告警失败:', err)
    }
  }

  /**
   * 刷新所有数据
   */
  const refreshAll = async (filters: CostFilters) => {
    await Promise.all([
      fetchCosts(filters),
      fetchSummary(filters),
      fetchAlerts(filters.organizationId),
    ])
  }

  return {
    // 状态
    costs,
    summary,
    alerts,
    loading,
    error,

    // 计算属性
    hasCosts,
    hasAlerts,

    // 方法
    fetchCosts,
    fetchSummary,
    fetchAlerts,
    refreshAll,
  }
}
