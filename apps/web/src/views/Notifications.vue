<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300 } }"
    class="space-y-6"
  >
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">通知中心</h1>
        <p class="text-muted-foreground">
          查看和管理您的所有通知
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="hasUnread"
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="handleMarkAllAsRead"
        >
          <CheckCheck class="h-4 w-4 mr-2" />
          全部标记为已读
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="handleRefresh"
        >
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="flex items-center gap-2">
      <Select v-model="statusFilter" @update:model-value="handleFilterChange">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="筛选状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部通知</SelectItem>
          <SelectItem value="unread">未读</SelectItem>
          <SelectItem value="read">已读</SelectItem>
        </SelectContent>
      </Select>
      
      <Badge v-if="unreadCount > 0" variant="secondary">
        {{ unreadCount }} 条未读
      </Badge>
    </div>

    <!-- 通知列表 -->
    <div v-if="loading && notifications.length === 0" class="space-y-4">
      <Card v-for="i in 3" :key="i">
        <CardContent class="p-6">
          <div class="space-y-3">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-1/2" />
          </div>
        </CardContent>
      </Card>
    </div>

    <div v-else-if="hasNotifications" class="space-y-4">
      <Card
        v-for="(notification, index) in notifications"
        :key="notification.id"
        v-motion
        :initial="{ opacity: 0, x: -20 }"
        :enter="{
          opacity: 1,
          x: 0,
          transition: {
            delay: index * 50,
            duration: 300,
          },
        }"
        :class="[
          'transition-all hover:shadow-md',
          notification.status === 'unread' && 'border-l-4 border-l-primary',
        ]"
      >
        <CardContent class="p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <component
                  :is="getNotificationIcon(notification.type)"
                  :class="[
                    'h-5 w-5',
                    getNotificationIconColor(notification.type),
                  ]"
                />
                <h3 class="font-semibold">{{ notification.title }}</h3>
                <Badge
                  :variant="getNotificationTypeVariant(notification.type)"
                  class="ml-auto"
                >
                  {{ getNotificationTypeText(notification.type) }}
                </Badge>
                <Badge
                  v-if="notification.priority === 'high'"
                  variant="destructive"
                >
                  高优先级
                </Badge>
              </div>
              
              <p class="text-sm text-muted-foreground">
                {{ notification.content }}
              </p>
              
              <div class="flex items-center gap-4 text-xs text-muted-foreground">
                <span class="flex items-center gap-1">
                  <Clock class="h-3 w-3" />
                  {{ formatDate(notification.createdAt) }}
                </span>
                <span v-if="notification.readAt" class="flex items-center gap-1">
                  <CheckCheck class="h-3 w-3" />
                  已读于 {{ formatDate(notification.readAt) }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                v-if="notification.status === 'unread'"
                variant="ghost"
                size="sm"
                :disabled="loading"
                @click="handleMarkAsRead(notification.id)"
              >
                <Check class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :disabled="loading"
                @click="handleDelete(notification.id)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 空状态 -->
    <Card v-else>
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Bell class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无通知</h3>
        <p class="text-sm text-muted-foreground mb-4">
          {{ statusFilter === 'unread' ? '您已阅读所有通知' : '您还没有收到任何通知' }}
        </p>
        <Button
          v-if="statusFilter !== 'all'"
          variant="outline"
          @click="statusFilter = 'all'"
        >
          查看全部通知
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@juanie/ui'
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
  RefreshCw,
  Rocket,
  Shield,
  Trash2,
} from 'lucide-vue-next'
import { useNotifications } from '@/composables/useNotifications'

const {
  notifications,
  loading,
  unreadCount,
  hasNotifications,
  hasUnread,
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = useNotifications()

const statusFilter = ref<string>('all')

// 格式化日期
function formatDate(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 获取通知类型图标
function getNotificationIcon(type: string) {
  switch (type) {
    case 'deployment':
      return Rocket
    case 'security':
      return Shield
    case 'alert':
      return AlertCircle
    case 'info':
    default:
      return Info
  }
}

// 获取通知类型图标颜色
function getNotificationIconColor(type: string) {
  switch (type) {
    case 'deployment':
      return 'text-blue-500'
    case 'security':
      return 'text-yellow-500'
    case 'alert':
      return 'text-red-500'
    case 'info':
    default:
      return 'text-gray-500'
  }
}

// 获取通知类型的 Badge 变体
function getNotificationTypeVariant(type: string) {
  switch (type) {
    case 'deployment':
      return 'default'
    case 'security':
      return 'secondary'
    case 'alert':
      return 'destructive'
    case 'info':
    default:
      return 'outline'
  }
}

// 获取通知类型文本
function getNotificationTypeText(type: string) {
  switch (type) {
    case 'deployment':
      return '部署'
    case 'security':
      return '安全'
    case 'alert':
      return '告警'
    case 'info':
      return '信息'
    default:
      return type
  }
}

// 处理筛选变化
async function handleFilterChange() {
  const filter = statusFilter.value === 'all' ? undefined : statusFilter.value
  await fetchNotifications(filter)
}

// 处理标记为已读
async function handleMarkAsRead(notificationId: string) {
  try {
    await markAsRead(notificationId)
  } catch (err) {
    console.error('Failed to mark notification as read:', err)
  }
}

// 处理全部标记为已读
async function handleMarkAllAsRead() {
  try {
    await markAllAsRead()
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err)
  }
}

// 处理删除
async function handleDelete(notificationId: string) {
  try {
    await deleteNotification(notificationId)
  } catch (err) {
    console.error('Failed to delete notification:', err)
  }
}

// 处理刷新
async function handleRefresh() {
  const filter = statusFilter.value === 'all' ? undefined : statusFilter.value
  await fetchNotifications(filter)
}

// 初始化
onMounted(async () => {
  await fetchNotifications()
})
</script>
