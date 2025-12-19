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
          <div class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>

    <!-- 详细步骤列表 -->
    <div 
      v-if="steps.length > 0"
      v-motion
      :initial="{ opacity: 0, y: 20 }"
      :enter="{ opacity: 1, y: 0, transition: { duration: 400, delay: 400 } }"
      class="space-y-3"
    >
      <h4 class="text-sm font-medium text-muted-foreground">初始化步骤</h4>
      <div class="space-y-2">
        <div
          v-for="(step, index) in steps"
          :key="step.step"
          v-motion
          :initial="{ opacity: 0, x: -20 }"
          :enter="{ opacity: 1, x: 0, transition: { duration: 300, delay: 100 * index } }"
          class="border rounded-lg p-4 space-y-3 transition-colors"
          :class="{
            'border-primary bg-primary/5': step.status === 'running',
            'border-green-200 bg-green-50': step.status === 'completed',
            'border-destructive bg-destructive/5': step.status === 'failed',
            'border-muted': step.status === 'pending' || step.status === 'skipped'
          }"
        >
          <!-- 步骤头部 -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <!-- 状态图标 -->
              <div class="shrink-0 mt-0.5">
                <Loader2 
                  v-if="step.status === 'running'" 
                  class="h-5 w-5 text-primary animate-spin" 
                />
                <CheckCircle2 
                  v-else-if="step.status === 'completed'" 
                  class="h-5 w-5 text-green-600" 
                />
                <AlertCircle 
                  v-else-if="step.status === 'failed'" 
                  class="h-5 w-5 text-destructive" 
                />
                <Clock 
                  v-else-if="step.status === 'pending'" 
                  class="h-5 w-5 text-muted-foreground" 
                />
                <SkipForward 
                  v-else-if="step.status === 'skipped'" 
                  class="h-5 w-5 text-muted-foreground" 
                />
              </div>

              <!-- 步骤信息 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-sm">{{ getStepLabel(step.step) }}</span>
                  <span 
                    v-if="step.status === 'running' && step.progress" 
                    class="text-xs text-muted-foreground tabular-nums"
                  >
                    {{ step.progress }}%
                  </span>
                </div>
                
                <!-- 时间信息 -->
                <div class="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span v-if="step.startedAt">
                    开始: {{ formatTime(step.startedAt) }}
                  </span>
                  <span v-if="step.duration !== null && step.duration !== undefined">
                    耗时: {{ formatDuration(step.duration) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 展开按钮（仅在有错误时显示） -->
            <button
              v-if="step.error"
              @click="toggleStepExpanded(step.step)"
              class="shrink-0 p-1 hover:bg-muted rounded transition-colors"
            >
              <ChevronDown 
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': expandedSteps.has(step.step) }"
              />
            </button>
          </div>

          <!-- 当前子任务消息 -->
          <div 
            v-if="step.status === 'running' && currentStepMessage(step.step)"
            class="text-xs text-muted-foreground mt-2 animate-pulse"
          >
            {{ currentStepMessage(step.step) }}
          </div>

          <!-- 步骤进度条 -->
          <div 
            v-if="step.status === 'running' && step.progress"
            class="relative w-full h-1.5 bg-secondary rounded-full overflow-hidden mt-2"
          >
            <div 
              class="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${step.progress}%` }"
            />
          </div>

          <!-- 错误详情（可展开） -->
          <div
            v-if="step.error && expandedSteps.has(step.step)"
            v-motion
            :initial="{ opacity: 0, height: 0 }"
            :enter="{ opacity: 1, height: 'auto', transition: { duration: 200 } }"
            class="space-y-2"
          >
            <div class="text-sm text-destructive bg-destructive/10 rounded p-3">
              <div class="font-medium mb-1">错误信息:</div>
              <div class="text-xs font-mono">{{ step.error }}</div>
            </div>
            <div v-if="step.errorStack" class="text-xs text-muted-foreground bg-muted rounded p-3 font-mono overflow-x-auto">
              <div class="font-medium mb-1">错误堆栈:</div>
              <pre class="whitespace-pre-wrap">{{ step.errorStack }}</pre>
            </div>
          </div>
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
import { Loader2, CheckCircle2, AlertCircle, Clock, SkipForward, ChevronDown } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

const props = defineProps<{
  projectId: string | null
}>()

const emit = defineEmits<{
  complete: []
  error: [error: string]
}>()

// 步骤类型定义
interface InitializationStep {
  step: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  progress: string | null
  error: string | null
  errorStack?: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null
}

// 状态（由后端事件驱动）
const status = ref<'initializing' | 'completed' | 'failed'>('initializing')
const progress = ref(0)
const currentMessage = ref<string>('')
const errorMessage = ref<string | null>(null)
const steps = ref<InitializationStep[]>([])
const expandedSteps = ref<Set<string>>(new Set())
const stepMessages = ref<Map<string, string>>(new Map()) // 存储每个步骤的当前消息
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
        errorMessage.value = (project as any).initializationError || '初始化失败'
        emit('error', errorMessage.value!)
        return
      }
      
      // 正在初始化 - 等待 SSE 推送实时进度
      if (project.status === 'initializing') {
        currentMessage.value = '正在初始化...'
        // 实时进度由 SSE 订阅推送，不从数据库读取
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
          
          // 更新步骤列表（如果有）
          if (event.steps && Array.isArray(event.steps)) {
            steps.value = event.steps
          }
          
          // 进度更新（完全信任后端 ProgressManager）
          if (event.type === 'initialization.progress') {
            const newProgress = event.data?.progress || 0
            const newMessage = event.data?.message || ''
            
            // 直接更新，后端已经控制了速度
            progress.value = newProgress
            currentMessage.value = newMessage
            
            // 根据进度范围判断当前步骤，并更新该步骤的消息
            const currentStep = getCurrentStepByProgress(newProgress)
            if (currentStep) {
              stepMessages.value.set(currentStep, newMessage)
            }
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

/**
 * 切换步骤展开状态
 */
function toggleStepExpanded(step: string) {
  if (expandedSteps.value.has(step)) {
    expandedSteps.value.delete(step)
  } else {
    expandedSteps.value.add(step)
  }
}

/**
 * 获取步骤的友好名称
 */
function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    create_repository: '创建 Git 仓库',
    push_template: '推送项目模板',
    create_database_records: '创建数据库记录',
    setup_gitops: '配置 GitOps',
    finalize: '完成初始化',
  }
  return labels[step] || step
}

/**
 * 格式化时间
 */
function formatTime(time: string | null): string {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * 根据总进度判断当前步骤
 * 进度范围：
 * - create_repository: 0-20%
 * - push_template: 20-50%
 * - create_database_records: 50-60%
 * - setup_gitops: 60-90%
 * - finalize: 90-100%
 */
function getCurrentStepByProgress(progress: number): string | null {
  if (progress < 20) return 'create_repository'
  if (progress < 50) return 'push_template'
  if (progress < 60) return 'create_database_records'
  if (progress < 90) return 'setup_gitops'
  if (progress <= 100) return 'finalize'
  return null
}

/**
 * 获取步骤的当前消息
 */
function currentStepMessage(step: string): string {
  return stepMessages.value.get(step) || ''
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
