<template>
  <div class="dashboard-page">
    <!-- 页面标题 -->
    <div class="page-header mb-8">
      <h1 class="text-3xl font-bold text-bilibili-primary mb-2">
        DevOps 仪表盘
      </h1>
      <p class="text-bilibili-secondary">
        欢迎使用企业级 DevOps 平台，这里是您的项目概览
      </p>
    </div>
    
    <!-- 统计卡片 -->
    <div class="stats-grid mb-8">
      <div 
        v-for="stat in statsData" 
        :key="stat.title"
        class="stat-card card-bilibili animate-bilibili-hover"
      >
        <div class="flex-between mb-4">
          <div class="stat-icon">
            <span class="text-2xl">{{ stat.icon }}</span>
          </div>
          <div class="stat-trend" :class="stat.trend > 0 ? 'positive' : 'negative'">
            <span class="text-sm">{{ stat.trend > 0 ? '↗' : '↘' }}{{ Math.abs(stat.trend) }}%</span>
          </div>
        </div>
        
        <div class="stat-content">
          <h3 class="text-2xl font-bold text-bilibili-primary mb-1">
            {{ stat.value }}
          </h3>
          <p class="text-bilibili-secondary text-sm">
            {{ stat.title }}
          </p>
        </div>
      </div>
    </div>
    
    <!-- 主要内容区域 -->
    <div class="content-grid">
      <!-- 项目概览 -->
      <div class="content-card">
        <n-card title="项目概览" class="card-bilibili">
          <template #header-extra>
            <n-button quaternary size="small" @click="refreshProjects">
              🔄 刷新
            </n-button>
          </template>
          
          <div class="project-list">
            <div 
              v-for="project in projectsData" 
              :key="project.id"
              class="project-item animate-bilibili-hover"
              @click="viewProject(project.id)"
            >
              <div class="flex-between">
                <div class="project-info">
                  <h4 class="font-semibold text-bilibili-primary mb-1">
                    {{ project.name }}
                  </h4>
                  <p class="text-sm text-bilibili-secondary">
                    {{ project.description }}
                  </p>
                </div>
                
                <div class="project-status">
                  <n-tag 
                    :type="getStatusType(project.status)" 
                    size="small"
                    class="badge-bilibili"
                  >
                    {{ project.status }}
                  </n-tag>
                </div>
              </div>
              
              <div class="project-meta mt-3 flex-between">
                <div class="flex-start gap-bilibili-sm">
                  <span class="text-xs text-bilibili-muted">
                    👥 {{ project.team }}
                  </span>
                  <span class="text-xs text-bilibili-muted">
                    📅 {{ formatDate(project.lastUpdate) }}
                  </span>
                </div>
                
                <div class="project-progress">
                  <n-progress 
                    type="line" 
                    :percentage="project.progress" 
                    :height="4"
                    :show-indicator="false"
                    color="#FB7299"
                  />
                </div>
              </div>
            </div>
          </div>
        </n-card>
      </div>
      
      <!-- 最近活动 -->
      <div class="content-card">
        <n-card title="最近活动" class="card-bilibili">
          <template #header-extra>
            <n-button quaternary size="small" @click="viewAllActivities">
              查看全部
            </n-button>
          </template>
          
          <div class="activity-list">
            <div 
              v-for="activity in activitiesData" 
              :key="activity.id"
              class="activity-item"
            >
              <div class="activity-avatar">
                <n-avatar 
                  :src="activity.user.avatar" 
                  :fallback-src="'/default-avatar.svg'"
                  size="small"
                />
              </div>
              
              <div class="activity-content flex-1">
                <p class="text-sm text-bilibili-primary">
                  <strong>{{ activity.user.name }}</strong>
                  {{ activity.action }}
                  <strong>{{ activity.target }}</strong>
                </p>
                <p class="text-xs text-bilibili-muted mt-1">
                  {{ formatTime(activity.timestamp) }}
                </p>
              </div>
              
              <div class="activity-type">
                <n-tag 
                  :type="getActivityType(activity.type)" 
                  size="tiny"
                >
                  {{ activity.type }}
                </n-tag>
              </div>
            </div>
          </div>
        </n-card>
      </div>
    </div>
    
    <!-- 快速操作 -->
    <div class="quick-actions mt-8">
      <n-card title="快速操作" class="card-bilibili">
        <div class="actions-grid">
          <n-button 
            v-for="action in quickActions" 
            :key="action.key"
            :type="action.type"
            size="large"
            class="action-button btn-bilibili animate-bilibili-hover"
            @click="handleQuickAction(action.key)"
          >
            {{ action.icon }} {{ action.label }}
          </n-button>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 统计数据
const statsData = ref([
  {
    title: '活跃项目',
    value: '12',
    icon: '📊',
    trend: 8.2
  },
  {
    title: '团队成员',
    value: '48',
    icon: '👥',
    trend: 12.5
  },
  {
    title: '部署次数',
    value: '156',
    icon: '🚀',
    trend: -2.1
  },
  {
    title: '待修复问题',
    value: '23',
    icon: '🐛',
    trend: -15.3
  }
])

// 项目数据
const projectsData = ref([
  {
    id: 1,
    name: '电商平台前端',
    description: '基于 Vue 3 的现代化电商前端应用',
    status: '开发中',
    team: '前端团队',
    lastUpdate: new Date('2024-01-15'),
    progress: 75
  },
  {
    id: 2,
    name: '用户服务 API',
    description: '微服务架构的用户管理系统',
    status: '测试中',
    team: '后端团队',
    lastUpdate: new Date('2024-01-14'),
    progress: 90
  },
  {
    id: 3,
    name: '数据分析平台',
    description: '实时数据处理和可视化平台',
    status: '已部署',
    team: '数据团队',
    lastUpdate: new Date('2024-01-13'),
    progress: 100
  }
])

// 活动数据
const activitiesData = ref([
  {
    id: 1,
    user: { name: '张三', avatar: '/avatar1.jpg' },
    action: '提交了代码到',
    target: '电商平台前端',
    type: '代码',
    timestamp: new Date('2024-01-15T10:30:00')
  },
  {
    id: 2,
    user: { name: '李四', avatar: '/avatar2.jpg' },
    action: '部署了',
    target: '用户服务 API v2.1.0',
    type: '部署',
    timestamp: new Date('2024-01-15T09:15:00')
  },
  {
    id: 3,
    user: { name: '王五', avatar: '/avatar3.jpg' },
    action: '创建了新的',
    target: '性能优化任务',
    type: '任务',
    timestamp: new Date('2024-01-15T08:45:00')
  }
])

// 快速操作
const quickActions = ref([
  {
    key: 'new-project',
    label: '新建项目',
    icon: '➕',
    type: 'primary'
  },
  {
    key: 'deploy',
    label: '快速部署',
    icon: '🚀',
    type: 'info'
  },
  {
    key: 'monitor',
    label: '系统监控',
    icon: '📊',
    type: 'warning'
  },
  {
    key: 'settings',
    label: '系统设置',
    icon: '⚙️',
    type: 'default'
  }
])

// 获取状态类型
const getStatusType = (status: string) => {
  const typeMap: Record<string, string> = {
    '开发中': 'info',
    '测试中': 'warning',
    '已部署': 'success',
    '已暂停': 'error'
  }
  return typeMap[status] || 'default'
}

// 获取活动类型
const getActivityType = (type: string) => {
  const typeMap: Record<string, string> = {
    '代码': 'info',
    '部署': 'success',
    '任务': 'warning',
    '问题': 'error'
  }
  return typeMap[type] || 'default'
}

// 格式化日期
const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN')
}

// 格式化时间
const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

// 刷新项目
const refreshProjects = () => {
  console.log('刷新项目列表')
}

// 查看项目
const viewProject = (id: number) => {
  console.log('查看项目:', id)
}

// 查看所有活动
const viewAllActivities = () => {
  console.log('查看所有活动')
}

// 处理快速操作
const handleQuickAction = (key: string) => {
  console.log('快速操作:', key)
}

// 初始化
onMounted(() => {
  // 加载数据
})
</script>

<style scoped>
.dashboard-page {
  padding: var(--spacing-6);
}

.page-header {
  text-align: center;
  margin-bottom: var(--spacing-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-6);
}

.stat-card {
  padding: var(--spacing-6);
  border-radius: var(--radius-xl);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  transition: all var(--duration-normal) var(--ease-out-quart);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--gradient-soft);
  color: var(--text-inverse);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-weight: var(--font-weight-medium);
}

.stat-trend.positive {
  color: var(--bilibili-blue);
}

.stat-trend.negative {
  color: #FF6B6B;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--spacing-6);
}

.content-card {
  min-height: 400px;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.project-item {
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out-quart);
}

.project-item:hover {
  border-color: var(--border-accent);
  background: var(--bilibili-pink-ultra-light);
}

.project-progress {
  width: 80px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast) ease;
}

.activity-item:hover {
  background: var(--bilibili-pink-ultra-light);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-4);
}

.action-button {
  height: 64px;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: var(--spacing-4);
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>