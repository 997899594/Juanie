import type { NotificationStatus } from '@juanie/types'
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { isTRPCClientError, trpc } from '@/lib/trpc'

// 通知类型定义（从 API 返回）
interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  status: NotificationStatus
  priority: string
  metadata: Record<string, unknown> | null
  readAt: Date | null
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * 通知管理组合式函数
 * 提供通知的查询、标记已读和删除操作
 */
export function useNotifications() {
  const toast = useToast()

  // 状态
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const unreadCount = computed(() => {
    return notifications.value.filter((n) => n.status === 'unread').length
  })

  const hasNotifications = computed(() => notifications.value.length > 0)

  const hasUnread = computed(() => unreadCount.value > 0)

  /**
   * 获取通知列表
   * @param status 可选的状态筛选（'read' | 'unread'）
   */
  async function fetchNotifications(status?: NotificationStatus) {
    loading.value = true
    error.value = null

    try {
      const result = await trpc.notifications.list.query(status ? { status } : undefined)
      notifications.value = result as Notification[]
      return result
    } catch (err) {
      error.value = '获取通知列表失败'

      if (isTRPCClientError(err)) {
        toast.error('获取通知列表失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取未读通知数量
   */
  async function fetchUnreadCount() {
    try {
      const result = await trpc.notifications.getUnreadCount.query()
      return result.count
    } catch (err) {
      if (isTRPCClientError(err)) {
        toast.error('获取未读数量失败', err.message)
      }
      return 0
    }
  }

  /**
   * 标记通知为已读
   * @param notificationId 通知 ID
   */
  async function markAsRead(notificationId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.notifications.markAsRead.mutate({ id: notificationId })

      // 更新本地状态
      const notification = notifications.value.find((n) => n.id === notificationId)
      if (notification) {
        notification.status = 'read'
        notification.readAt = new Date()
      }

      toast.success('已标记为已读')
    } catch (err) {
      error.value = '标记已读失败'

      if (isTRPCClientError(err)) {
        toast.error('标记已读失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 标记所有通知为已读
   */
  async function markAllAsRead() {
    loading.value = true
    error.value = null

    try {
      await trpc.notifications.markAllAsRead.mutate()

      // 更新本地状态
      notifications.value.forEach((notification) => {
        if (notification.status === 'unread') {
          notification.status = 'read'
          notification.readAt = new Date()
        }
      })

      toast.success('全部标记为已读')
    } catch (err) {
      error.value = '标记全部已读失败'

      if (isTRPCClientError(err)) {
        toast.error('标记全部已读失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除通知
   * @param notificationId 通知 ID
   */
  async function deleteNotification(notificationId: string) {
    loading.value = true
    error.value = null

    try {
      await trpc.notifications.delete.mutate({ id: notificationId })

      // 更新本地列表
      notifications.value = notifications.value.filter((n) => n.id !== notificationId)

      toast.success('通知已删除')
    } catch (err) {
      error.value = '删除通知失败'

      if (isTRPCClientError(err)) {
        toast.error('删除通知失败', err.message)
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    // 状态
    notifications,
    loading,
    error,

    // 计算属性
    unreadCount,
    hasNotifications,
    hasUnread,

    // 方法
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }
}
