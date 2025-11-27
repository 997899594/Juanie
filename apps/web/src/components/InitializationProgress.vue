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
          v-motion
          :initial="{ opacity: 0 }"
          :enter="{ opacity: 1, transition: { duration: 300, delay: 200 } }"
          class="text-muted-foreground"
        >
          {{ statusDescription }}
        </p>
        <p 
          v-if="currentStep" 
          v-motion
          :key="currentStep"
          :initial="{ opacity: 0, x: -10 }"
          :enter="{ opacity: 1, x: 0, transition: { duration: 300 } }"
          class="text-sm text-primary mt-2"
        >
          {{ currentStep }}
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
          v-motion
          :animate="{ 
            scale: displayProgress > 0 ? [1, 1.1, 1] : 1,
            transition: { duration: 300 }
          }"
          class="font-medium tabular-nums"
        >
          {{ displayProgress }}%
        </span>
      </div>
      <div class="relative w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          class="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
          :style="{ 
            width: `${displayProgress}%`,
            backgroundColor: progressBarBgColor
          }"
        >
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div 
      v-if="status === 'initializing'" 
      v-motion
      :initial="{ opacity: 0, y: 20 }"
      :enter="{ opacity: 1, y: 0, transition: { duration: 400, delay: 400 } }"
      class="space-y-2"
    >
      <div 
        v-for="(step, index) in steps" 
        :key="step.name"
        v-motion
        :initial="{ opacity: 0, x: -20 }"
        :enter="{ 
          opacity: 1, 
          x: 0, 
          transition: { 
            duration: 300, 
            delay: 500 + index * 50 
          } 
        }"
        :animate="{
          backgroundColor: step.completed ? 'rgb(240, 253, 244)' : step.active ? 'rgb(239, 246, 255)' : 'transparent',
          transition: { duration: 300 }
        }"
        class="flex items-center gap-3 text-sm p-2 rounded-lg"
      >
        <div 
          v-motion
          :animate="{
            scale: step.active ? [1, 1.2, 1] : 1,
            rotate: step.completed ? [0, 360] : 0,
            transition: { duration: step.completed ? 500 : 300 }
          }"
          class="flex-shrink-0"
        >
          <CheckCircle2 v-if="step.completed" class="h-4 w-4 text-green-600" />
          <Loader2 v-else-if="step.active" class="h-4 w-4 animate-spin text-primary" />
          <div v-else class="h-4 w-4 rounded-full border-2 border-muted" />
        </div>
        <span 
          v-motion
          :animate="{
            color: step.completed ? 'rgb(0, 0, 0)' : step.active ? 'rgb(59, 130, 246)' : 'rgb(156, 163, 175)',
            fontWeight: step.active ? 500 : 400,
            transition: { duration: 300 }
          }"
        >
          {{ step.label }}
        </span>
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
const displayProgress = ref(0)
const currentStep = ref<string>('')
const errorMessage = ref<string | null>(null)
let unsubscribe: { unsubscribe: () => void } | null = null
let progressInterval: number | null = null

// 初始化步骤
const steps = ref([
  { name: 'create', label: '创建项目记录', completed: false, active: false },
  { name: 'repository', label: '初始化代码仓库', completed: false, active: false },
  { name: 'template', label: '应用项目模板', completed: false, active: false },
  { name: 'gitops', label: '配置 GitOps', completed: false, active: false },
  { name: 'complete', label: '完成初始化', completed: false, active: false },
])

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

const progressBarColor = computed(() => {
  if (status.value === 'failed') return 'bg-destructive'
  if (status.value === 'completed' || displayProgress.value >= 100) return 'bg-green-600'
  // 根据进度渐变：蓝色 -> 绿色
  if (displayProgress.value >= 80) return 'bg-emerald-500'
  if (displayProgress.value >= 60) return 'bg-teal-500'
  if (displayProgress.value >= 40) return 'bg-cyan-500'
  return 'bg-primary'
})

// 返回实际的颜色值用于内联样式
const progressBarBgColor = computed(() => {
  if (status.value === 'failed') return 'rgb(239, 68, 68)' // red-500
  if (status.value === 'completed' || displayProgress.value >= 100) return 'rgb(22, 163, 74)' // green-600
  // 根据进度渐变：蓝色 -> 绿色
  if (displayProgress.value >= 80) return 'rgb(16, 185, 129)' // emerald-500
  if (displayProgress.value >= 60) return 'rgb(20, 184, 166)' // teal-500
  if (displayProgress.value >= 40) return 'rgb(6, 182, 212)' // cyan-500
  return 'rgb(59, 130, 246)' // blue-500 (primary)
})

const statusBorderColor = computed(() => {
  if (status.value === 'failed') return 'rgb(239, 68, 68)'
  if (status.value === 'completed') return 'rgb(22, 163, 74)'
  return 'rgb(59, 130, 246)'
})



// 平滑更新进度
function smoothUpdateProgress(targetProgress: number) {
  if (progressInterval) {
    clearInterval(progressInterval)
  }

  const startProgress = displayProgress.value
  const diff = targetProgress - startProgress
  const duration = 500 // 500ms 过渡时间
  const steps = 20
  const stepValue = diff / steps
  const stepDuration = duration / steps

  let currentStep = 0
  progressInterval = window.setInterval(() => {
    currentStep++
    if (currentStep >= steps) {
      displayProgress.value = targetProgress
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
    } else {
      displayProgress.value = Math.round(startProgress + stepValue * currentStep)
    }
  }, stepDuration)
}

// 更新步骤状态
function updateSteps(progressValue: number) {
  // 重置所有步骤的 active 状态
  steps.value.forEach((step) => {
    step.active = false
  })

  // 根据进度值设置完成状态和当前活动步骤
  // 步骤 1: 创建项目记录 (0-20%)
  if (progressValue >= 20) {
    steps.value[0]!.completed = true
  } else if (progressValue > 0) {
    steps.value[0]!.active = true
    currentStep.value = '正在创建项目...'
    return
  }

  // 步骤 2: 初始化代码仓库 (20-40%)
  if (progressValue >= 40) {
    steps.value[1]!.completed = true
  } else if (progressValue >= 20) {
    steps.value[1]!.active = true
    currentStep.value = '正在初始化代码仓库...'
    return
  }

  // 步骤 3: 应用项目模板 (40-60%)
  if (progressValue >= 60) {
    steps.value[2]!.completed = true
  } else if (progressValue >= 40) {
    steps.value[2]!.active = true
    currentStep.value = '正在应用项目模板...'
    return
  }

  // 步骤 4: 配置 GitOps (60-80%)
  if (progressValue >= 80) {
    steps.value[3]!.completed = true
  } else if (progressValue >= 60) {
    steps.value[3]!.active = true
    currentStep.value = '正在配置 GitOps...'
    return
  }

  // 步骤 5: 完成初始化 (80-100%)
  if (progressValue >= 100) {
    steps.value[4]!.completed = true
    currentStep.value = '初始化完成！'
  } else if (progressValue >= 80) {
    steps.value[4]!.active = true
    currentStep.value = '正在完成初始化...'
  }
}

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

// 从后端获取当前初始化状态
async function fetchCurrentStatus() {
  if (!props.projectId) return
  
  try {
    const projectStatus = await trpc.projects.getStatus.query({ projectId: props.projectId })
    
    if (projectStatus?.project) {
      const project = projectStatus.project
      
      // 检查项目状态
      if (project.status === 'active') {
        status.value = 'completed'
        progress.value = 100
        displayProgress.value = 100
        updateSteps(100)
        emit('complete')
        return // 已完成，不需要连接 subscription
      }
      
      if (project.status === 'failed') {
        status.value = 'failed'
        const initStatus = project.initializationStatus as any
        errorMessage.value = initStatus?.error || '初始化失败'
        emit('error', errorMessage.value!)
        return // 已失败，不需要连接 subscription
      }
      
      // 项目正在初始化，恢复进度
      if (project.status === 'initializing' && project.initializationStatus) {
        const initStatus = project.initializationStatus as any
        const savedProgress = initStatus.progress || 0
        
        if (savedProgress > 0) {
          progress.value = savedProgress
          displayProgress.value = savedProgress
          updateSteps(savedProgress)
          if (initStatus.step) {
            currentStep.value = initStatus.step
          }
          console.log(`恢复初始化进度: ${savedProgress}%`)
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch current status:', error)
  }
  
  // 连接 subscription 监听后续进度
  connectSubscription()
}

function connectSubscription() {
  if (!props.projectId) return
  try {
    unsubscribe = trpc.projects.onInitProgress.subscribe(
      { projectId: props.projectId },
      {
        onData: (event: any) => {
          if (!event || !event.type) return
          
          console.log('收到初始化进度事件:', event)
          
          if (event.type === 'initialization.progress') {
            const newProgress = event.data?.progress || 0
            progress.value = newProgress
            smoothUpdateProgress(newProgress)
            updateSteps(newProgress)
            if (event.data?.message) currentStep.value = event.data.message
          } else if (event.type === 'initialization.completed') {
            status.value = 'completed'
            progress.value = 100
            smoothUpdateProgress(100)
            updateSteps(100)
            emit('complete')
          } else if (event.type === 'initialization.failed' || event.type === 'initialization.error') {
            status.value = 'failed'
            const error = event.data?.error || '初始化失败'
            errorMessage.value = error
            emit('error', error)
          }
        },
        onError: (err: any) => {
          console.error('tRPC subscription error:', err)
          // 不立即标记为失败，可能只是连接问题
          // 尝试重新获取状态
          fetchCurrentStatus()
        },
      },
    )
  } catch (error) {
    console.error('Failed to connect tRPC subscription:', error)
    status.value = 'failed'
    errorMessage.value = '连接失败，请刷新页面重试'
  }
}

onMounted(() => {
  if (props.projectId) {
    // 先获取当前状态，再连接 subscription
    fetchCurrentStatus()
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe.unsubscribe()
  }
  if (progressInterval) {
    clearInterval(progressInterval)
  }
})
</script>
