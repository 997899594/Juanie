<template>
  <PageContainer>
    <template #header>
      <div class="flex items-center space-x-4">
        <Button variant="ghost" size="icon" @click="router.back()">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-3xl font-bold">部署详情</h1>
          <p class="text-muted-foreground mt-1">查看部署信息和审批状态</p>
        </div>
      </div>
    </template>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error state -->
    <Card v-else-if="error">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <AlertCircle class="h-12 w-12 text-destructive mb-4" />
        <h3 class="text-lg font-semibold mb-2">加载失败</h3>
        <p class="text-sm text-muted-foreground mb-4">{{ error }}</p>
        <Button @click="loadDeployment">重试</Button>
      </CardContent>
    </Card>

    <!-- Content -->
    <div v-else-if="currentDeployment" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Deployment info card -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>部署信息</CardTitle>
              <DeploymentStatusBadge :status="currentDeployment.status" />
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <Label class="text-muted-foreground">版本</Label>
                <p class="font-medium">{{ currentDeployment.version }}</p>
              </div>
              <div>
                <Label class="text-muted-foreground">环境</Label>
                <p class="font-medium">{{ currentDeployment.environmentId }}</p>
              </div>
              <div>
                <Label class="text-muted-foreground">提交哈希</Label>
                <p class="font-mono text-sm">{{ currentDeployment.commitHash ? currentDeployment.commitHash.substring(0, 8) : 'N/A' }}</p>
              </div>
              <div>
                <Label class="text-muted-foreground">分支</Label>
                <p class="font-medium">{{ currentDeployment.branch }}</p>
              </div>
              <div>
                <Label class="text-muted-foreground">部署策略</Label>
                <p class="font-medium">{{ getStrategyText(currentDeployment.strategy || 'rolling-update') }}</p>
              </div>
              <div>
                <Label class="text-muted-foreground">部署人</Label>
                <p class="font-medium">{{ currentDeployment.deployedBy || 'N/A' }}</p>
              </div>
              <div>
                <Label class="text-muted-foreground">创建时间</Label>
                <p class="text-sm">{{ formatDate(currentDeployment.createdAt) }}</p>
              </div>
              <div v-if="currentDeployment.finishedAt">
                <Label class="text-muted-foreground">完成时间</Label>
                <p class="text-sm">{{ formatDate(currentDeployment.finishedAt) }}</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-2 pt-4 border-t">
              <Button
                v-if="currentDeployment.status === 'success'"
                variant="outline"
                :disabled="loading"
                @click="handleRollback"
              >
                <RotateCcw class="mr-2 h-4 w-4" />
                回滚部署
              </Button>
              <Button
                v-if="currentDeployment.status === 'failed'"
                variant="outline"
                :disabled="loading"
                @click="handleRetry"
              >
                <RefreshCw class="mr-2 h-4 w-4" />
                重新部署
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Timeline -->
        <Card>
          <CardContent class="pt-6">
            <DeploymentTimeline :deployment="currentDeployment" :approvals="deploymentApprovals" />
          </CardContent>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Approval card -->
        <DeploymentApprovalCard
          :deployment-id="currentDeployment.id"
          :approvals="deploymentApprovals"
          :current-user-id="currentUserId"
          :loading="loading"
          @approve="handleApprove"
          @reject="handleReject"
        />

        <!-- Metadata card -->
        <Card>
          <CardHeader>
            <CardTitle>元数据</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div>
              <Label class="text-muted-foreground">部署 ID</Label>
              <p class="font-mono text-xs break-all">{{ currentDeployment.id }}</p>
            </div>
            <div>
              <Label class="text-muted-foreground">项目 ID</Label>
              <p class="font-mono text-xs break-all">{{ currentDeployment.projectId }}</p>
            </div>
            <div v-if="currentDeployment.startedAt">
              <Label class="text-muted-foreground">开始时间</Label>
              <p class="text-xs">{{ formatDate(currentDeployment.startedAt) }}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDeployments } from '@/composables/useDeployments'
import { useAuthStore } from '@/stores/auth'
import DeploymentStatusBadge from '@/components/DeploymentStatusBadge.vue'
import DeploymentTimeline from '@/components/DeploymentTimeline.vue'
import DeploymentApprovalCard from '@/components/DeploymentApprovalCard.vue'
import PageContainer from '@/components/PageContainer.vue'
import { Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label , log } from '@juanie/ui'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RotateCcw,
  RefreshCw,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const {
  currentDeployment,
  loading,
  error,
  fetchDeployment,
  approveDeployment,
  rejectDeployment,
  rollbackDeployment,
} = useDeployments()

const deploymentId = computed(() => route.params.id as string)
const currentUserId = computed(() => authStore.user?.id)

// Mock approvals data - in real app, this would come from API
const deploymentApprovals = ref<any[]>([])

onMounted(async () => {
  await loadDeployment()
})

const loadDeployment = async () => {
  if (!deploymentId.value) return

  try {
    await fetchDeployment(deploymentId.value)
    // TODO: Fetch approvals from API
    // For now, using mock data
    deploymentApprovals.value = []
  } catch (err) {
    log.error('Failed to load deployment:', err)
  }
}

const handleApprove = async (comment?: string) => {
  if (!deploymentId.value) return

  try {
    await approveDeployment(deploymentId.value, comment)
    await loadDeployment()
  } catch (err) {
    log.error('Failed to approve deployment:', err)
  }
}

const handleReject = async (reason: string) => {
  if (!deploymentId.value) return

  try {
    await rejectDeployment(deploymentId.value, reason)
    await loadDeployment()
  } catch (err) {
    log.error('Failed to reject deployment:', err)
  }
}

const handleRollback = async () => {
  if (!deploymentId.value) return

  try {
    await rollbackDeployment(deploymentId.value)
    router.push('/deployments')
  } catch (err) {
    log.error('Failed to rollback deployment:', err)
  }
}

const handleRetry = () => {
  // TODO: Implement retry logic
  log.info('Retry deployment')
}

const getStrategyText = (strategy: string) => {
  const strategyMap: Record<string, string> = {
    'rolling-update': '滚动更新',
    'blue-green': '蓝绿部署',
    canary: '金丝雀发布',
    recreate: '重建部署',
  }
  return strategyMap[strategy] || strategy
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>
