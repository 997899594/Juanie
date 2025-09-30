<template>
  <div class="pipeline-detail">
    <!-- 流水线概览 -->
    <div class="pipeline-overview">
      <div class="overview-header">
        <div class="pipeline-info">
          <h2 class="pipeline-name">{{ pipeline.name }}</h2>
          <p class="pipeline-project">{{ pipeline.project }}</p>
        </div>
        <div class="pipeline-status">
          <n-tag
            :type="getStatusType(pipeline.status)"
            :bordered="false"
            size="large"
          >
            <template #icon>
              <component :is="getStatusIcon(pipeline.status)" :size="16" />
            </template>
            {{ getStatusText(pipeline.status) }}
          </n-tag>
        </div>
      </div>
      
      <div class="overview-meta">
        <div class="meta-item">
          <GitBranch :size="16" />
          <span>分支: {{ pipeline.branch }}</span>
        </div>
        <div class="meta-item">
          <User :size="16" />
          <span>触发者: {{ pipeline.triggeredBy }}</span>
        </div>
        <div class="meta-item">
          <Clock :size="16" />
          <span>耗时: {{ formatDuration(pipeline.duration) }}</span>
        </div>
        <div class="meta-item">
          <Calendar :size="16" />
          <span>开始时间: {{ formatDateTime(pipeline.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 流水线阶段 -->
    <div class="pipeline-stages">
      <h3 class="section-title">执行阶段</h3>
      <div class="stages-container">
        <div
          v-for="(stage, index) in pipeline.stages"
          :key="stage.name"
          class="stage-item"
          :class="getStageClass(stage.status)"
        >
          <div class="stage-header">
            <div class="stage-icon">
              <component :is="getStageIcon(stage.status)" :size="20" />
            </div>
            <div class="stage-info">
              <h4 class="stage-name">{{ stage.name }}</h4>
              <p class="stage-status">{{ getStageStatusText(stage.status) }}</p>
            </div>
            <div class="stage-duration">
              {{ formatDuration(stage.duration || 0) }}
            </div>
          </div>
          
          <div class="stage-progress">
            <n-progress
              :percentage="getStageProgress(stage.status)"
              :status="getProgressStatus(stage.status)"
              :show-indicator="false"
              :height="4"
            />
          </div>
          
          <!-- 连接线 -->
          <div v-if="index < pipeline.stages.length - 1" class="stage-connector">
            <ArrowDown :size="16" />
          </div>
        </div>
      </div>
    </div>

    <!-- 构建日志 -->
    <div class="build-logs">
      <div class="logs-header">
        <h3 class="section-title">构建日志</h3>
        <div class="logs-actions">
          <n-button size="small" @click="refreshLogs" :loading="logsLoading">
            <template #icon>
              <RefreshCw :size="14" />
            </template>
            刷新
          </n-button>
          <n-button size="small" @click="downloadLogs">
            <template #icon>
              <Download :size="14" />
            </template>
            下载
          </n-button>
        </div>
      </div>
      
      <div class="logs-container">
        <div class="logs-content">
          <pre class="log-text">{{ buildLogs }}</pre>
        </div>
      </div>
    </div>

    <!-- 构建产物 -->
    <div class="build-artifacts" v-if="artifacts.length > 0">
      <h3 class="section-title">构建产物</h3>
      <div class="artifacts-list">
        <div
          v-for="artifact in artifacts"
          :key="artifact.name"
          class="artifact-item"
        >
          <div class="artifact-icon">
            <FileText :size="20" />
          </div>
          <div class="artifact-info">
            <h4 class="artifact-name">{{ artifact.name }}</h4>
            <p class="artifact-size">{{ formatFileSize(artifact.size) }}</p>
          </div>
          <div class="artifact-actions">
            <n-button size="small" @click="downloadArtifact(artifact)">
              <template #icon>
                <Download :size="14" />
              </template>
              下载
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试报告 -->
    <div class="test-reports" v-if="testResults">
      <h3 class="section-title">测试报告</h3>
      <div class="test-summary">
        <div class="test-stat success">
          <CheckCircle :size="24" />
          <div class="stat-content">
            <div class="stat-value">{{ testResults.passed }}</div>
            <div class="stat-label">通过</div>
          </div>
        </div>
        <div class="test-stat failed">
          <XCircle :size="24" />
          <div class="stat-content">
            <div class="stat-value">{{ testResults.failed }}</div>
            <div class="stat-label">失败</div>
          </div>
        </div>
        <div class="test-stat skipped">
          <Minus :size="24" />
          <div class="stat-content">
            <div class="stat-value">{{ testResults.skipped }}</div>
            <div class="stat-label">跳过</div>
          </div>
        </div>
        <div class="test-stat total">
          <Activity :size="24" />
          <div class="stat-content">
            <div class="stat-value">{{ testResults.total }}</div>
            <div class="stat-label">总计</div>
          </div>
        </div>
      </div>
      
      <div class="test-coverage" v-if="testResults.coverage">
        <h4 class="coverage-title">代码覆盖率</h4>
        <n-progress
          :percentage="testResults.coverage"
          :status="testResults.coverage >= 80 ? 'success' : testResults.coverage >= 60 ? 'warning' : 'error'"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="detail-actions">
      <n-button @click="runPipeline" :loading="isRunning" type="primary">
        <template #icon>
          <Play :size="16" />
        </template>
        重新运行
      </n-button>
      <n-button @click="stopPipeline" v-if="pipeline.status === 'running'">
        <template #icon>
          <Square :size="16" />
        </template>
        停止运行
      </n-button>
      <n-button @click="editPipeline">
        <template #icon>
          <Settings :size="16" />
        </template>
        编辑配置
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  GitBranch, User, Clock, Calendar, ArrowDown, RefreshCw, Download,
  FileText, CheckCircle, XCircle, Minus, Activity, Play, Square, Settings
} from 'lucide-vue-next'

const props = defineProps<{
  pipeline: any
}>()

const message = useMessage()

const logsLoading = ref(false)
const isRunning = ref(false)

// 构建日志
const buildLogs = ref(`
[2024-01-15 10:30:00] Starting pipeline execution...
[2024-01-15 10:30:01] Checking out code from repository
[2024-01-15 10:30:02] Repository: ${props.pipeline.repositoryUrl || 'https://github.com/example/repo.git'}
[2024-01-15 10:30:03] Branch: ${props.pipeline.branch}
[2024-01-15 10:30:05] Code checkout completed successfully
[2024-01-15 10:30:06] 
[2024-01-15 10:30:06] Starting build stage...
[2024-01-15 10:30:07] Installing dependencies...
[2024-01-15 10:30:08] npm install
[2024-01-15 10:30:15] Dependencies installed successfully
[2024-01-15 10:30:16] Running build command...
[2024-01-15 10:30:17] npm run build
[2024-01-15 10:30:25] Build completed successfully
[2024-01-15 10:30:26] 
[2024-01-15 10:30:26] Starting test stage...
[2024-01-15 10:30:27] Running tests...
[2024-01-15 10:30:28] npm test
[2024-01-15 10:30:35] Tests completed successfully
[2024-01-15 10:30:36] 
[2024-01-15 10:30:36] Starting deployment stage...
[2024-01-15 10:30:37] Deploying to production...
[2024-01-15 10:30:45] Deployment completed successfully
[2024-01-15 10:30:46] 
[2024-01-15 10:30:46] Pipeline execution completed successfully
`)

// 构建产物
const artifacts = ref([
  {
    name: 'dist.zip',
    size: 2048576, // 2MB
    url: '/artifacts/dist.zip'
  },
  {
    name: 'coverage-report.html',
    size: 512000, // 512KB
    url: '/artifacts/coverage-report.html'
  }
])

// 测试结果
const testResults = ref({
  passed: 45,
  failed: 2,
  skipped: 3,
  total: 50,
  coverage: 85
})

// 方法
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
    success: '执行成功',
    failed: '执行失败',
    running: '正在运行',
    pending: '等待执行',
    cancelled: '已取消'
  }
  return texts[status] || '未知状态'
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
    skipped: Minus
  }
  return icons[status] || Clock
}

const getStageStatusText = (status: string) => {
  const texts = {
    success: '已完成',
    failed: '失败',
    running: '运行中',
    pending: '等待中',
    skipped: '已跳过'
  }
  return texts[status] || '未知'
}

const getStageProgress = (status: string) => {
  const progress = {
    success: 100,
    failed: 100,
    running: 50,
    pending: 0,
    skipped: 100
  }
  return progress[status] || 0
}

const getProgressStatus = (status: string) => {
  const statusMap = {
    success: 'success',
    failed: 'error',
    running: 'info',
    pending: 'default',
    skipped: 'warning'
  }
  return statusMap[status] || 'default'
}

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  return `${minutes}分${seconds}秒`
}

const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatFileSize = (bytes: number) => {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const refreshLogs = async () => {
  logsLoading.value = true
  try {
    // 模拟刷新日志
    await new Promise(resolve => setTimeout(resolve, 1000))
    message.success('日志已刷新')
  } catch (error) {
    message.error('刷新日志失败')
  } finally {
    logsLoading.value = false
  }
}

const downloadLogs = () => {
  // 模拟下载日志
  const blob = new Blob([buildLogs.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pipeline-${props.pipeline.id}-logs.txt`
  a.click()
  URL.revokeObjectURL(url)
  message.success('日志下载已开始')
}

const downloadArtifact = (artifact: any) => {
  message.info(`开始下载 ${artifact.name}`)
  // 实际项目中这里会是真实的下载逻辑
}

const runPipeline = async () => {
  isRunning.value = true
  try {
    // 模拟重新运行流水线
    await new Promise(resolve => setTimeout(resolve, 2000))
    message.success('流水线已开始重新运行')
  } catch (error) {
    message.error('启动流水线失败')
  } finally {
    isRunning.value = false
  }
}

const stopPipeline = async () => {
  try {
    // 模拟停止流水线
    await new Promise(resolve => setTimeout(resolve, 1000))
    message.success('流水线已停止')
  } catch (error) {
    message.error('停止流水线失败')
  }
}

const editPipeline = () => {
  message.info('编辑功能开发中...')
}

onMounted(() => {
  // 如果流水线正在运行，可以定时刷新状态
  if (props.pipeline.status === 'running') {
    // 实际项目中这里会设置定时器刷新状态
  }
})
</script>

<style scoped>
.pipeline-detail {
  @apply space-y-6;
}

.pipeline-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.overview-header {
  @apply flex items-start justify-between mb-4;
}

.pipeline-name {
  @apply text-xl font-bold text-white mb-1;
}

.pipeline-project {
  @apply text-slate-400;
}

.overview-meta {
  @apply flex flex-wrap gap-6 text-sm text-slate-400;
}

.meta-item {
  @apply flex items-center gap-2;
}

.pipeline-stages {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.section-title {
  @apply text-lg font-semibold text-white mb-4;
}

.stages-container {
  @apply space-y-4;
}

.stage-item {
  @apply relative;
}

.stage-header {
  @apply flex items-center gap-4 p-4 rounded-lg;
}

.stage-success .stage-header {
  @apply bg-green-500/10 border border-green-500/20;
}

.stage-failed .stage-header {
  @apply bg-red-500/10 border border-red-500/20;
}

.stage-running .stage-header {
  @apply bg-yellow-500/10 border border-yellow-500/20;
}

.stage-pending .stage-header {
  @apply bg-slate-500/10 border border-slate-500/20;
}

.stage-skipped .stage-header {
  @apply bg-slate-600/10 border border-slate-600/20;
}

.stage-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center;
}

.stage-success .stage-icon {
  @apply bg-green-500/20 text-green-400;
}

.stage-failed .stage-icon {
  @apply bg-red-500/20 text-red-400;
}

.stage-running .stage-icon {
  @apply bg-yellow-500/20 text-yellow-400;
}

.stage-pending .stage-icon {
  @apply bg-slate-500/20 text-slate-400;
}

.stage-skipped .stage-icon {
  @apply bg-slate-600/20 text-slate-500;
}

.stage-info {
  @apply flex-1;
}

.stage-name {
  @apply font-semibold text-white;
}

.stage-status {
  @apply text-sm text-slate-400;
}

.stage-duration {
  @apply text-sm text-slate-400;
}

.stage-progress {
  @apply mt-2 px-4;
}

.stage-connector {
  @apply flex justify-center py-2 text-slate-600;
}

.build-logs {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50;
}

.logs-header {
  @apply flex items-center justify-between p-6 border-b border-slate-700/50;
}

.logs-actions {
  @apply flex items-center gap-2;
}

.logs-container {
  @apply p-6;
}

.logs-content {
  @apply bg-slate-900/50 rounded-lg p-4 max-h-96 overflow-auto;
}

.log-text {
  @apply text-sm text-slate-300 font-mono whitespace-pre-wrap;
}

.build-artifacts {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.artifacts-list {
  @apply space-y-3;
}

.artifact-item {
  @apply flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg;
}

.artifact-icon {
  @apply text-slate-400;
}

.artifact-info {
  @apply flex-1;
}

.artifact-name {
  @apply font-medium text-white;
}

.artifact-size {
  @apply text-sm text-slate-400;
}

.test-reports {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.test-summary {
  @apply grid grid-cols-2 md:grid-cols-4 gap-4 mb-6;
}

.test-stat {
  @apply flex items-center gap-3 p-4 rounded-lg;
}

.test-stat.success {
  @apply bg-green-500/10 border border-green-500/20;
}

.test-stat.failed {
  @apply bg-red-500/10 border border-red-500/20;
}

.test-stat.skipped {
  @apply bg-yellow-500/10 border border-yellow-500/20;
}

.test-stat.total {
  @apply bg-blue-500/10 border border-blue-500/20;
}

.test-stat .stat-content {
  @apply text-center;
}

.test-stat .stat-value {
  @apply text-xl font-bold text-white;
}

.test-stat .stat-label {
  @apply text-sm text-slate-400;
}

.test-coverage {
  @apply space-y-2;
}

.coverage-title {
  @apply font-medium text-white;
}

.detail-actions {
  @apply flex justify-end gap-3 pt-6 border-t border-slate-700/50;
}
</style>