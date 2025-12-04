<template>
  <div 
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 400 } }"
    class="space-y-6"
  >
    <!-- 状态图标 -->
    <div 
      v-motion
      :initial="{ scale: 0, opacity: 0 }"
      :enter="{ scale: 1, opacity: 1, transition: { duration: 500, type: 'spring', stiffness: 200 } }"
      class="text-center space-y-4"
    >
      <div class="relative inline-block">
        <div
          v-motion
          :animate="{ 
            borderColor: statusBorderColor,
            transition: { duration: 300 }
          }"
          class="w-20 h-20 rounded-full border-4 flex items-center justify-center"
          :class="statusColor"
        >
          <Loader2 v-if="status === 'initializing'" class="h-10 w-10 animate-spin" />
          <CheckCircle2 
            v-else-if="status === 'completed'" 
            v-motion
            :initial="{ scale: 0, rotate: -180 }"
            :enter="{ scale: 1, rotate: 0, transition: { duration: 500, type: 'spring' } }"
            class="h-10 w-10" 
          />
          <AlertCircle 
            v-else-if="status === 'failed'" 
            v-motion
            :initial="{ scale: 0 }"
            :enter="{ scale: 1, transition: { duration: 300 } }"
            class="h-10 w-10" 
          />
        </div>
      </div>
      <div>
        <h3 
          v-motion
          :initial="{ opacity: 0, y: 10 }"
          :enter="{ opacity: 1, y: 0, transition: { duration: 300, delay: 100 } }"
          class="text-xl font-semibold"
        >
          {{ statusTitle }}
        </h3>
        <p 
          v-if="currentMessage" 
          :key="currentMessage"
          class="text-sm text-primary mt-2"
        >
          {{ currentMessage }}
        </p>
      </div>
    </div>

    <!-- 进度条 -->
    <div 
      v-motion
      :initial="{ opacity: 0, scale: 0.95 }"
      :enter="{ opacity: 1, scale: 1, transition: { duration: 400, delay: 300 } }"
      class="space-y-2"
    >
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">初始化进度</span>
        <span 
          class="font-medium tabular-nums"
        >
          {{ progress }}%
        </span>
      </div>
      <div class="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          class="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
          :style="{ 
            width: `${progress}%`,
            backgroundColor: progressBarBgColor
          }"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <Alert 
      v-if="status === 'failed' && errorMessage" 
      v-motion
      :initial="{ opacity: 0, scale: 0.9 }"
      :enter="{ opacity: 1, scale: 1, transition: { duration: 300 } }"
      variant="destructive"
    >
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>初始化失败</AlertTitle>
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <!-- 完成提示 -->
    <Alert 
      v-if="status === 'completed'" 
      v-motion
      :initial="{ opacity: 0, y: 20, scale: 0.9 }"
      :enter="{ 
        opacity: 1, 
        y: 0, 
        scale: 1, 
        transition: { 
          duration: 500, 
          type: 'spring',
          stiffness: 200 
        } 
      }"
      class="border-green-200 bg-green-50"
    >
      <CheckCircle2 class="h-4 w-4 text-green-600" />
      <AlertTitle class="text-green-900">初始化完成</AlertTitle>
      <AlertDescription class="text-green-700">
        项目已成功初始化，所有资源已创建完成。
      </AlertDescription>
    </Alert>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Alert, AlertDescription, AlertTitle, log } from '@juanie/ui'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

const props = defineProps<{
  projectId: string | null
}>()

const emit = defineEmits<{
  complete: []
  error: [error: string]
}>()

// 状态（由后端事件驱动）
const status = ref<'initializing' | 'completed' | 'failed'>('initializing')
const progress = ref(0)
const currentMessage = ref<string>('')
const errorMessage = ref<string | null>(null)
let unsubscribe: { unsubscribe: () => void } | null = null

// UI 样式计算
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

const progressBarBgColor = computed(() => {
  if (status.value === 'failed') return 'rgb(239, 68, 68)' // red-500
  if (status.value === 'completed' || progress.value >= 100) return 'rgb(22, 163, 74)' // green-600
  // 根据进度渐变：蓝色 -> 绿色
  if (progress.value >= 80) return 'rgb(16, 185, 129)' // emerald-500
  if (progress.value >= 60) return 'rgb(20, 184, 166)' // teal-500
  if (progress.value >= 40) return 'rgb(6, 182, 212)' // cyan-500
  return 'rgb(59, 130, 246)' // blue-500 (primary)
})

const statusBorderColor = computed(() => {
  if (status.value === 'failed') return 'rgb(239, 68, 68)'
  if (status.value === 'completed') return 'rgb(22, 163, 74)'
  return 'rgb(59, 130, 246)'
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

/**
 * 从后端获取当前状态（用于页面刷新恢复）
 */
async function fetchCurrentStatus() {
  if (!props.projectId) return
  
  try {
    const projectStatus = await trpc.projects.getStatus.query({ projectId: props.projectId })
    
    if (projectStatus?.project) {
      const project = projectStatus.project
      
      // 已完成
      if (project.status === 'active') {
        status.value = 'completed'
        progress.value = 100
        currentMessage.value = '初始化完成'
        emit('complete')
        return
      }
      
      // 已失败
      if (project.status === 'failed') {
        status.value = 'failed'
        const initStatus = project.initializationStatus as any
        errorMessage.value = initStatus?.error || '初始化失败'
        emit('error', errorMessage.value!)
        return
      }
      
      // 正在初始化 - 从 ProgressManager 恢复实时进度
      if (project.status === 'initializing') {
        const initStatus = project.initializationStatus as any
        if (initStatus?.progress !== undefined) {
          progress.value = initStatus.progress
          currentMessage.value = initStatus.step || '正在初始化...'
        }
      }
    }
  } catch (error) {
    log.error('Failed to fetch current status:', error)
  }
  
  // 连接 SSE 监听后续进度
  connectSubscription()
}

/**
 * 连接 SSE 订阅（唯一的进度数据源）
 */
function connectSubscription() {
  if (!props.projectId) return
  
  try {
    unsubscribe = trpc.projects.onInitProgress.subscribe(
      { projectId: props.projectId },
      {
        onData: (event: any) => {
          if (!event?.type) return
          
          // 进度更新（完全信任后端 ProgressManager）
          if (event.type === 'initialization.progress') {
            const newProgress = event.data?.progress || 0
            const newMessage = event.data?.message || ''
            
            // 直接更新，后端已经控制了速度
            progress.value = newProgress
            currentMessage.value = newMessage
          } 
          // 初始化完成
          else if (event.type === 'initialization.completed') {
            status.value = 'completed'
            progress.value = 100
            currentMessage.value = '初始化完成'
            emit('complete')
          } 
          // 初始化失败
          else if (event.type === 'initialization.failed' || event.type === 'initialization.error') {
            status.value = 'failed'
            errorMessage.value = event.data?.error || '初始化失败'
            emit('error', errorMessage.value!)
          }
        },
        onError: () => {
          // 尝试重新获取状态
          fetchCurrentStatus()
        },
      },
    )
  } catch {
    status.value = 'failed'
    errorMessage.value = '连接失败，请刷新页面重试'
  }
}

onMounted(() => {
  if (props.projectId) {
    fetchCurrentStatus()
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe.unsubscribe()
  }
})
</script>
