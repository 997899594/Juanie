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

    <!-- 进度条 -->
    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">初始化进度</span>
        <span class="font-medium">{{ progress }}%</span>
      </div>
      <Progress :value="progress" class="h-2" />
    </div>

    <!-- 初始化步骤 -->
    <div class="space-y-2">
      <div
        v-for="(step, index) in initSteps"
        :key="step.id"
        class="flex items-start space-x-3 p-3 rounded-lg transition-colors"
        :class="getStepClass(step.status)"
      >
        <div class="flex-shrink-0 mt-0.5">
          <Loader2
            v-if="step.status === 'running'"
            class="h-5 w-5 animate-spin text-primary"
          />
          <CheckCircle2
            v-else-if="step.status === 'completed'"
            class="h-5 w-5 text-green-600"
          />
          <AlertCircle
            v-else-if="step.status === 'failed'"
            class="h-5 w-5 text-destructive"
          />
          <Circle
            v-else
            class="h-5 w-5 text-muted-foreground"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm">{{ step.title }}</span>
            <Badge
              v-if="step.status !== 'pending'"
              :variant="getStepBadgeVariant(step.status)"
              class="text-xs"
            >
              {{ getStepStatusText(step.status) }}
            </Badge>
          </div>
          <p v-if="step.description" class="text-xs text-muted-foreground mt-1">
            {{ step.description }}
          </p>
          <div v-if="step.error" class="mt-2">
            <Alert variant="destructive" class="py-2">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription class="text-xs">
                {{ step.error }}
              </AlertDescription>
            </Alert>
            <div v-if="step.suggestedAction" class="mt-2">
              <Button
                variant="outline"
                size="sm"
                @click="handleSuggestedAction(step)"
              >
                {{ step.suggestedAction }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误详情 -->
    <Alert v-if="status === 'failed' && errorMessage" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>初始化失败</AlertTitle>
      <AlertDescription>
        {{ errorMessage }}
      </AlertDescription>
    </Alert>

    <!-- 操作按钮 -->
    <div v-if="status === 'failed'" class="flex justify-center gap-2">
      <Button variant="outline" @click="handleRetry">
        <RotateCcw class="mr-2 h-4 w-4" />
        重试初始化
      </Button>
      <Button variant="outline" @click="handleViewLogs">
        <FileText class="mr-2 h-4 w-4" />
        查看日志
      </Button>
    </div>

    <!-- 成功提示 -->
    <Alert v-if="status === 'completed'">
      <CheckCircle2 class="h-4 w-4" />
      <AlertTitle>初始化完成</AlertTitle>
      <AlertDescription>
        项目已成功初始化，所有资源已创建完成。
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Progress,
  Badge,
  Button,
  Alert,
  AlertDescription,
  AlertTitle,
} from '@juanie/ui'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Circle,
  RotateCcw,
  FileText,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  projectId: string | null
}>()

const emit = defineEmits<{
  complete: []
  error: [error: string]
}>()

const toast = useToast()

// 状态
const status = ref<'initializing' | 'completed' | 'failed'>('initializing')
const progress = ref(0)
const errorMessage = ref<string | null>(null)
const pollingInterval = ref<ReturnType<typeof setInterval> | null>(null)

// 初始化步骤定义
const INIT_STEPS = [
  {
    id: 'create_project',
    title: '创建项目记录',
    description: '在数据库中创建项目',
  },
  {
    id: 'load_template',
    title: '加载模板配置',
    description: '读取项目模板配置',
  },
  {
    id: 'create_environments',
    title: '创建环境',
    description: '创建开发、测试和生产环境',
  },
  {
    id: 'setup_repository',
    title: '配置 Git 仓库',
    description: '连接或创建 Git 仓库',
  },
  {
    id: 'generate_k8s_config',
    title: '生成 Kubernetes 配置',
    description: '基于模板生成 K8s YAML 文件',
  },
  {
    id: 'commit_to_git',
    title: '提交配置到 Git',
    description: '将配置文件提交到仓库',
  },
  {
    id: 'create_gitops_resources',
    title: '创建 GitOps 资源',
    description: '创建 Flux Kustomization/HelmRelease',
  },
  {
    id: 'sync_gitops',
    title: '同步 GitOps 资源',
    description: '等待 Flux 同步配置',
  },
  {
    id: 'verify_deployment',
    title: '验证部署',
    description: '检查 Pod 和服务状态',
  },
  {
    id: 'finalize',
    title: '完成初始化',
    description: '更新项目状态',
  },
]

// 初始化步骤状态
const initSteps = ref(
  INIT_STEPS.map(step => ({
    ...step,
    status: 'pending' as 'pending' | 'running' | 'completed' | 'failed',
    error: null as string | null,
    suggestedAction: null as string | null,
  }))
)

// 计算属性
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

// 获取步骤样式
function getStepClass(stepStatus: string): string {
  switch (stepStatus) {
    case 'running':
      return 'bg-primary/5 border border-primary/20'
    case 'completed':
      return 'bg-green-50 dark:bg-green-950'
    case 'failed':
      return 'bg-destructive/5 border border-destructive/20'
    default:
      return 'bg-muted/30'
  }
}

// 获取步骤徽章变体
function getStepBadgeVariant(stepStatus: string): 'default' | 'destructive' | 'outline' {
  switch (stepStatus) {
    case 'running':
      return 'default'
    case 'completed':
      return 'outline'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

// 获取步骤状态文本
function getStepStatusText(stepStatus: string): string {
  switch (stepStatus) {
    case 'running':
      return '进行中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return '等待中'
  }
}

// 轮询项目状态
async function pollProjectStatus() {
  if (!props.projectId) return

  try {
    // 获取项目状态
    const project = await trpc.projects.get.query({ projectId: props.projectId })

    // 更新进度 - 使用类型断言处理 initializationStatus
    const initStatus = (project as any).initializationStatus
    if (initStatus) {
      progress.value = initStatus.progress || 0

      // 更新步骤状态
      const completedSteps = initStatus.completedSteps || []
      const currentStep = initStatus.step

      initSteps.value.forEach((step) => {
        if (completedSteps.includes(step.id)) {
          step.status = 'completed'
        } else if (step.id === currentStep) {
          step.status = 'running'
        } else {
          // 判断是否在当前步骤之前
          const currentIndex = INIT_STEPS.findIndex(s => s.id === currentStep)
          const stepIndex = INIT_STEPS.findIndex(s => s.id === step.id)
          step.status = stepIndex < currentIndex ? 'completed' : 'pending'
        }
      })

      // 检查是否有错误
      if (initStatus.error) {
        const failedStep = initSteps.value.find(s => s.id === currentStep)
        if (failedStep) {
          failedStep.status = 'failed'
          failedStep.error = initStatus.error
          failedStep.suggestedAction = getSuggestedAction(currentStep)
        }
      }
    }

    // 检查项目状态
    if (project.status === 'active') {
      status.value = 'completed'
      progress.value = 100
      initSteps.value.forEach(step => {
        if (step.status !== 'failed') {
          step.status = 'completed'
        }
      })
      stopPolling()
      emit('complete')
    } else if (project.status === 'failed') {
      status.value = 'failed'
      const initStatus = (project as any).initializationStatus
      errorMessage.value = initStatus?.error || '初始化失败'
      stopPolling()
      if (errorMessage.value) {
        emit('error', errorMessage.value)
      }
    }
  } catch (error: any) {
    console.error('Failed to poll project status:', error)
  }
}

// 获取建议操作
function getSuggestedAction(stepId: string): string | null {
  const actions: Record<string, string> = {
    setup_repository: '重新配置仓库',
    commit_to_git: '检查 Git 权限',
    create_gitops_resources: '查看 Flux 日志',
    sync_gitops: '手动触发同步',
  }
  return actions[stepId] || '重试'
}

// 处理建议操作
function handleSuggestedAction(step: any) {
  toast.info('功能开发中', `${step.suggestedAction} 功能即将推出`)
}

// 重试初始化
async function handleRetry() {
  try {
    // 重置状态
    status.value = 'initializing'
    progress.value = 0
    errorMessage.value = null
    initSteps.value = INIT_STEPS.map(step => ({
      ...step,
      status: 'pending' as 'pending' | 'running' | 'completed' | 'failed',
      error: null,
      suggestedAction: null,
    }))

    // TODO: 调用后端 API 重试初始化
    // await trpc.projects.retryInitialization.mutate({ projectId: props.projectId })

    // 重新开始轮询
    startPolling()

    toast.info('重试初始化', '正在重新初始化项目...')
  } catch (error: any) {
    toast.error('重试失败', error.message)
  }
}

// 查看日志
function handleViewLogs() {
  toast.info('功能开发中', '日志查看功能即将推出')
}

// 开始轮询
function startPolling() {
  // 立即执行一次
  pollProjectStatus()

  // 每 2 秒轮询一次
  pollingInterval.value = setInterval(() => {
    pollProjectStatus()
  }, 2000)
}

// 停止轮询
function stopPolling() {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value)
    pollingInterval.value = null
  }
}

onMounted(() => {
  if (props.projectId) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>
