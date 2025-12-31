<template>
  <div class="space-y-6">
    <!-- 状态头部 -->
    <div class="flex items-center gap-4">
      <div
        class="relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors duration-300"
        :class="statusBorderClass"
      >
        <Loader2 v-if="status === 'initializing'" class="h-6 w-6 animate-spin" />
        <CheckCircle2 v-else-if="status === 'completed'" class="h-6 w-6" />
        <AlertCircle v-else-if="status === 'failed'" class="h-6 w-6" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-lg font-semibold">{{ statusTitle }}</h3>
        <p v-if="currentMessage" class="text-sm text-muted-foreground truncate">
          {{ currentMessage }}
        </p>
      </div>
      <div class="text-2xl font-bold tabular-nums">{{ progress }}%</div>
    </div>

    <!-- 主进度条 -->
    <div class="space-y-2">
      <UiProgress :model-value="progress" class="h-2" />
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>初始化进度</span>
        <span v-if="currentStep">{{ getStepLabel(currentStep) }}</span>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div v-if="steps.length > 0" class="space-y-2">
      <div
        v-for="step in steps"
        :key="step.step"
        class="rounded-lg border p-3 transition-all duration-200"
        :class="getStepClass(step)"
      >
        <div class="flex items-center gap-3">
          <!-- 状态图标 -->
          <div class="shrink-0">
            <Loader2 v-if="step.status === 'running'" class="h-4 w-4 animate-spin text-primary" />
            <CheckCircle2 v-else-if="step.status === 'completed'" class="h-4 w-4 text-green-600" />
            <AlertCircle v-else-if="step.status === 'failed'" class="h-4 w-4 text-destructive" />
            <Clock v-else-if="step.status === 'pending'" class="h-4 w-4 text-muted-foreground" />
            <SkipForward v-else-if="step.status === 'skipped'" class="h-4 w-4 text-muted-foreground" />
          </div>

          <!-- 步骤信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ step.displayName || getStepLabel(step.step) }}</span>
              <span v-if="step.duration" class="text-xs text-muted-foreground">
                {{ formatDuration(step.duration) }}
              </span>
            </div>
            
            <!-- 子进度消息 -->
            <p v-if="step.status === 'running' && stepMessages.get(step.step)" class="text-xs text-muted-foreground mt-1">
              {{ stepMessages.get(step.step) }}
            </p>
          </div>

          <!-- 子进度百分比 -->
          <div v-if="step.status === 'running' && step.progress" class="text-sm font-medium tabular-nums">
            {{ step.progress }}%
          </div>
        </div>

        <!-- 子进度条 -->
        <UiProgress
          v-if="step.status === 'running' && step.progress"
          :model-value="Number(step.progress)"
          class="h-1 mt-2"
        />

        <!-- 错误信息 -->
        <div v-if="step.error" class="mt-2 rounded bg-destructive/10 p-2">
          <p class="text-xs text-destructive">{{ step.error }}</p>
        </div>
      </div>
    </div>

    <!-- 完成/失败提示 -->
    <UiAlert v-if="status === 'completed'" class="border-green-200 bg-green-50">
      <CheckCircle2 class="h-4 w-4 text-green-600" />
      <UiAlertTitle class="text-green-900">初始化完成</UiAlertTitle>
      <UiAlertDescription class="text-green-700">
        项目已成功初始化，所有资源已创建完成。
      </UiAlertDescription>
    </UiAlert>

    <UiAlert v-if="status === 'failed' && errorMessage" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <UiAlertTitle>初始化失败</UiAlertTitle>
      <UiAlertDescription>{{ errorMessage }}</UiAlertDescription>
    </UiAlert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Loader2, CheckCircle2, AlertCircle, Clock, SkipForward } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { log } from '@juanie/ui'

const props = defineProps<{
  projectId: string | null
}>()

const emit = defineEmits<{
  complete: []
  error: [error: string]
}>()

interface InitializationStep {
  step: string
  displayName?: string // ✅ 添加可选的 displayName 字段
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  progress: number | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null
}

// 状态
const status = ref<'initializing' | 'completed' | 'failed'>('initializing')
const progress = ref(0)
const currentMessage = ref('')
const currentStep = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const steps = ref<InitializationStep[]>([])
const stepMessages = ref<Map<string, string>>(new Map())
let unsubscribe: { unsubscribe: () => void } | null = null

// 初始化步骤列表
function initializeSteps() {
  steps.value = [
    { step: 'resolve_credentials', displayName: '解析凭证', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
    { step: 'create_repository', displayName: '创建 Git 仓库', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
    { step: 'push_template', displayName: '推送项目模板', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
    { step: 'create_environments', displayName: '创建环境', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
    { step: 'create_db_records', displayName: '创建数据库记录', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
    { step: 'setup_gitops', displayName: '配置 GitOps', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
    { step: 'finalize', displayName: '完成初始化', status: 'pending', progress: null, error: null, startedAt: null, completedAt: null, duration: null },
  ]
}

// 样式计算
const statusBorderClass = computed(() => {
  if (status.value === 'completed') return 'border-green-600 text-green-600'
  if (status.value === 'failed') return 'border-destructive text-destructive'
  return 'border-primary text-primary'
})

const statusTitle = computed(() => {
  if (status.value === 'completed') return '初始化完成'
  if (status.value === 'failed') return '初始化失败'
  return '正在初始化项目'
})

// 获取步骤样式
function getStepClass(step: InitializationStep) {
  if (step.status === 'running') return 'border-primary bg-primary/5'
  if (step.status === 'completed') return 'border-green-200 bg-green-50'
  if (step.status === 'failed') return 'border-destructive bg-destructive/5'
  return 'border-muted bg-muted/30'
}

// 获取步骤标签
function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    resolve_credentials: '解析凭证',
    create_repository: '创建 Git 仓库',
    push_template: '推送项目模板',
    create_db_records: '创建数据库记录',
    setup_gitops: '配置 GitOps',
    finalize: '完成初始化',
    // 子步骤标签
    create_repo: '创建仓库',
    prepare_vars: '准备变量',
    render_template: '渲染模板',
    push_files: '推送文件',
    create_gitops: '创建 GitOps 资源',
  }
  return labels[step] || step
}

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

// 根据进度判断当前步骤
function getCurrentStepByProgress(progress: number): string | null {
  if (progress < 5) return 'resolve_credentials'
  if (progress < 25) return 'create_repository'
  if (progress < 55) return 'push_template'
  if (progress < 65) return 'create_db_records'
  if (progress < 90) return 'setup_gitops'
  if (progress <= 100) return 'finalize'
  return null
}

// 更新步骤状态
function updateStepStatus(stepName: string, status: InitializationStep['status'], substepProgress?: number) {
  const step = steps.value.find(s => s.step === stepName)
  if (!step) return

  step.status = status
  
  if (status === 'running') {
    if (!step.startedAt) {
      step.startedAt = new Date().toISOString()
    }
    if (substepProgress !== undefined) {
      step.progress = substepProgress
    }
  } else if (status === 'completed') {
    step.completedAt = new Date().toISOString()
    step.progress = 100
    if (step.startedAt) {
      step.duration = Date.now() - new Date(step.startedAt).getTime()
    }
  } else if (status === 'failed') {
    step.completedAt = new Date().toISOString()
    if (step.startedAt) {
      step.duration = Date.now() - new Date(step.startedAt).getTime()
    }
  }
}

// 获取当前状态
async function fetchCurrentStatus() {
  if (!props.projectId) return
  
  try {
    const projectStatus = await trpc.projects.getStatus.query({ projectId: props.projectId })
    
    if (projectStatus?.project) {
      const project = projectStatus.project
      
      if (project.status === 'active') {
        status.value = 'completed'
        progress.value = 100
        currentMessage.value = '初始化完成'
        emit('complete')
        return
      }
      
      if (project.status === 'failed') {
        status.value = 'failed'
        errorMessage.value = (project as any).initializationError || '初始化失败'
        emit('error', errorMessage.value!)
        return
      }
      
      if (project.status === 'initializing') {
        currentMessage.value = '正在初始化...'
        
        // ✅ 从数据库恢复步骤状态
        await restoreStepsFromDatabase()
      }
    }
  } catch (error) {
    console.error('Failed to fetch current status:', error)
  }
  
  connectSubscription()
}

// ✅ 从数据库恢复步骤状态
async function restoreStepsFromDatabase() {
  if (!props.projectId) return
  
  try {
    const dbSteps = await trpc.projects.getInitializationSteps.query({ projectId: props.projectId })
    
    if (dbSteps && dbSteps.length > 0) {
      // 将数据库步骤映射到前端格式
      steps.value = dbSteps.map(dbStep => ({
        step: dbStep.step,
        displayName: dbStep.displayName, // ✅ 添加 displayName 字段
        status: dbStep.status as InitializationStep['status'],
        progress: dbStep.progress,
        error: dbStep.error,
        startedAt: dbStep.startedAt,
        completedAt: dbStep.completedAt,
        duration: dbStep.duration,
      }))
      
      // 恢复当前步骤和进度
      const runningStep = steps.value.find(s => s.status === 'running')
      if (runningStep) {
        currentStep.value = runningStep.step
        // 根据已完成步骤估算总进度
        const completedSteps = steps.value.filter(s => s.status === 'completed').length
        progress.value = Math.floor((completedSteps / steps.value.length) * 100)
      }
      
      log.info('恢复了步骤状态', { stepsCount: steps.value.length })
    } else {
      // 数据库没有步骤记录，初始化默认步骤
      initializeSteps()
    }
  } catch (error) {
    log.error('恢复步骤状态失败', error)
    initializeSteps()
  }
}

// 连接 SSE 订阅
function connectSubscription() {
  if (!props.projectId) return
  
  try {
    unsubscribe = trpc.projects.onInitProgress.subscribe(
      { projectId: props.projectId },
      {
        onData: (event: any) => {
          if (!event?.type) return
          
          // ✅ 处理进度更新事件（后端发送 type: 'progress'）
          if (event.type === 'progress') {
            const newProgress = event.progress || 0
            const newMessage = event.message || ''
            
            progress.value = newProgress
            currentMessage.value = newMessage
            
            // ✅ 使用后端提供的 substep 数据更新步骤状态
            if (event.substep) {
              const { name: substepName, progress: substepProgress } = event.substep
              
              // 根据子步骤名称映射到主步骤
              let mainStep: string | null = null
              if (substepName === 'create_repo') {
                mainStep = 'create_repository'
              } else if (['prepare_vars', 'render_template', 'push_files'].includes(substepName)) {
                mainStep = 'push_template'
              } else if (substepName === 'create_gitops') {
                mainStep = 'setup_gitops'
              }
              
              if (mainStep) {
                updateStepStatus(mainStep, 'running', substepProgress)
                currentStep.value = mainStep
                stepMessages.value.set(mainStep, newMessage)
              }
            } else {
              // 没有 substep 数据时，根据总进度推断当前步骤
              const step = getCurrentStepByProgress(newProgress)
              if (step) {
                currentStep.value = step
                updateStepStatus(step, 'running')
                stepMessages.value.set(step, newMessage)
              }
            }
          } 
          // ✅ 完成事件
          else if (event.type === 'initialization.completed') {
            status.value = 'completed'
            progress.value = 100
            currentMessage.value = '初始化完成'
            
            // 标记所有步骤为完成
            steps.value.forEach(step => {
              if (step.status !== 'completed') {
                updateStepStatus(step.step, 'completed')
              }
            })
            
            emit('complete')
          } 
          // ✅ 失败事件
          else if (event.type === 'initialization.failed' || event.type === 'initialization.error') {
            status.value = 'failed'
            errorMessage.value = event.error || event.data?.error || '初始化失败'
            
            // 标记当前步骤为失败
            if (currentStep.value) {
              const step = steps.value.find(s => s.step === currentStep.value)
              if (step) {
                step.status = 'failed'
                step.error = errorMessage.value
              }
            }
            
            emit('error', errorMessage.value!)
          }
        },
        onError: () => {
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
    // 获取当前状态（会自动恢复步骤或初始化默认步骤）
    fetchCurrentStatus()
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe.unsubscribe()
  }
})
</script>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
