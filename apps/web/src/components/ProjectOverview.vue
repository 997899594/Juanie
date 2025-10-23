<template>
  <div class="space-y-6">
    <!-- 项目统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">总环境数</CardTitle>
          <Activity class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalEnvironments }}</div>
          <p class="text-xs text-muted-foreground">
            环境总数
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">总部署次数</CardTitle>
          <Rocket class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalDeployments }}</div>
          <p class="text-xs text-muted-foreground">
            部署总数
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">成功率</CardTitle>
          <BarChart3 class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ calculateSuccessRate(stats) }}%</div>
          <p class="text-xs text-muted-foreground">
            基于部署成功率计算
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">活跃成员</CardTitle>
          <User class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">1</div>
          <p class="text-xs text-muted-foreground">
            项目成员
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- 最近活动 -->
    <div class="mt-6">
      <Card>
        <CardHeader>
          <CardTitle>最近活动</CardTitle>
          <CardDescription>项目的最新动态和部署记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div 
            v-for="activity in recentActivities" 
            :key="activity.id"
            class="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div class="activity-icon">
              <component 
                :is="getActivityIcon(activity.type)" 
                class="h-4 w-4"
                :class="getActivityIconColor(activity.type)"
              />
            </div>
            <div class="activity-content">
              <div class="activity-title">{{ activity.title }}</div>
              <div class="activity-description">{{ activity.description }}</div>
              <div class="activity-time">{{ formatTime(activity.timestamp) }}</div>
            </div>
            <div class="activity-status">
              <Badge :variant="getStatusVariant(activity.metadata?.status || 'pending')">
                {{ activity.metadata?.status || 'pending' }}
              </Badge>
            </div>
          </div>
          </div>

          <div v-if="recentActivities.length === 0" class="empty-state">
            <Activity class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p class="text-muted-foreground text-center">暂无活动记录</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 快速操作 -->
    <div class="quick-actions">
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>常用的项目操作</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="actions-grid">
            <Button 
              variant="outline" 
              class="action-button"
              @click="$emit('create-environment')"
            >
              <Plus class="h-4 w-4 mr-2" />
              新建环境
            </Button>
            
            <Button 
              variant="outline" 
              class="action-button"
              @click="$emit('create-deployment')"
            >
              <Rocket class="h-4 w-4 mr-2" />
              新建部署
            </Button>
            
            <Button 
              variant="outline" 
              class="action-button"
              @click="$emit('view-logs')"
            >
              <FileText class="h-4 w-4 mr-2" />
              查看日志
            </Button>
            
            <Button 
              variant="outline" 
              class="action-button"
              @click="$emit('manage-members')"
            >
              <User class="h-4 w-4 mr-2" />
              成员管理
            </Button>
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
  CardDescription, 
  CardHeader, 
  CardTitle,
  Button,
  Badge
} from '@juanie/ui'
import { 
  Activity, 
  Rocket, 
  BarChart3, 
  User, 
  Plus, 
  FileText,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Settings
} from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

// 直接使用 tRPC 推断类型
type ProjectStats = Awaited<ReturnType<typeof trpc.projects.getStats.query>>
type RecentActivity = Awaited<ReturnType<typeof trpc.projects.getRecentActivities.query>>[0]

const props = defineProps<{
  projectId: number
}>()

const emit = defineEmits<{
  'create-environment': []
  'create-deployment': []
  'view-logs': []
  'manage-members': []
}>()

const loading = ref(false)
const stats = ref<ProjectStats>({
  totalDeployments: 0,
  successfulDeployments: 0,
  failedDeployments: 0,
  totalEnvironments: 0,
  lastDeployment: null
})

// 计算成功率
const calculateSuccessRate = (stats: ProjectStats) => {
  if (stats.totalDeployments === 0) return 0
  return Math.round((stats.successfulDeployments / stats.totalDeployments) * 100)
}

const recentActivities = ref<RecentActivity[]>([])

// 获取活动图标
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'deployment':
      return Rocket
    case 'environment':
      return Activity
    case 'member':
      return User
    case 'settings':
      return Settings
    default:
      return Activity
  }
}

// 获取活动图标颜色
const getActivityIconColor = (type: string) => {
  switch (type) {
    case 'deployment':
      return 'text-blue-500'
    case 'environment':
      return 'text-green-500'
    case 'member':
      return 'text-purple-500'
    case 'settings':
      return 'text-gray-500'
    default:
      return 'text-gray-500'
  }
}

// 获取状态变体
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'success':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'pending':
      return 'secondary'
    case 'running':
      return 'outline'
    default:
      return 'secondary'
  }
}

// 格式化时间
const formatTime = (timestamp: Date | string) => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 1000 * 60) {
    return '刚刚'
  } else if (diff < 1000 * 60 * 60) {
    return `${Math.floor(diff / (1000 * 60))}分钟前`
  } else if (diff < 1000 * 60 * 60 * 24) {
    return `${Math.floor(diff / (1000 * 60 * 60))}小时前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

// 加载项目统计数据
const loadProjectStats = async () => {
  try {
    loading.value = true
    
    // 获取项目统计
    const statsResult = await trpc.projects.getStats.query({ projectId: props.projectId })
    if (statsResult) {
      stats.value = statsResult
    }
    
    // 获取最近活动
    const activitiesResult = await trpc.projects.getRecentActivities.query({ 
      projectId: props.projectId,
      limit: 10 
    })
    if (activitiesResult) {
      recentActivities.value = activitiesResult
    }
  } catch (error: any) {
    console.error('获取项目统计失败:', error)
    
    // 使用模拟数据
    stats.value = {
      totalDeployments: 24,
      successfulDeployments: 22,
      failedDeployments: 2,
      totalEnvironments: 3,
      lastDeployment: {
        id: 1,
        version: 'v1.2.3',
        status: 'success',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        environment: {
          name: 'production',
          displayName: '生产环境'
        },
        user: {
          name: '张三'
        }
      }
    }
    
    recentActivities.value = [
      {
        id: 1,
        type: 'deployment' as const,
        title: '生产环境部署',
        description: '部署版本 v1.2.3 到生产环境',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        user: { name: '张三', image: null },
        metadata: { version: 'v1.2.3', status: 'success', environment: 'production' }
      },
      {
        id: 2,
        type: 'deployment' as const,
        title: '新建测试环境',
        description: '创建了新的测试环境 test-v2',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        user: { name: '李四', image: null },
        metadata: { version: null, status: 'success', environment: 'test-v2' }
      }
    ]
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProjectStats()
})
</script>

<style scoped>
/* 移除所有@apply，使用UI库的原生类名和组件 */
</style>