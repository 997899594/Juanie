<template>
  <div class="dashboard-page">
    <!-- Welcome Section -->
    <div class="welcome-section">
      <div class="welcome-content">
        <h1 class="welcome-title">
          欢迎回来，{{ authStore.user?.fullName || authStore.user?.username }}！
        </h1>
        <p class="welcome-subtitle">
          今天是 {{ currentDate }}，让我们开始高效的DevOps工作吧
        </p>
      </div>
      <div class="welcome-actions">
        <n-button type="primary" size="large" @click="createProject">
          <template #icon>
            <Plus class="w-4 h-4" />
          </template>
          创建项目
        </n-button>
        <n-button size="large" @click="viewPipelines">
          <template #icon>
            <GitBranch class="w-4 h-4" />
          </template>
          查看流水线
        </n-button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div 
        v-for="stat in stats" 
        :key="stat.title"
        class="stat-card"
        :class="stat.trend === 'up' ? 'trend-up' : stat.trend === 'down' ? 'trend-down' : ''"
      >
        <div class="stat-header">
          <div class="stat-icon" :style="{ background: stat.color }">
            <component :is="stat.icon" class="w-5 h-5" />
          </div>
          <div class="stat-trend" v-if="stat.trend">
            <component :is="stat.trend === 'up' ? TrendingUp : TrendingDown" class="w-4 h-4" />
            <span>{{ stat.change }}</span>
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-title">{{ stat.title }}</div>
          <div class="stat-description">{{ stat.description }}</div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Recent Projects -->
      <div class="content-card">
        <div class="card-header">
          <h3>最近项目</h3>
          <n-button text type="primary" @click="$router.push('/projects')">
            查看全部
            <template #icon>
              <ArrowRight class="w-4 h-4 ml-1" />
            </template>
          </n-button>
        </div>
        <div class="projects-list">
          <div 
            v-for="project in recentProjects" 
            :key="project.id"
            class="project-item"
            @click="viewProject(project.id)"
          >
            <div class="project-avatar">
              <component :is="project.icon" class="w-5 h-5" />
            </div>
            <div class="project-info">
              <div class="project-name">{{ project.name }}</div>
              <div class="project-meta">
                <span class="project-status" :class="project.status.toLowerCase()">
                  {{ project.status }}
                </span>
                <span class="project-updated">{{ project.updatedAt }}</span>
              </div>
            </div>
            <div class="project-actions">
              <n-button size="small" quaternary circle>
                <template #icon>
                  <MoreHorizontal class="w-4 h-4" />
                </template>
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Deployments -->
      <div class="content-card">
        <div class="card-header">
          <h3>最近部署</h3>
          <n-button text type="primary" @click="$router.push('/deployments')">
            查看全部
            <template #icon>
              <ArrowRight class="w-4 h-4 ml-1" />
            </template>
          </n-button>
        </div>
        <div class="deployments-list">
          <div 
            v-for="deployment in recentDeployments" 
            :key="deployment.id"
            class="deployment-item"
          >
            <div class="deployment-status" :class="deployment.status.toLowerCase()">
              <component :is="getDeploymentIcon(deployment.status)" class="w-4 h-4" />
            </div>
            <div class="deployment-info">
              <div class="deployment-name">{{ deployment.name }}</div>
              <div class="deployment-meta">
                <span class="deployment-env">{{ deployment.environment }}</span>
                <span class="deployment-time">{{ deployment.deployedAt }}</span>
              </div>
            </div>
            <div class="deployment-duration">
              {{ deployment.duration }}
            </div>
          </div>
        </div>
      </div>

      <!-- System Health -->
      <div class="content-card">
        <div class="card-header">
          <h3>系统健康状态</h3>
          <n-button text type="primary" @click="$router.push('/monitoring')">
            详细监控
            <template #icon>
              <ArrowRight class="w-4 h-4 ml-1" />
            </template>
          </n-button>
        </div>
        <div class="health-metrics">
          <div 
            v-for="metric in healthMetrics" 
            :key="metric.name"
            class="health-metric"
          >
            <div class="metric-header">
              <span class="metric-name">{{ metric.name }}</span>
              <span class="metric-value" :class="metric.status">{{ metric.value }}</span>
            </div>
            <div class="metric-bar">
              <div 
                class="metric-fill" 
                :class="metric.status"
                :style="{ width: metric.percentage + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="content-card">
        <div class="card-header">
          <h3>快速操作</h3>
        </div>
        <div class="quick-actions">
          <div 
            v-for="action in quickActions" 
            :key="action.title"
            class="quick-action"
            @click="action.handler"
          >
            <div class="action-icon" :style="{ background: action.color }">
              <component :is="action.icon" class="w-5 h-5" />
            </div>
            <div class="action-content">
              <div class="action-title">{{ action.title }}</div>
              <div class="action-description">{{ action.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { 
  Plus, 
  GitBranch, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Folder,
  Code,
  Database,
  Rocket,
  Settings,
  Users,
  Shield
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const message = useMessage()
const authStore = useAuthStore()

const currentDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

const stats = ref([
  {
    title: '活跃项目',
    value: '12',
    description: '本月新增 3 个',
    change: '+25%',
    trend: 'up',
    icon: Folder,
    color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
  },
  {
    title: '成功部署',
    value: '156',
    description: '本周完成 23 次',
    change: '+12%',
    trend: 'up',
    icon: Rocket,
    color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  },
  {
    title: '代码提交',
    value: '2,341',
    description: '今日提交 45 次',
    change: '+8%',
    trend: 'up',
    icon: Code,
    color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  },
  {
    title: '系统可用性',
    value: '99.9%',
    description: '过去30天平均',
    change: '-0.1%',
    trend: 'down',
    icon: Shield,
    color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
  }
])

const recentProjects = ref([
  {
    id: '1',
    name: 'E-Commerce Platform',
    status: 'ACTIVE',
    updatedAt: '2小时前',
    icon: Code
  },
  {
    id: '2',
    name: 'Mobile App Backend',
    status: 'DEPLOYING',
    updatedAt: '5小时前',
    icon: Database
  },
  {
    id: '3',
    name: 'Analytics Dashboard',
    status: 'MAINTENANCE',
    updatedAt: '1天前',
    icon: Folder
  }
])

const recentDeployments = ref([
  {
    id: '1',
    name: 'Frontend v2.1.0',
    environment: 'Production',
    status: 'SUCCESS',
    deployedAt: '10分钟前',
    duration: '3m 24s'
  },
  {
    id: '2',
    name: 'API Gateway v1.8.2',
    environment: 'Staging',
    status: 'RUNNING',
    deployedAt: '1小时前',
    duration: '2m 15s'
  },
  {
    id: '3',
    name: 'Database Migration',
    environment: 'Production',
    status: 'FAILED',
    deployedAt: '3小时前',
    duration: '1m 45s'
  }
])

const healthMetrics = ref([
  {
    name: 'CPU使用率',
    value: '45%',
    percentage: 45,
    status: 'healthy'
  },
  {
    name: '内存使用率',
    value: '67%',
    percentage: 67,
    status: 'warning'
  },
  {
    name: '磁盘使用率',
    value: '23%',
    percentage: 23,
    status: 'healthy'
  },
  {
    name: '网络延迟',
    value: '12ms',
    percentage: 12,
    status: 'healthy'
  }
])

const quickActions = ref([
  {
    title: '创建项目',
    description: '快速创建新的DevOps项目',
    icon: Plus,
    color: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    handler: () => createProject()
  },
  {
    title: '部署应用',
    description: '一键部署到生产环境',
    icon: Rocket,
    color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    handler: () => router.push('/deployments/new')
  },
  {
    title: '团队管理',
    description: '管理团队成员和权限',
    icon: Users,
    color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    handler: () => router.push('/team')
  },
  {
    title: '系统设置',
    description: '配置系统参数和集成',
    icon: Settings,
    color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    handler: () => router.push('/settings')
  }
])

const getDeploymentIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'success':
      return CheckCircle
    case 'failed':
      return XCircle
    case 'running':
      return Clock
    default:
      return Clock
  }
}

const createProject = () => {
  router.push('/projects/new')
}

const viewPipelines = () => {
  router.push('/pipelines')
}

const viewProject = (id: string) => {
  router.push(`/projects/${id}`)
}

onMounted(() => {
  // Load dashboard data
  console.log('Dashboard mounted')
})
</script>

<style scoped>
.dashboard-page {
  @apply space-y-8;
}

/* Welcome Section */
.welcome-section {
  @apply flex items-center justify-between p-6 rounded-2xl;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.3);
  backdrop-filter: blur(20px);
}

.welcome-content {
  @apply flex-1;
}

.welcome-title {
  @apply text-3xl font-bold text-soft-800 mb-2;
}

.welcome-subtitle {
  @apply text-soft-600;
}

.welcome-actions {
  @apply flex items-center gap-3;
}

/* Stats Grid */
.stats-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6;
}

.stat-card {
  @apply p-6 rounded-2xl transition-all duration-200 hover:scale-105;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(203, 213, 225, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-card.trend-up {
  border-left: 4px solid #10b981;
}

.stat-card.trend-down {
  border-left: 4px solid #ef4444;
}

.stat-header {
  @apply flex items-center justify-between mb-4;
}

.stat-icon {
  @apply w-12 h-12 rounded-xl flex items-center justify-center text-white;
}

.stat-trend {
  @apply flex items-center gap-1 text-sm font-medium;
}

.trend-up .stat-trend {
  @apply text-green-600;
}

.trend-down .stat-trend {
  @apply text-red-600;
}

.stat-content {
  @apply space-y-1;
}

.stat-value {
  @apply text-2xl font-bold text-soft-800;
}

.stat-title {
  @apply text-sm font-medium text-soft-700;
}

.stat-description {
  @apply text-xs text-soft-500;
}

/* Content Grid */
.content-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6;
}

.content-card {
  @apply rounded-2xl overflow-hidden;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(203, 213, 225, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.card-header {
  @apply flex items-center justify-between p-6 border-b border-soft-200;
}

.card-header h3 {
  @apply text-lg font-semibold text-soft-800;
}

/* Projects List */
.projects-list {
  @apply space-y-3 p-6;
}

.project-item {
  @apply flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.2);
}

.project-item:hover {
  @apply transform scale-105;
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.project-avatar {
  @apply w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600;
}

.project-info {
  @apply flex-1;
}

.project-name {
  @apply font-medium text-soft-800 mb-1;
}

.project-meta {
  @apply flex items-center gap-2 text-sm;
}

.project-status {
  @apply px-2 py-1 rounded-full text-xs font-medium;
}

.project-status.active {
  @apply bg-green-100 text-green-700;
}

.project-status.deploying {
  @apply bg-blue-100 text-blue-700;
}

.project-status.maintenance {
  @apply bg-yellow-100 text-yellow-700;
}

.project-updated {
  @apply text-soft-500;
}

/* Deployments List */
.deployments-list {
  @apply space-y-3 p-6;
}

.deployment-item {
  @apply flex items-center gap-3 p-3 rounded-xl;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.2);
}

.deployment-status {
  @apply w-8 h-8 rounded-lg flex items-center justify-center text-white;
}

.deployment-status.success {
  @apply bg-green-500;
}

.deployment-status.failed {
  @apply bg-red-500;
}

.deployment-status.running {
  @apply bg-blue-500;
}

.deployment-info {
  @apply flex-1;
}

.deployment-name {
  @apply font-medium text-soft-800 mb-1;
}

.deployment-meta {
  @apply flex items-center gap-2 text-sm text-soft-600;
}

.deployment-env {
  @apply px-2 py-1 rounded-full bg-soft-200 text-xs text-soft-700;
}

.deployment-duration {
  @apply text-sm text-soft-500 font-mono;
}

/* Health Metrics */
.health-metrics {
  @apply space-y-4 p-6;
}

.health-metric {
  @apply space-y-2;
}

.metric-header {
  @apply flex items-center justify-between;
}

.metric-name {
  @apply text-sm text-soft-700;
}

.metric-value {
  @apply text-sm font-medium;
}

.metric-value.healthy {
  @apply text-green-600;
}

.metric-value.warning {
  @apply text-yellow-600;
}

.metric-value.critical {
  @apply text-red-600;
}

.metric-bar {
  @apply h-2 bg-soft-200 rounded-full overflow-hidden;
}

.metric-fill {
  @apply h-full transition-all duration-300;
}

.metric-fill.healthy {
  @apply bg-green-500;
}

.metric-fill.warning {
  @apply bg-yellow-500;
}

.metric-fill.critical {
  @apply bg-red-500;
}

/* Quick Actions */
.quick-actions {
  @apply space-y-3 p-6;
}

.quick-action {
  @apply flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.2);
}

.quick-action:hover {
  @apply transform scale-105;
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.action-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center text-white;
}

.action-content {
  @apply flex-1;
}

.action-title {
  @apply font-medium text-soft-800 mb-1;
}

.action-description {
  @apply text-sm text-soft-600;
}

/* Button Overrides */
:deep(.n-button--primary-type) {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

:deep(.n-button--primary-type:hover) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

:deep(.n-button--default-type) {
  @apply bg-white border-soft-300 text-soft-700;
}

:deep(.n-button--default-type:hover) {
  @apply bg-soft-50 border-soft-400;
}

:deep(.n-button--text-type.n-button--primary-type) {
  @apply text-primary-600;
}

:deep(.n-button--text-type.n-button--primary-type:hover) {
  @apply text-primary-700;
}
</style>