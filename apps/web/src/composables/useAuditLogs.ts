import { log } from '@juanie/ui'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { trpc } from '@/lib/trpc'

export interface AuditLog {
  id: string
  organizationId: string
  userId: string
  userName?: string
  action: string
  resourceType: string
  resourceId: string
  metadata: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface AuditLogFilters {
  organizationId?: string
  userId?: string
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
}

export function useAuditLogs() {
  const toast = useToast()

  const logs = ref<AuditLog[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // 计算属性
  const hasLogs = computed(() => logs.value.length > 0)

  /**
   * 获取审计日志列表
   */
  const fetchLogs = async (filters?: AuditLogFilters) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.auditLogs.list.query(filters || {})

      logs.value = result as AuditLog[]
      totalCount.value = logs.value.length
    } catch (err: any) {
      const errorMessage = err.message || '获取审计日志失败'
      error.value = errorMessage
      toast.error('获取失败', errorMessage)
      log.error('获取审计日志失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 搜索审计日志
   */
  const searchLogs = async (query: string, filters?: AuditLogFilters) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.auditLogs.search.query({
        organizationId: filters?.organizationId || '',
        query,
        filters: {
          action: filters?.action,
          userId: filters?.userId,
          resourceType: filters?.resourceType,
        },
      })

      logs.value = result as AuditLog[]
      totalCount.value = logs.value.length
    } catch (err: any) {
      const errorMessage = err.message || '搜索审计日志失败'
      error.value = errorMessage
      toast.error('搜索失败', errorMessage)
      log.error('搜索审计日志失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 导出审计日志
   */
  const exportLogs = async (format: 'csv' | 'json', filters?: AuditLogFilters) => {
    try {
      loading.value = true
      error.value = null

      const result = await trpc.auditLogs.export.query({
        organizationId: filters?.organizationId || '',
        format,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
      })

      // 创建下载链接
      const data = typeof result === 'string' ? result : JSON.stringify(result)
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-logs-${new Date().toISOString()}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('导出成功', `审计日志已导出为 ${format.toUpperCase()} 格式`)
    } catch (err: any) {
      const errorMessage = err.message || '导出审计日志失败'
      error.value = errorMessage
      toast.error('导出失败', errorMessage)
      log.error('导出审计日志失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 按时间范围筛选
   */
  const filterByDateRange = async (
    startDate: string,
    endDate: string,
    otherFilters?: Omit<AuditLogFilters, 'startDate' | 'endDate'>,
  ) => {
    await fetchLogs({
      startDate,
      endDate,
      ...otherFilters,
    })
  }

  /**
   * 按用户筛选
   */
  const filterByUser = async (userId: string, otherFilters?: Omit<AuditLogFilters, 'userId'>) => {
    await fetchLogs({
      userId,
      ...otherFilters,
    })
  }

  /**
   * 按操作类型筛选
   */
  const filterByAction = async (action: string, otherFilters?: Omit<AuditLogFilters, 'action'>) => {
    await fetchLogs({
      action,
      ...otherFilters,
    })
  }

  /**
   * 按资源类型筛选
   */
  const filterByResourceType = async (
    resourceType: string,
    otherFilters?: Omit<AuditLogFilters, 'resourceType'>,
  ) => {
    await fetchLogs({
      resourceType,
      ...otherFilters,
    })
  }

  /**
   * 清除筛选
   */
  const clearFilters = async (organizationId?: string) => {
    await fetchLogs(organizationId ? { organizationId } : undefined)
  }

  return {
    // 状态
    logs,
    loading,
    error,
    totalCount,

    // 计算属性
    hasLogs,

    // 方法
    fetchLogs,
    searchLogs,
    exportLogs,
    filterByDateRange,
    filterByUser,
    filterByAction,
    filterByResourceType,
    clearFilters,
  }
}
