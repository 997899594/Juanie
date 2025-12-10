<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300 } }"
    class="space-y-6"
  >
    <!-- 页面标题 -->
    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">仪表盘</h1>
      <p class="text-muted-foreground">
        欢迎回来！这里是您的项目概览。
      </p>
    </div>

    <!-- 统计卡片 -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="总项目数"
        :value="stats.totalProjects"
        :description="stats.activeProjects > 0 ? `${stats.activeProjects} 个活跃项目` : '暂无活跃项目'"
        :icon="FolderKanban"
      />
      <StatsCard
        title="本月部署"
        :value="stats.totalDeployments"
        :description="stats.successfulDeployments > 0 ? `${stats.successfulDeployments} 次成功` : '暂无部署'"
        :icon="Rocket"
      />
      <StatsCard
        title="运行中 Pipeline"
        :value="stats.runningPipelines"
        :description="stats.totalPipelines > 0 ? `共 ${stats.totalPipelines} 个 Pipeline` : '暂无 Pipeline'"
        :icon="GitBranch"
      />
      <StatsCard
        title="本月成本"
        :value="`$${stats.monthlyCost.toFixed(2)}`"
        :description="stats.costTrend > 0 ? `+${stats.costTrend}% 较上月` : stats.costTrend < 0 ? `${stats.costTrend}% 较上月` : '与上月持平'"
        :icon="DollarSign"
      />
    </div>

    <!-- 最近部署 -->
    <Card v-if="recentDeployments.length > 0">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>最近部署</CardTitle>
            <CardDescription>最近 5 次部署记录</CardDescription>
          </div>
          <Button variant="outline" size="sm" @click="$router.push('/deployments')">
            查看全部
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div
            v-for="(deployment, index) in recentDeployments"
            :key="deployment.id"
            v-motion
            :initial="{ opacity: 0, x: -20 }"
            :enter="{
              opacity: 1,
              x: 0,
              transition: {
                delay: index * 50,
                duration: 300,
              },
            }"
            class="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0"
          >
            <div class="space-y-1">
              <p class="text-sm font-medium">{{ deployment.version }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(deployment.createdAt) }}
              </p>
            </div>
            <Badge :variant="getDeploymentStatusVariant(deployment.status)">
              {{ getDeploymentStatusText(deployment.status) }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 空状态 -->
    <Card v-else>
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Rocket class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无部署记录</h3>
        <p class="text-sm text-muted-foreground mb-4">开始创建项目并部署您的应用</p>
        <Button @click="$router.push('/projects')">
          创建项目
        </Button>
      </CardContent>
    </Card>

    <!-- 快速操作 -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="$router.push('/projects')">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <FolderKanban class="h-5 w-5" />
            项目管理
          </CardTitle>
          <CardDescription>创建和管理您的项目</CardDescription>
        </CardHeader>
      </Card>

      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="$router.push('/pipelines')">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <GitBranch class="h-5 w-5" />
            Pipeline
          </CardTitle>
          <CardDescription>配置和运行 CI/CD 流水线</CardDescription>
        </CardHeader>
      </Card>

      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="$router.push('/environments')">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Server class="h-5 w-5" />
            环境管理
          </CardTitle>
          <CardDescription>管理部署环境配置</CardDescription>
        </CardHeader>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle , log } from '@juanie/ui'
import { DollarSign, FolderKanban, GitBranch, Rocket, Server } from 'lucide-vue-next'
import StatsCard from '@/components/StatsCard.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useDeployments } from '@/composables/useDeployments'
import { usePipelines } from '@/composables/usePipelines'
import { useProjectCRUD } from '@/composables/useProjects'

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

// 使用 TanStack Query - 自动获取数据
const { useProjectsQuery } = useProjectCRUD()
const { data: projects } = useProjectsQuery(appStore.currentOrganizationId!)
const { deployments } = useDeployments()
const { pipelines } = usePipelines()

// 统计数据
const stats = ref({
  totalProjects: 0,
  activeProjects: 0,
  totalDeployments: 0,
  successfulDeployments: 0,
  runningPipelines: 0,
  totalPipelines: 0,
  monthlyCost: 0,
  costTrend: 0,
})

// 最近部署（最多显示 5 条）
const recentDeployments = computed(() => {
  return deployments.value.slice(0, 5)
})

// 格式化日期
function formatDate(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

// 获取部署状态的 Badge 变体
function getDeploymentStatusVariant(status: string) {
  switch (status) {
    case 'success':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'pending':
    case 'running':
      return 'secondary'
    default:
      return 'outline'
  }
}

// 获取部署状态文本
function getDeploymentStatusText(status: string) {
  switch (status) {
    case 'success':
      return '成功'
    case 'failed':
      return '失败'
    case 'pending':
      return '等待中'
    case 'running':
      return '运行中'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

// 加载数据 - TanStack Query 会自动获取数据
async function loadData() {
  try {
    // 如果有当前组织，计算统计数据
    if (appStore.currentOrganizationId && projects.value) {
      // 计算项目统计
      stats.value.totalProjects = projects.value.length
      stats.value.activeProjects = projects.value.length

      // 计算部署统计
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyDeployments = (deployments.value ?? []).filter(
        (d) => new Date(d.createdAt) >= firstDayOfMonth,
      )

      stats.value.totalDeployments = monthlyDeployments.length
      stats.value.successfulDeployments = monthlyDeployments.filter(
        (d) => d.status === 'success',
      ).length

      // 加载所有项目的 Pipeline 并统计
      let allPipelines: any[] = []
      for (const project of projects.value) {
        try {
          await fetchPipelines(project.id)
          allPipelines = [...allPipelines, ...pipelines.value]
        } catch (err) {
          log.error(`Failed to fetch pipelines for project ${project.id}:`, err)
        }
      }

      stats.value.totalPipelines = allPipelines.length
      stats.value.runningPipelines = allPipelines.filter(
        (p) => p.status === 'running',
      ).length

      // 模拟成本数据（实际应该从后端获取）
      stats.value.monthlyCost = Math.random() * 1000
      stats.value.costTrend = Math.floor(Math.random() * 40) - 20
    }
  } catch (err) {
    log.error('Failed to load dashboard data:', err)
  }
}

onMounted(async () => {
  // 初始化认证状态
  await authStore.initialize()

  // 如果未登录，跳转到登录页
  if (!authStore.isAuthenticated) {
    router.replace({ name: 'Login' })
    return
  }

  // 加载数据
  await loadData()
})
</script>