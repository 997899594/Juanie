<template>
  <div class="pipelines-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">CI/CD 流水线</h1>
          <p class="page-subtitle">管理和监控您的持续集成与部署流水线</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshPipelines" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button type="primary" @click="showCreateModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            创建流水线
          </n-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon success">
          <CheckCircle :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.successful }}</div>
          <div class="stat-label">成功构建</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon error">
          <XCircle :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.failed }}</div>
          <div class="stat-label">失败构建</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <Clock :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.running }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon info">
          <Activity :size="24" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总流水线</div>
        </div>
      </div>
    </div>

    <!-- 筛选和搜索 -->
    <div class="filters-section">
      <div class="filters-row">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索流水线..."
          clearable
          class="search-input"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
        </n-input>
        
        <n-select
          v-model:value="statusFilter"
          placeholder="状态筛选"
          clearable
          :options="statusOptions"
          class="filter-select"
        />
        
        <n-select
          v-model:value="projectFilter"
          placeholder="项目筛选"
          clearable
          :options="projectOptions"
          class="filter-select"
        />
      </div>
    </div>

    <!-- 流水线列表 -->
    <div class="pipelines-grid">
      <div
        v-for="pipeline in filteredPipelines"
        :key="pipeline.id"
        class="pipeline-card"
        @click="viewPipelineDetail(pipeline)"
      >
        <div class="pipeline-header">
          <div class="pipeline-info">
            <h3 class="pipeline-name">{{ pipeline.name }}</h3>
            <p class="pipeline-project">{{ pipeline.project }}</p>
          </div>
          <div class="pipeline-status">
            <n-tag
              :type="getStatusType(pipeline.status)"
              :bordered="false"
              size="small"
            >
              <template #icon>
                <component :is="getStatusIcon(pipeline.status)" :size="12" />
              </template>
              {{ getStatusText(pipeline.status) }}
            </n-tag>
          </div>
        </div>

        <div class="pipeline-content">
          <div class="pipeline-stages">
            <div
              v-for="stage in pipeline.stages"
              :key="stage.name"
              class="stage-item"
              :class="getStageClass(stage.status)"
            >
              <div class="stage-icon">
                <component :is="getStageIcon(stage.status)" :size="14" />
              </div>
              <span class="stage-name">{{ stage.name }}</span>
            </div>
          </div>

          <div class="pipeline-meta">
            <div class="meta-item">
              <GitBranch :size="14" />
              <span>{{ pipeline.branch }}</span>
            </div>
            <div class="meta-item">
              <User :size="14" />
              <span>{{ pipeline.triggeredBy }}</span>
            </div>
            <div class="meta-item">
              <Clock :size="14" />
              <span>{{ formatDuration(pipeline.duration) }}</span>
            </div>
          </div>
        </div>

        <div class="pipeline-footer">
          <div class="pipeline-time">
            <Calendar :size="14" />
            <span>{{ formatTime(pipeline.createdAt) }}</span>
          </div>
          <div class="pipeline-actions">
            <n-button
              size="small"
              @click.stop="runPipeline(pipeline)"
              :loading="pipeline.isRunning"
            >
              <template #icon>
                <Play :size="14" />
              </template>
            </n-button>
            <n-dropdown
              :options="getPipelineActions(pipeline)"
              @select="handlePipelineAction"
            >
              <n-button size="small" @click.stop>
                <template #icon>
                  <MoreVertical :size="14" />
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredPipelines.length === 0" class="empty-state">
      <div class="empty-icon">
        <GitBranch :size="48" />
      </div>
      <h3>暂无流水线</h3>
      <p>创建您的第一个CI/CD流水线开始自动化构建和部署</p>
      <n-button type="primary" @click="showCreateModal = true">
        创建流水线
      </n-button>
    </div>

    <!-- 创建流水线模态框 -->
    <n-modal v-model:show="showCreateModal" preset="card" title="创建流水线" class="create-modal">
      <CreatePipelineForm @success="handleCreateSuccess" @cancel="showCreateModal = false" />
    </n-modal>

    <!-- 流水线详情抽屉 -->
    <n-drawer
      v-model:show="showDetail"
      :width="800"
      placement="right"
      :mask-closable="false"
    >
      <n-drawer-content title="流水线详情" closable>
        <PipelineDetail
          v-if="selectedPipeline"
          :pipeline="selectedPipeline"
        />
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  Plus, RefreshCw, Search, CheckCircle, XCircle, Clock, Activity,
  GitBranch, User, Calendar, Play, MoreVertical, Eye, Settings,
  Trash2, Copy
} from 'lucide-vue-next'
import CreatePipelineForm from '@/components/pipelines/CreatePipelineForm.vue'
import PipelineDetail from '@/components/pipelines/PipelineDetail.vue'
import { getPipelines } from '@/api/pipelines'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref(null)
const projectFilter = ref(null)
const showCreateModal = ref(false)

const showDetail = ref(false)
const selectedPipeline = ref(null)

// 统计数据
const stats = ref({
  successful: 156,
  failed: 12,
  running: 3,
  total: 24
})

// 筛选选项
const statusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '运行中', value: 'running' },
  { label: '等待中', value: 'pending' },
  { label: '已取消', value: 'cancelled' }
]

const projectOptions = [
  { label: 'Web应用', value: 'web-app' },
  { label: 'API服务', value: 'api-service' },
  { label: '移动应用', value: 'mobile-app' },
  { label: '数据平台', value: 'data-platform' }
]

// 模拟流水线数据 - 替换为空数组，将从API获取
const pipelines = ref([])

// 计算属性
const filteredPipelines = computed(() => {
  let filtered = pipelines.value

  if (searchQuery.value) {
    filtered = filtered.filter(pipeline =>
      pipeline.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      pipeline.project.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (statusFilter.value) {
    filtered = filtered.filter(pipeline => pipeline.status === statusFilter.value)
  }

  if (projectFilter.value) {
    filtered = filtered.filter(pipeline => pipeline.project === projectFilter.value)
  }

  return filtered
})

// 方法
const refreshPipelines = async () => {
  loading.value = true
  try {
    const response = await getPipelines()
    pipelines.value = response.data || []
    
    // 更新统计数据
    const successful = pipelines.value.filter(p => p.status === 'success').length
    const failed = pipelines.value.filter(p => p.status === 'failed').length
    const running = pipelines.value.filter(p => p.status === 'running').length
    const total = pipelines.value.length
    
    stats.value = { successful, failed, running, total }
    
    message.success('流水线列表已刷新')
  } catch (error) {
    console.error('获取流水线列表失败:', error)
    message.error('获取流水线列表失败')
  } finally {
    loading.value = false
  }
}

const getStatusType = (status: string) => {
  const types = {
    success: 'success',
    failed: 'error',
    running: 'warning',
    pending: 'info',
    cancelled: 'default'
  }
  return types[status] || 'default'
}

const getStatusIcon = (status: string) => {
  const icons = {
    success: CheckCircle,
    failed: XCircle,
    running: Clock,
    pending: Clock,
    cancelled: XCircle
  }
  return icons[status] || Clock
}

const getStatusText = (status: string) => {
  const texts = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    pending: '等待中',
    cancelled: '已取消'
  }
  return texts[status] || '未知'
}

const getStageClass = (status: string) => {
  return `stage-${status}`
}

const getStageIcon = (status: string) => {
  const icons = {
    success: CheckCircle,
    failed: XCircle,
    running: Clock,
    pending: Clock,
    skipped: XCircle
  }
  return icons[status] || Clock
}

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  return `${minutes}分${seconds}秒`
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

const runPipeline = async (pipeline: any) => {
  pipeline.isRunning = true
  try {
    // 模拟运行流水线
    await new Promise(resolve => setTimeout(resolve, 2000))
    pipeline.status = 'running'
    message.success(`流水线 "${pipeline.name}" 已开始运行`)
  } catch (error) {
    message.error('启动流水线失败')
  } finally {
    pipeline.isRunning = false
  }
}

const getPipelineActions = (pipeline: any) => [
  {
    label: '查看详情',
    key: 'view',
    icon: () => h(Eye, { size: 14 }),
    props: { pipeline }
  },
  {
    label: '编辑配置',
    key: 'edit',
    icon: () => h(Settings, { size: 14 }),
    props: { pipeline }
  },
  {
    label: '下载日志',
    key: 'download',
    icon: () => h(Download, { size: 14 }),
    props: { pipeline }
  },
  {
    type: 'divider'
  },
  {
    label: '删除流水线',
    key: 'delete',
    icon: () => h(Trash2, { size: 14 }),
    props: { pipeline }
  }
]

const handlePipelineAction = (key: string, option: any) => {
  const pipeline = option.props.pipeline
  
  switch (key) {
    case 'view':
      viewPipelineDetail(pipeline)
      break
    case 'edit':
      message.info('编辑功能开发中...')
      break
    case 'download':
      message.info('下载日志功能开发中...')
      break
    case 'delete':
      message.warning('删除功能开发中...')
      break
  }
}

const viewPipelineDetail = (pipeline: any) => {
  selectedPipeline.value = pipeline
  showDetail.value = true
}

const handleCreateSuccess = () => {
  showCreateModal.value = false
  refreshPipelines()
}

onMounted(() => {
  // 初始化数据
  refreshPipelines()
})
</script>

<style scoped>
.pipelines-page {
  @apply p-6 space-y-6;
}

.page-header {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.header-content {
  @apply flex items-center justify-between;
}

.title-section h1 {
  @apply text-2xl font-bold text-white mb-1;
}

.title-section p {
  @apply text-slate-400;
}

.header-actions {
  @apply flex items-center gap-3;
}

.stats-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.stat-card {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 flex items-center gap-4;
}

.stat-icon {
  @apply w-12 h-12 rounded-lg flex items-center justify-center;
}

.stat-icon.success {
  @apply bg-green-500/20 text-green-400;
}

.stat-icon.error {
  @apply bg-red-500/20 text-red-400;
}

.stat-icon.warning {
  @apply bg-yellow-500/20 text-yellow-400;
}

.stat-icon.info {
  @apply bg-blue-500/20 text-blue-400;
}

.stat-value {
  @apply text-2xl font-bold text-white;
}

.stat-label {
  @apply text-sm text-slate-400;
}

.filters-section {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50;
}

.filters-row {
  @apply flex flex-wrap gap-4;
}

.search-input {
  @apply flex-1 min-w-64;
}

.filter-select {
  @apply w-40;
}

.pipelines-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6;
}

.pipeline-card {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all cursor-pointer;
}

.pipeline-header {
  @apply flex items-start justify-between mb-4;
}

.pipeline-name {
  @apply text-lg font-semibold text-white mb-1;
}

.pipeline-project {
  @apply text-sm text-slate-400;
}

.pipeline-content {
  @apply space-y-4;
}

.pipeline-stages {
  @apply flex flex-wrap gap-2;
}

.stage-item {
  @apply flex items-center gap-2 px-3 py-1 rounded-lg text-sm;
}

.stage-success {
  @apply bg-green-500/20 text-green-400;
}

.stage-failed {
  @apply bg-red-500/20 text-red-400;
}

.stage-running {
  @apply bg-yellow-500/20 text-yellow-400;
}

.stage-pending {
  @apply bg-slate-500/20 text-slate-400;
}

.stage-skipped {
  @apply bg-slate-600/20 text-slate-500;
}

.pipeline-meta {
  @apply flex flex-wrap gap-4 text-sm text-slate-400;
}

.meta-item {
  @apply flex items-center gap-1;
}

.pipeline-footer {
  @apply flex items-center justify-between pt-4 border-t border-slate-700/50;
}

.pipeline-time {
  @apply flex items-center gap-2 text-sm text-slate-400;
}

.pipeline-actions {
  @apply flex items-center gap-2;
}

.empty-state {
  @apply text-center py-16;
}

.empty-icon {
  @apply text-slate-600 mb-4;
}

.empty-state h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.empty-state p {
  @apply text-slate-400 mb-6;
}

.create-modal, .detail-modal {
  @apply w-full max-w-4xl;
}
</style>