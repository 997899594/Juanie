<template>
  <div class="space-y-6">
    <!-- 项目统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">环境数量</CardTitle>
          <Activity class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ projectStats.totalEnvironments }}</div>
          <p class="text-xs text-muted-foreground">
            项目环境总数
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">部署次数</CardTitle>
          <Rocket class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ projectStats.totalDeployments }}</div>
          <p class="text-xs text-muted-foreground">
            总部署次数
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">成功率</CardTitle>
          <BarChart3 class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ projectStats.successRate }}%</div>
          <p class="text-xs text-muted-foreground">
            部署成功率
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">项目成员</CardTitle>
          <User class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ projectStats.totalMembers }}</div>
          <p class="text-xs text-muted-foreground">
            活跃成员数
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
              <div class="activity-time">{{ formatTime(activity.createdAt) }}</div>
            </div>
            <div class="activity-status">
              <Badge :variant="getStatusVariant(activity.status)">
                {{ activity.status }}
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

// 定义项目统计数据类型
interface ProjectStats {
  totalEnvironments: number
  totalDeployments: number
  successRate: number
  totalMembers: number
}

// 定义最近活动类型
type RecentActivitiesResponse = Awaited<ReturnType<typeof trpc.projects.getRecentActivities.query>>
type RecentActivity = RecentActivitiesResponse['activities'][0]

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  'create-environment': []
  'create-deployment': []
  'view-logs': []
  'manage-members': []
}>()

const loading = ref(false)
const projectStats = ref<ProjectStats>({
  totalEnvironments: 0,
  totalDeployments: 0,
  successRate: 0,
  totalMembers: 0
})

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
    
    // 并行获取多个数据源
    const [environmentsResult, deploymentsResult, activitiesResult] = await Promise.allSettled([
      // 获取项目环境列表
      trpc.environments.listByProject.query({ projectId: props.projectId }),
      // 获取项目部署统计
      trpc.deployments.getStats.query({ projectId: props.projectId }),
      // 获取最近活动
      trpc.projects.getRecentActivities.query({ 
        projectId: props.projectId,
        limit: 10
      })
    ])
    
    // 处理环境数据
    let totalEnvironments = 0
    if (environmentsResult.status === 'fulfilled' && environmentsResult.value) {
      totalEnvironments = environmentsResult.value.environments.length
    }
    
    // 处理部署统计数据
    let totalDeployments = 0
    let successRate = 0
    if (deploymentsResult.status === 'fulfilled' && deploymentsResult.value) {
      const deploymentStats = deploymentsResult.value
      totalDeployments = deploymentStats.total
      successRate = Math.round(deploymentStats.successRate)
    }
    
    // 处理最近活动数据
    if (activitiesResult.status === 'fulfilled' && activitiesResult.value) {
      recentActivities.value = activitiesResult.value.activities
    }
    
    // 获取项目成员数量（暂时使用固定值，后续可以添加专门的API）
    const totalMembers = 1 // TODO: 实现项目成员统计API
    
    // 更新统计数据
    projectStats.value = {
      totalEnvironments,
      totalDeployments,
      successRate,
      totalMembers
    }
    
  } catch (error: any) {
    console.error('获取项目统计失败:', error)
    // 不使用 mock 数据，保持空状态
    projectStats.value = {
      totalEnvironments: 0,
      totalDeployments: 0,
      successRate: 0,
      totalMembers: 0
    }
    recentActivities.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProjectStats()
})
</script>
