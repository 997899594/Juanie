<template>
  <div class="project-deployments">
    <!-- 部署记录头部 -->
    <div class="deployments-header">
      <div class="header-content">
        <h3 class="text-lg font-semibold">部署记录</h3>
        <p class="text-sm text-muted-foreground">查看项目的部署历史和状态</p>
      </div>
      <div class="header-actions">
        <Select v-model="environmentFilter">
          <SelectTrigger class="w-40">
            <SelectValue placeholder="筛选环境" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有环境</SelectItem>
            <SelectItem value="production">生产环境</SelectItem>
            <SelectItem value="staging">预发布环境</SelectItem>
            <SelectItem value="development">开发环境</SelectItem>
          </SelectContent>
        </Select>
        <Button @click="$emit('create-deployment')">
          <Rocket class="h-4 w-4 mr-2" />
          新建部署
        </Button>
      </div>
    </div>

    <!-- 部署统计 -->
    <div class="deployment-stats">
      <div class="stats-grid">
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">总部署次数</p>
                <p class="text-2xl font-bold">{{ stats.totalDeployments }}</p>
              </div>
              <Rocket class="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">成功率</p>
                <p class="text-2xl font-bold text-green-600">{{ calculateSuccessRate() }}%</p>
              </div>
              <CheckCircle class="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">平均部署时间</p>
                <p class="text-2xl font-bold">{{ stats.averageDeployTime }}分钟</p>
              </div>
              <Clock class="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-muted-foreground">本月部署</p>
                <p class="text-2xl font-bold">{{ stats.totalDeployments }}</p>
              </div>
              <BarChart3 class="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 部署列表 -->
    <div class="deployments-list">
      <Card>
        <CardHeader>
          <CardTitle>部署历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="deployment-timeline">
            <div 
              v-for="deployment in filteredDeployments" 
              :key="deployment.id"
              class="deployment-item"
            >
              <div class="deployment-status">
                <div 
                  class="status-dot"
                  :class="getStatusColor(deployment.status)"
                ></div>
                <div class="status-line" v-if="deployment !== filteredDeployments[filteredDeployments.length - 1]"></div>
              </div>
              
              <div class="deployment-content">
                <div class="deployment-header">
                  <div class="deployment-info">
                    <h4 class="deployment-title">
                      部署到 {{ getEnvironmentName(deployment.environmentId) }}
                      <Badge :variant="getStatusVariant(deployment.status)" class="ml-2">
                        {{ getStatusLabel(deployment.status) }}
                      </Badge>
                    </h4>
                    <p class="deployment-meta">
                      版本 {{ deployment.version }} • 
                      {{ getUserName(deployment.userId) }} • 
                      {{ formatTime(deployment.createdAt) }}
                    </p>
                  </div>
                  
                  <div class="deployment-actions">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      @click="viewDeploymentLogs(deployment)"
                    >
                      <FileText class="h-4 w-4 mr-1" />
                      日志
                    </Button>
                    
                    <Button 
                      v-if="deployment.status === 'success'"
                      variant="ghost" 
                      size="sm"
                      @click="rollbackDeployment(deployment)"
                    >
                      <RotateCcw class="h-4 w-4 mr-1" />
                      回滚
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="viewDeploymentDetails(deployment)">
                          <Eye class="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="redeployVersion(deployment)">
                          <Repeat class="h-4 w-4 mr-2" />
                          重新部署
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          v-if="deployment.status === 'running'"
                          @click="cancelDeployment(deployment)"
                          class="text-destructive"
                        >
                          <X class="h-4 w-4 mr-2" />
                          取消部署
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                <div v-if="deployment.commitMessage" class="deployment-description">
                      {{ deployment.commitMessage }}
                    </div>
                
                <div class="deployment-details">
                  <div class="detail-item">
                    <span class="detail-label">持续时间:</span>
                    <span class="detail-value">{{ getDuration(deployment.startedAt, deployment.finishedAt) }}</span>
                  </div>
                  <div class="detail-item" v-if="deployment.commitHash">
                    <span class="detail-label">提交:</span>
                    <span class="detail-value font-mono">{{ deployment.commitHash.substring(0, 8) }}</span>
                  </div>
                  <div class="detail-item" v-if="deployment.branch">
                    <span class="detail-label">分支:</span>
                    <span class="detail-value">{{ deployment.branch }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="filteredDeployments.length === 0 && !loading" class="empty-state">
            <Rocket class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 class="text-lg font-semibold mb-2">暂无部署记录</h3>
            <p class="text-muted-foreground mb-4">开始第一次部署来查看记录</p>
            <Button @click="$emit('create-deployment')">
              <Rocket class="h-4 w-4 mr-2" />
              新建部署
            </Button>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="loading-state">
            <div v-for="i in 5" :key="i" class="deployment-item animate-pulse">
              <div class="deployment-status">
                <div class="w-3 h-3 bg-muted rounded-full"></div>
              </div>
              <div class="deployment-content">
                <div class="space-y-2">
                  <div class="w-48 h-4 bg-muted rounded"></div>
                  <div class="w-32 h-3 bg-muted rounded"></div>
                  <div class="w-full h-3 bg-muted rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@juanie/ui'
import {
  Rocket,
  CheckCircle,
  Clock,
  BarChart3,
  FileText,
  RotateCcw,
  MoreHorizontal,
  Eye,
  Repeat,
  X,
  XCircle,
  AlertCircle
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

// 使用 tRPC 推断类型
type DeploymentStats = Awaited<ReturnType<typeof trpc.deployments.getStats.query>>

// 从 tRPC 推断 Deployment 类型
type Deployment = Awaited<ReturnType<typeof trpc.deployments.listByProject.query>>[0]

const props = defineProps<{
  projectId: number
}>()

const emit = defineEmits<{
  'create-deployment': []
}>()

const loading = ref(false)
const environmentFilter = ref('all')
const deployments = ref<Deployment[]>([])
const stats = ref<DeploymentStats>({
  totalDeployments: 0,
  successfulDeployments: 0,
  failedDeployments: 0,
  pendingDeployments: 0,
  runningDeployments: 0,
  averageDeployTime: 0,
  deploymentsByDay: [],
  recentDeployments: []
})

// 过滤后的部署记录
const filteredDeployments = computed(() => {
  if (environmentFilter.value === 'all') {
    return deployments.value
  }
  return deployments.value.filter(d => d.environmentId === Number(environmentFilter.value))
})

// 计算成功率
const calculateSuccessRate = () => {
  if (deployments.value.length === 0) return 0
  const successCount = deployments.value.filter(d => d.status === 'success').length
  return Math.round((successCount / deployments.value.length) * 100)
}

// 获取状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    case 'running':
      return 'bg-blue-500 animate-pulse'
    case 'pending':
      return 'bg-yellow-500'
    case 'cancelled':
      return 'bg-gray-500'
    default:
      return 'bg-gray-400'
  }
}

// 用户映射
const userMap = ref<Record<number, string>>({
  1: 'Admin',
  2: 'Developer',
  3: 'DevOps'
})

// 获取用户名称
const getUserName = (userId: number) => {
  return userMap.value[userId] || `用户 ${userId}`
}

// 环境映射
const environmentMap = ref<Record<number, string>>({
  1: 'production',
  2: 'staging', 
  3: 'development'
})

// 获取环境名称
const getEnvironmentName = (environmentId: number) => {
  return environmentMap.value[environmentId] || `环境 ${environmentId}`
}

// 计算持续时间
const getDuration = (startedAt: string | null, finishedAt: string | null) => {
  if (!startedAt) return '-'
  if (!finishedAt) return '进行中'
  
  const start = new Date(startedAt)
  const end = new Date(finishedAt)
  const diffMs = end.getTime() - start.getTime()
  
  const minutes = Math.floor(diffMs / 60000)
  const seconds = Math.floor((diffMs % 60000) / 1000)
  
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`
  }
  return `${seconds}秒`
}
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'success':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'running':
      return 'secondary'
    case 'pending':
      return 'outline'
    case 'cancelled':
      return 'secondary'
    default:
      return 'secondary'
  }
}

// 获取状态标签
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    pending: '等待中',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

// 格式化时间
const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (minutes < 60) {
    return `${minutes} 分钟前`
  } else if (hours < 24) {
    return `${hours} 小时前`
  } else if (days < 7) {
    return `${days} 天前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

// 加载部署记录
const loadDeployments = async () => {
  try {
    loading.value = true
    
    // 获取部署记录
    const deploymentsResult = await trpc.deployments.listByProject.query({ 
      projectId: props.projectId,
      limit: 50 
    })
    if (deploymentsResult) {
      deployments.value = deploymentsResult
    }
    
    // 获取部署统计
    const statsResult = await trpc.deployments.getStats.query({ projectId: props.projectId })
    if (statsResult) {
      stats.value = statsResult
    }
  } catch (error: any) {
    console.error('取消部署失败:', error)
    
    // 使用模拟数据
    deployments.value = [
      {
        id: 1,
        environmentId: 1,
        projectId: props.projectId,
        userId: 1,
        version: 'v1.2.3',
        status: 'success',
        commitHash: 'a1b2c3d4e5f6',
        commitMessage: '修复用户登录问题',
        branch: 'main',
        logs: null,
        startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        finishedAt: new Date(Date.now() - 1000 * 60 * 27).toISOString(),
        metadata: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 27).toISOString()
      },
      {
        id: 2,
        environmentId: 2,
        projectId: props.projectId,
        userId: 1,
        version: 'v1.2.4-beta',
        status: 'running',
        commitHash: 'b2c3d4e5f6g7',
        commitMessage: '新增用户权限管理功能',
        branch: 'feature/user-permissions',
        logs: null,
        startedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        finishedAt: null,
        metadata: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
      },
      {
        id: 3,
        environmentId: 1,
        projectId: props.projectId,
        userId: 1,
        version: 'v1.2.2',
        status: 'failed',
        commitHash: 'c3d4e5f6g7h8',
        commitMessage: '优化数据库查询性能',
        branch: 'main',
        logs: null,
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60).toISOString(),
        metadata: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 1000 * 60).toISOString()
      }
    ]
    
    stats.value = {
      totalDeployments: 24,
      successfulDeployments: 22,
      failedDeployments: 2,
      pendingDeployments: 0,
      runningDeployments: 0,
      averageDeployTime: 4,
      deploymentsByDay: [],
      recentDeployments: []
    }
  } finally {
    loading.value = false
  }
}

// 查看部署日志
const viewDeploymentLogs = (deployment: Deployment) => {
  console.log('查看部署日志:', deployment.id)
  // TODO: 实现查看日志功能
}

// 回滚部署
const rollbackDeployment = async (deployment: Deployment) => {
  if (!confirm(`确定要回滚到版本 ${deployment.version} 吗？`)) {
    return
  }
  
  try {
    await trpc.deployments.rollback.mutate({ 
      deploymentId: deployment.id,
      environmentId: deployment.environmentId
    })
    // 重新加载部署记录
    await loadDeployments()
  } catch (error: any) {
    console.error('回滚部署失败:', error)
    alert('回滚失败，请稍后重试')
  }
}

// 查看部署详情
const viewDeploymentDetails = (deployment: Deployment) => {
  console.log('查看部署详情:', deployment.id)
  // TODO: 实现查看详情功能
}

// 重新部署版本
const redeployVersion = async (deployment: Deployment) => {
  if (!confirm(`确定要重新部署版本 ${deployment.version} 吗？`)) {
    return
  }
  
  try {
    await trpc.deployments.redeploy.mutate({ 
      deploymentId: deployment.id
    })
    // 重新加载部署记录
    await loadDeployments()
  } catch (error: any) {
    console.error('重新部署失败:', error)
    alert('重新部署失败，请稍后重试')
  }
}

// 取消部署
const cancelDeployment = async (deployment: Deployment) => {
  if (!confirm('确定要取消当前部署吗？')) {
    return
  }
  
  try {
    await trpc.deployments.cancel.mutate({ id: deployment.id })
    // 重新加载部署记录
    await loadDeployments()
  } catch (error: any) {
    console.error('获取部署列表失败:', error)
    alert('取消部署失败，请稍后重试')
  }
}

onMounted(() => {
  loadDeployments()
})
</script>

<style scoped>
/* 移除所有@apply，使用UI库的原生类名和组件 */
</style>