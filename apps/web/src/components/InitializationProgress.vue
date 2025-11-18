<template>
  <div class="space-y-6">
    <div class="text-center space-y-4">
      <div class="relative inline-block">
        <div
          class="w-20 h-20 rounded-full border-4 flex items-center justify-center"
          :class="statusColor"
        >
          <Loader2 v-if="status === 'initializing'" class="h-10 w-10 animate-spin" />
          <CheckCircle2 v-else-if="status === 'completed'" class="h-10 w-10" />
          <AlertCircle v-else-if="status === 'failed'" class="h-10 w-10" />
        </div>
      </div>
      <div>
        <h3 class="text-xl font-semibold">{{ statusTitle }}</h3>
        <p class="text-muted-foreground">{{ statusDescription }}</p>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">初始化进度</span>
        <span class="font-medium">{{ progress }}%</span>
      </div>
      <Progress :value="progress" class="h-2" />
    </div>

    <Alert v-if="status === 'failed' && errorMessage" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>初始化失败</AlertTitle>
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <Alert v-if="status === 'completed'">
      <CheckCircle2 class="h-4 w-4" />
      <AlertTitle>初始化完成</AlertTitle>
      <AlertDescription>项目已成功初始化，所有资源已创建完成。</AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Progress, Alert, AlertDescription, AlertTitle } from '@juanie/ui'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

const props = defineProps<{
  projectId: string | null
}>()

const emit = defineEmits<{
  complete: []
  error: [error: string]
}>()

const status = ref<'initializing' | 'completed' | 'failed'>('initializing')
const progress = ref(0)
const errorMessage = ref<string | null>(null)
let unsubscribe: (() => void) | null = null

const statusColor = computed(() => {
  switch (status.value) {
    case 'initializing':
      return 'border-primary text-primary'
    case 'completed':
      return 'border-green-600 text-green-600'
    case 'failed':
      return 'border-destructive text-destructive'
    default:
      return 'border-muted text-muted-foreground'
  }
})

const statusTitle = computed(() => {
  switch (status.value) {
    case 'initializing':
      return '正在初始化项目...'
    case 'completed':
      return '初始化完成！'
    case 'failed':
      return '初始化失败'
    default:
      return '准备初始化'
  }
})

const statusDescription = computed(() => {
  switch (status.value) {
    case 'initializing':
      return '请稍候，我们正在为您配置项目资源'
    case 'completed':
      return '所有资源已创建完成，项目已准备就绪'
    case 'failed':
      return '初始化过程中遇到错误，请查看详情'
    default:
      return ''
  }
})

function connectSubscription() {
  if (!props.projectId) return

  // 使用 tRPC subscription
  unsubscribe = trpc.projects.onInitProgress.subscribe(
    { projectId: props.projectId },
    {
      onData: (event) => {
        console.log('Progress event:', event)

        if (event.type === 'init') {
          progress.value = event.data.progress || 0
        } else if (event.type === 'job.progress') {
          progress.value = event.data.progress || 0
        } else if (event.type === 'job.completed') {
          status.value = 'completed'
          progress.value = 100
          emit('complete')
        } else if (event.type === 'job.failed') {
          status.value = 'failed'
          errorMessage.value = event.data.error || '初始化失败'
          if (errorMessage.value) {
            emit('error', errorMessage.value)
          }
        }
      },
      onError: (err) => {
        console.error('Subscription error:', err)
        status.value = 'failed'
        errorMessage.value = '连接失败，请刷新页面重试'
      },
    }
  )
}

onMounted(() => {
  if (props.projectId) {
    connectSubscription()
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>
