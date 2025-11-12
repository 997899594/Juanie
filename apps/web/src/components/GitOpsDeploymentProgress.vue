<template>
  <div class="space-y-6">
    <!-- 进度标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">部署进度</h3>
        <p class="text-sm text-muted-foreground">
          {{ deployment?.version || 'Unknown' }}
        </p>
      </div>
      <Badge :variant="statusVariant">
        {{ statusText }}
      </Badge>
    </div>

    <!-- 4 步流程 -->
    <div class="space-y-4">
      <!-- Step 1: Git Commit -->
      <div class="flex gap-4">
        <div class="flex flex-col items-center">
          <div
            :class="[
              'flex h-10 w-10 items-center justify-center rounded-full border-2',
              getStepClass(1),
            ]"
          >
            <GitCommit v-if="currentStep >= 1" class="h-5 w-5" />
            <Loader2 v-else class="h-5 w-5 animate-spin" />
          </div>
          <div
            v-if="currentStep > 1"
            :class="[
              'w-0.5 flex-1 mt-2',
              currentStep > 1 ? 'bg-primary' : 'bg-muted',
            ]"
            style="min-height: 40px"
          />
        </div>
        <div class="flex-1 pb-8">
          <div class="flex items-center justify-between">
            <h4 class="font-medium">Git Commit</h4>
            <span v-if="steps.commit.timestamp" class="text-xs text-muted-foreground">
              {{ formatTime(steps.commit.timestamp) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            {{ steps.commit.message || '配置变更已提交到 Git 仓库' }}
          </p>
          <div v-if="steps.commit.commitSha" class="mt-2">
            <code class="text-xs bg-muted px-2 py-1 rounded">
              {{ steps.commit.commitSha.substring(0, 8) }}
            </code>
          </div>
          <div v-if="steps.commit.error" class="mt-2">
            <Alert variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>{{ steps.commit.error }}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      <!-- Step 2: Flux Sync -->
      <div class="flex gap-4">
        <div class="flex flex-col items-center">
          <div
            :class="[
              'flex h-10 w-10 items-center justify-center rounded-full border-2',
              getStepClass(2),
            ]"
          >
            <GitBranch v-if="currentStep >= 2" class="h-5 w-5" />
            <Loader2 v-else-if="currentStep === 1" class="h-5 w-5 animate-spin" />
            <div v-else class="h-5 w-5" />
          </div>
          <div
            v-if="currentStep > 2"
            :class="[
              'w-0.5 flex-1 mt-2',
              currentStep > 2 ? 'bg-primary' : 'bg-muted',
            ]"
            style="min-height: 40px"
          />
        </div>
        <div class="flex-1 pb-8">
          <div class="flex items-center justify-between">
            <h4 class="font-medium">Flux 同步</h4>
            <span v-if="steps.flux.timestamp" class="text-xs text-muted-foreground">
              {{ formatTime(steps.flux.timestamp) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            {{ steps.flux.message || 'Flux 正在检测 Git 变更并同步配置' }}
          </p>
          <div v-if="steps.flux.error" class="mt-2">
            <Alert variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>{{ steps.flux.error }}</AlertDescription>
            </Alert>
            <Button
              v-if="allowRetry"
              variant="outline"
              size="sm"
              class="mt-2"
              @click="handleRetry"
            >
              <RefreshCw class="h-4 w-4 mr-1" />
              重试
            </Button>
          </div>
        </div>
      </div>

      <!-- Step 3: K8s Apply -->
      <div class="flex gap-4">
        <div class="flex flex-col items-center">
          <div
            :class="[
              'flex h-10 w-10 items-center justify-center rounded-full border-2',
              getStepClass(3),
            ]"
          >
            <Box v-if="currentStep >= 3" class="h-5 w-5" />
            <Loader2 v-else-if="currentStep === 2" class="h-5 w-5 animate-spin" />
            <div v-else class="h-5 w-5" />
          </div>
          <div
            v-if="currentStep > 3"
            :class="[
              'w-0.5 flex-1 mt-2',
              currentStep > 3 ? 'bg-primary' : 'bg-muted',
            ]"
            style="min-height: 40px"
          />
        </div>
        <div class="flex-1 pb-8">
          <div class="flex items-center justify-between">
            <h4 class="font-medium">K8s 应用</h4>
            <span v-if="steps.k8s.timestamp" class="text-xs text-muted-foreground">
              {{ formatTime(steps.k8s.timestamp) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            {{ steps.k8s.message || 'Kubernetes 正在应用配置到集群' }}
          </p>
          <div v-if="steps.k8s.error" class="mt-2">
            <Alert variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>{{ steps.k8s.error }}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      <!-- Step 4: Health Check -->
      <div class="flex gap-4">
        <div class="flex flex-col items-center">
          <div
            :class="[
              'flex h-10 w-10 items-center justify-center rounded-full border-2',
              getStepClass(4),
            ]"
          >
            <CheckCircle2 v-if="currentStep >= 4" class="h-5 w-5" />
            <Loader2 v-else-if="currentStep === 3" class="h-5 w-5 animate-spin" />
            <div v-else class="h-5 w-5" />
          </div>
        </div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <h4 class="font-medium">健康检查</h4>
            <span v-if="steps.health.timestamp" class="text-xs text-muted-foreground">
              {{ formatTime(steps.health.timestamp) }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground mt-1">
            {{ steps.health.message || '等待 Pod 就绪并通过健康检查' }}
          </p>
          <div v-if="steps.health.error" class="mt-2">
            <Alert variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>{{ steps.health.error }}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="showActions" class="flex gap-2 justify-end pt-4 border-t">
      <Button
        v-if="canRetry"
        variant="outline"
        @click="handleRetry"
      >
        <RefreshCw class="h-4 w-4 mr-1" />
        重试
      </Button>
      <Button
        v-if="isComplete"
        @click="handleClose"
      >
        完成
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Badge,
  Button,
  Alert,
  AlertDescription,
} from '@juanie/ui'
import {
  GitCommit,
  GitBranch,
  Box,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Props {
  deploymentId: string
  autoRefresh?: boolean
  refreshInterval?: number
  showActions?: boolean
  allowRetry?: boolean
}

interface DeploymentStep {
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  error?: string
  timestamp?: Date
  commitSha?: string
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true,
  refreshInterval: 5000, // 5 seconds
  showActions: true,
  allowRetry: true,
})

const emit = defineEmits<{
  retry: []
  close: []
  complete: []
}>()

const deployment = ref<any>(null)
const currentStep = ref(0)
const steps = ref({
  commit: {
    status: 'pending',
    message: '',
    error: '',
    timestamp: undefined,
    commitSha: '',
  } as DeploymentStep,
  flux: {
    status: 'pending',
    message: '',
    error: '',
    timestamp: undefined,
  } as DeploymentStep,
  k8s: {
    status: 'pending',
    message: '',
    error: '',
    timestamp: undefined,
  } as DeploymentStep,
  health: {
    status: 'pending',
    message: '',
    error: '',
    timestamp: undefined,
  } as DeploymentStep,
})

let refreshTimer: NodeJS.Timeout | null = null

// 状态计算
const statusVariant = computed(() => {
  if (currentStep.value === 4 && steps.value.health.status === 'success') {
    return 'default' // success
  }
  if (Object.values(steps.value).some(s => s.status === 'error')) {
    return 'destructive'
  }
  return 'secondary'
})

const statusText = computed(() => {
  if (currentStep.value === 4 && steps.value.health.status === 'success') {
    return '部署成功'
  }
  if (Object.values(steps.value).some(s => s.status === 'error')) {
    return '部署失败'
  }
  if (currentStep.value === 0) {
    return '准备中'
  }
  return '部署中'
})

const isComplete = computed(() => {
  return currentStep.value === 4 && steps.value.health.status === 'success'
})

const canRetry = computed(() => {
  return Object.values(steps.value).some(s => s.status === 'error')
})

// 获取步骤样式
const getStepClass = (step: number) => {
  const stepData = Object.values(steps.value)[step - 1]
  
  if (stepData.status === 'success') {
    return 'border-primary bg-primary text-primary-foreground'
  }
  if (stepData.status === 'error') {
    return 'border-destructive bg-destructive text-destructive-foreground'
  }
  if (stepData.status === 'running') {
    return 'border-primary bg-background text-primary'
  }
  return 'border-muted bg-background text-muted-foreground'
}

// 格式化时间
const formatTime = (date?: Date) => {
  if (!date) return ''
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: zhCN,
  })
}

// 加载部署状态
const loadDeploymentStatus = async () => {
  try {
    const result = await trpc.deployments.get.query({
      deploymentId: props.deploymentId,
    })
    
    deployment.value = result
    updateStepsFromDeployment(result)
  } catch (error) {
    console.error('Failed to load deployment status:', error)
  }
}

// 从部署数据更新步骤状态
const updateStepsFromDeployment = (dep: any) => {
  // Step 1: Git Commit
  if (dep.gitCommitSha) {
    steps.value.commit.status = 'success'
    steps.value.commit.commitSha = dep.gitCommitSha
    steps.value.commit.timestamp = dep.createdAt
    currentStep.value = Math.max(currentStep.value, 1)
  }
  
  // Step 2-4: 根据部署状态判断
  const status = dep.status
  
  if (status === 'pending') {
    steps.value.commit.status = 'running'
    currentStep.value = 0
  } else if (status === 'running') {
    steps.value.commit.status = 'success'
    steps.value.flux.status = 'running'
    steps.value.flux.message = 'Flux 正在同步配置'
    currentStep.value = Math.max(currentStep.value, 1)
  } else if (status === 'deploying') {
    steps.value.commit.status = 'success'
    steps.value.flux.status = 'success'
    steps.value.k8s.status = 'running'
    steps.value.k8s.message = 'Kubernetes 正在应用配置'
    currentStep.value = Math.max(currentStep.value, 2)
  } else if (status === 'verifying') {
    steps.value.commit.status = 'success'
    steps.value.flux.status = 'success'
    steps.value.k8s.status = 'success'
    steps.value.health.status = 'running'
    steps.value.health.message = '正在进行健康检查'
    currentStep.value = Math.max(currentStep.value, 3)
  } else if (status === 'success') {
    steps.value.commit.status = 'success'
    steps.value.flux.status = 'success'
    steps.value.k8s.status = 'success'
    steps.value.health.status = 'success'
    steps.value.health.message = '部署成功，所有 Pod 运行正常'
    steps.value.health.timestamp = dep.finishedAt
    currentStep.value = 4
    
    emit('complete')
    stopAutoRefresh()
  } else if (status === 'failed') {
    // 根据失败阶段设置错误
    if (!dep.gitCommitSha) {
      steps.value.commit.status = 'error'
      steps.value.commit.error = 'Git commit 失败'
    } else {
      steps.value.commit.status = 'success'
      steps.value.flux.status = 'error'
      steps.value.flux.error = dep.errorMessage || 'Flux 同步失败'
    }
    
    stopAutoRefresh()
  }
}

// 开始自动刷新
const startAutoRefresh = () => {
  if (!props.autoRefresh) return
  
  refreshTimer = setInterval(() => {
    loadDeploymentStatus()
  }, props.refreshInterval)
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 处理重试
const handleRetry = () => {
  emit('retry')
}

// 处理关闭
const handleClose = () => {
  emit('close')
}

// 生命周期
onMounted(() => {
  loadDeploymentStatus()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

// 监听 deploymentId 变化
watch(() => props.deploymentId, () => {
  loadDeploymentStatus()
  startAutoRefresh()
})
</script>
