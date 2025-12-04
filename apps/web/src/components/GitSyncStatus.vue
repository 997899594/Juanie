<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>Git 同步状态</CardTitle>
          <CardDescription>
            查看项目成员的 Git 权限同步状态
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          @click="handleManualSync"
          :disabled="syncing"
        >
          <Loader2 v-if="syncing" class="mr-2 h-4 w-4 animate-spin" />
          <RefreshCw v-else class="mr-2 h-4 w-4" />
          手动同步
        </Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- 同步统计 -->
      <div class="grid grid-cols-3 gap-4">
        <div class="rounded-lg border p-3">
          <p class="text-xs text-muted-foreground">成功</p>
          <p class="text-2xl font-bold text-green-600">{{ stats.success }}</p>
        </div>
        <div class="rounded-lg border p-3">
          <p class="text-xs text-muted-foreground">失败</p>
          <p class="text-2xl font-bold text-red-600">{{ stats.failed }}</p>
        </div>
        <div class="rounded-lg border p-3">
          <p class="text-xs text-muted-foreground">待处理</p>
          <p class="text-2xl font-bold text-yellow-600">{{ stats.pending }}</p>
        </div>
      </div>

      <!-- 同步日志列表 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium">最近同步记录</h4>
          <div class="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              @click="filterStatus = null"
              :class="{ 'bg-accent': filterStatus === null }"
            >
              全部
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="filterStatus = 'failed'"
              :class="{ 'bg-accent': filterStatus === 'failed' }"
            >
              失败
            </Button>
          </div>
        </div>

        <div v-if="loading" class="flex items-center justify-center py-8">
          <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="filteredLogs.length > 0" class="space-y-2">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <div
              class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              :class="{
                'bg-green-100': log.status === 'success',
                'bg-red-100': log.status === 'failed',
                'bg-yellow-100': log.status === 'pending',
              }"
            >
              <Check
                v-if="log.status === 'success'"
                class="h-4 w-4 text-green-600"
              />
              <X v-else-if="log.status === 'failed'" class="h-4 w-4 text-red-600" />
              <Loader2
                v-else
                class="h-4 w-4 animate-spin text-yellow-600"
              />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium">{{ getSyncActionLabel(log.action) }}</span>
                <Badge variant="outline" class="text-xs">
                  {{ log.provider }}
                </Badge>
                <Badge :variant="getSyncStatusVariant(log.status)" class="text-xs">
                  {{ getSyncStatusLabel(log.status) }}
                </Badge>
              </div>

              <p class="text-xs text-muted-foreground">
                {{ formatDate(log.createdAt) }}
              </p>

              <p v-if="log.error" class="mt-1 text-xs text-red-600">
                {{ log.error }}
              </p>

              <div v-if="log.status === 'failed'" class="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  @click="handleRetry(log.id)"
                  :disabled="retrying === log.id"
                >
                  <Loader2
                    v-if="retrying === log.id"
                    class="mr-2 h-4 w-4 animate-spin"
                  />
                  <RotateCw v-else class="mr-2 h-4 w-4" />
                  重试
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted"
          >
            <GitBranch class="h-6 w-6 text-muted-foreground" />
          </div>
          <p class="mt-2 text-sm text-muted-foreground">
            暂无同步记录
          </p>
        </div>
      </div>

      <!-- 加载更多 -->
      <Button
        v-if="hasMore"
        variant="outline"
        class="w-full"
        @click="loadMore"
        :disabled="loading"
      >
        <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
        加载更多
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import {
  Check,
  GitBranch,
  Loader2,
  RefreshCw,
  RotateCw,
  X,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

interface Props {
  projectId: string
}

const props = defineProps<Props>()
const toast = useToast()

const logs = ref<any[]>([])
const loading = ref(false)
const syncing = ref(false)
const retrying = ref<string | null>(null)
const filterStatus = ref<'pending' | 'success' | 'failed' | null>(null)
const limit = ref(20)
const hasMore = ref(false)

/**
 * 统计数据
 */
const stats = computed(() => {
  return {
    success: logs.value.filter((log) => log.status === 'success').length,
    failed: logs.value.filter((log) => log.status === 'failed').length,
    pending: logs.value.filter((log) => log.status === 'pending').length,
  }
})

/**
 * 过滤后的日志
 */
const filteredLogs = computed(() => {
  if (!filterStatus.value) return logs.value
  return logs.value.filter((log) => log.status === filterStatus.value)
})

/**
 * 加载同步日志
 */
async function loadLogs() {
  loading.value = true
  try {
    const result = await trpc.gitSync.getProjectSyncLogs.query({
      projectId: props.projectId,
      limit: limit.value,
      status: filterStatus.value || undefined,
    })

    logs.value = result.logs
    hasMore.value = result.logs.length >= limit.value
  } catch (error: any) {
    toast.error('加载失败', error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 手动触发同步
 */
async function handleManualSync() {
  syncing.value = true

  try {
    await trpc.gitSync.syncProjectMembers.mutate({
      projectId: props.projectId,
    })

    toast.success('同步已触发', '正在同步项目成员权限...')

    // 延迟后重新加载日志
    setTimeout(() => {
      loadLogs()
    }, 2000)
  } catch (error: any) {
    toast.error('同步失败', error.message)
  } finally {
    syncing.value = false
  }
}

/**
 * 重试失败的同步
 */
async function handleRetry(syncLogId: string) {
  retrying.value = syncLogId

  try {
    await trpc.gitSync.retrySyncTask.mutate({ syncLogId })

    toast.success('重试已触发', '正在重新同步...')

    // 延迟后重新加载日志
    setTimeout(() => {
      loadLogs()
    }, 2000)
  } catch (error: any) {
    toast.error('重试失败', error.message)
  } finally {
    retrying.value = null
  }
}

/**
 * 加载更多
 */
function loadMore() {
  limit.value += 20
  loadLogs()
}

/**
 * 获取同步动作的文本
 */
function getSyncActionLabel(action: string) {
  switch (action) {
    case 'create':
      return '添加协作者'
    case 'update':
      return '更新权限'
    case 'delete':
      return '移除协作者'
    default:
      return action
  }
}

/**
 * 获取同步状态的 Badge 样式
 */
function getSyncStatusVariant(status: string) {
  switch (status) {
    case 'success':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'pending':
      return 'secondary'
    default:
      return 'outline'
  }
}

/**
 * 获取同步状态的文本
 */
function getSyncStatusLabel(status: string) {
  switch (status) {
    case 'success':
      return '成功'
    case 'failed':
      return '失败'
    case 'pending':
      return '处理中'
    default:
      return '未知'
  }
}

/**
 * 格式化日期
 */
function formatDate(date: string | Date) {
  return new Date(date).toLocaleString('zh-CN')
}

// 监听过滤状态变化
watch(filterStatus, () => {
  limit.value = 20
  loadLogs()
})

// 初始加载
onMounted(() => {
  loadLogs()
})
</script>
