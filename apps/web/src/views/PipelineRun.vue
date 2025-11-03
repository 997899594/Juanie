<template>
  <PageContainer>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center space-x-4">
          <Button variant="ghost" size="sm" @click="router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-3xl font-bold">Pipeline 运行详情</h1>
            <p class="text-muted-foreground mt-1">运行 ID: {{ runId }}</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <PipelineStatusBadge v-if="currentRun" :status="currentRun.status" />
          <Button
            v-if="currentRun?.status === 'running'"
            variant="destructive"
            size="sm"
            :disabled="loading"
            @click="handleCancel"
          >
            <XCircle class="h-4 w-4 mr-1" />
            取消运行
          </Button>
        </div>
      </div>
    </template>

    <div v-if="loading && !currentRun" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="currentRun" class="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>运行信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">分支</span>
              <p class="font-medium">{{ currentRun.branch }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">提交哈希</span>
              <p class="font-mono text-xs">{{ currentRun.commitHash }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">触发方式</span>
              <p class="font-medium">{{ getTriggerText(currentRun.trigger) }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">运行时长</span>
              <p class="font-medium">{{ formatDuration(currentRun.duration) }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">开始时间</span>
              <p class="font-medium">{{ formatDate(currentRun.startedAt) }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">结束时间</span>
              <p class="font-medium">{{ formatDate(currentRun.finishedAt) }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PipelineLogViewer :logs="displayLogs" />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePipelines } from '@/composables/usePipelines'
import PipelineStatusBadge from '@/components/PipelineStatusBadge.vue'
import PipelineLogViewer from '@/components/PipelineLogViewer.vue'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import { ArrowLeft, XCircle, Loader2 } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const runId = route.params.runId as string

const {
  currentRun,
  loading,
  fetchRun,
  fetchLogs,
  cancelRun,
  subscribeToLogs,
  subscribeToStatus,
} = usePipelines()

const realtimeLogs = ref<Array<{ timestamp: string; message: string }>>([])
const staticLogs = ref<Array<{ timestamp: string; message: string }>>([])

const displayLogs = computed(() => {
  return [...staticLogs.value, ...realtimeLogs.value]
})

let logSubscription: any = null
let statusSubscription: any = null

onMounted(async () => {
  await fetchRun(runId)
  const logsData = await fetchLogs(runId)
  
  if (logsData?.logs) {
    try {
      const parsedLogs = JSON.parse(logsData.logs)
      staticLogs.value = Array.isArray(parsedLogs) ? parsedLogs : []
    } catch {
      staticLogs.value = []
    }
  }

  if (currentRun.value?.status === 'running') {
    logSubscription = subscribeToLogs(runId, (log) => {
      realtimeLogs.value.push(log)
    })

    statusSubscription = subscribeToStatus(runId, (status) => {
      if (currentRun.value) {
        currentRun.value.status = status.status
      }
    })
  }
})

onUnmounted(() => {
  if (logSubscription) {
    logSubscription.unsubscribe?.()
  }
  if (statusSubscription) {
    statusSubscription.unsubscribe?.()
  }
})

const handleCancel = async () => {
  await cancelRun(runId)
  await fetchRun(runId)
}

const getTriggerText = (trigger: string) => {
  const triggerMap: Record<string, string> = {
    manual: '手动触发',
    push: 'Push 触发',
    pr: 'PR 触发',
    schedule: '定时触发',
  }
  return triggerMap[trigger] || trigger
}

const formatDuration = (duration: number | null) => {
  if (!duration) return '-'
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  return `${minutes}m ${seconds}s`
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}
</script>
