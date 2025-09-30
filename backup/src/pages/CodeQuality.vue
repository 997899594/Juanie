<template>
  <div class="code-quality-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">代码质量管理</h1>
          <p class="page-subtitle">监控和提升代码质量，确保项目健康发展</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshData" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button type="primary" @click="runQualityCheck">
            <template #icon>
              <Play :size="16" />
            </template>
            运行质量检查
          </n-button>
        </div>
      </div>
    </div>

    <!-- 质量概览 -->
    <div class="quality-overview">
      <div class="overview-cards">
        <div class="quality-card">
          <div class="card-header">
            <div class="card-icon success">
              <Shield :size="24" />
            </div>
            <div class="card-title">质量评级</div>
          </div>
          <div class="card-content">
            <div class="quality-grade">{{ qualityData.grade }}</div>
            <div class="quality-score">{{ qualityData.score }}/100</div>
          </div>
        </div>

        <div class="quality-card">
          <div class="card-header">
            <div class="card-icon warning">
              <AlertTriangle :size="24" />
            </div>
            <div class="card-title">代码异味</div>
          </div>
          <div class="card-content">
            <div class="metric-value">{{ qualityData.codeSmells }}</div>
            <div class="metric-change" :class="getChangeClass(qualityData.codeSmellsChange)">
              <component :is="getChangeIcon(qualityData.codeSmellsChange)" :size="14" />
              {{ Math.abs(qualityData.codeSmellsChange) }}
            </div>
          </div>
        </div>

        <div class="quality-card">
          <div class="card-header">
            <div class="card-icon error">
              <Bug :size="24" />
            </div>
            <div class="card-title">Bug数量</div>
          </div>
          <div class="card-content">
            <div class="metric-value">{{ qualityData.bugs }}</div>
            <div class="metric-change" :class="getChangeClass(qualityData.bugsChange)">
              <component :is="getChangeIcon(qualityData.bugsChange)" :size="14" />
              {{ Math.abs(qualityData.bugsChange) }}
            </div>
          </div>
        </div>

        <div class="quality-card">
          <div class="card-header">
            <div class="card-icon info">
              <Target :size="24" />
            </div>
            <div class="card-title">测试覆盖率</div>
          </div>
          <div class="card-content">
            <div class="metric-value">{{ qualityData.coverage }}%</div>
            <div class="coverage-bar">
              <n-progress
                :percentage="qualityData.coverage"
                :status="qualityData.coverage >= 80 ? 'success' : qualityData.coverage >= 60 ? 'warning' : 'error'"
                :show-indicator="false"
                :height="6"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 质量趋势图表 -->
    <div class="quality-trends">
      <div class="trends-header">
        <h3 class="section-title">质量趋势</h3>
        <div class="trend-filters">
          <n-select
            v-model:value="trendPeriod"
            :options="trendPeriodOptions"
            size="small"
            style="width: 120px"
          />
        </div>
      </div>
      <div class="trends-chart">
        <div class="chart-placeholder">
          <BarChart3 :size="48" />
          <p>质量趋势图表</p>
          <p class="chart-note">显示代码质量指标的历史变化趋势</p>
        </div>
      </div>
    </div>

    <!-- 工具集成状态 -->
    <div class="tools-integration">
      <h3 class="section-title">工具集成状态</h3>
      <div class="tools-grid">
        <div class="tool-card" :class="{ active: tool.status === 'active' }" v-for="tool in tools" :key="tool.name">
          <div class="tool-header">
            <div class="tool-icon">
              <component :is="tool.icon" :size="24" />
            </div>
            <div class="tool-info">
              <h4 class="tool-name">{{ tool.name }}</h4>
              <p class="tool-description">{{ tool.description }}</p>
            </div>
            <div class="tool-status">
              <n-tag
                :type="tool.status === 'active' ? 'success' : tool.status === 'error' ? 'error' : 'warning'"
                :bordered="false"
                size="small"
              >
                {{ getToolStatusText(tool.status) }}
              </n-tag>
            </div>
          </div>
          <div class="tool-actions">
            <n-button
              size="small"
              @click="configureTool(tool)"
              v-if="tool.status !== 'active'"
            >
              配置
            </n-button>
            <n-button
              size="small"
              @click="runTool(tool)"
              v-if="tool.status === 'active'"
            >
              运行
            </n-button>
            <n-button
              size="small"
              @click="viewToolResults(tool)"
              v-if="tool.status === 'active'"
            >
              查看结果
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 质量门禁 -->
    <div class="quality-gates">
      <div class="gates-header">
        <h3 class="section-title">质量门禁</h3>
        <n-button size="small" @click="showGateModal = true">
          <template #icon>
            <Plus :size="14" />
          </template>
          添加门禁
        </n-button>
      </div>
      <div class="gates-list">
        <div class="gate-item" v-for="gate in qualityGates" :key="gate.id">
          <div class="gate-header">
            <div class="gate-info">
              <h4 class="gate-name">{{ gate.name }}</h4>
              <p class="gate-description">{{ gate.description }}</p>
            </div>
            <div class="gate-status">
              <n-tag
                :type="gate.status === 'passed' ? 'success' : gate.status === 'failed' ? 'error' : 'warning'"
                :bordered="false"
              >
                <template #icon>
                  <component :is="getGateStatusIcon(gate.status)" :size="14" />
                </template>
                {{ getGateStatusText(gate.status) }}
              </n-tag>
            </div>
          </div>
          <div class="gate-conditions">
            <div class="condition-item" v-for="condition in gate.conditions" :key="condition.metric">
              <div class="condition-metric">{{ condition.metric }}</div>
              <div class="condition-operator">{{ condition.operator }}</div>
              <div class="condition-threshold">{{ condition.threshold }}</div>
              <div class="condition-current" :class="getConditionClass(condition.status)">
                {{ condition.currentValue }}
              </div>
              <div class="condition-status">
                <component :is="getConditionIcon(condition.status)" :size="16" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 代码分析报告 -->
    <div class="analysis-reports">
      <div class="reports-header">
        <h3 class="section-title">分析报告</h3>
        <div class="reports-actions">
          <n-button size="small" @click="exportReport">
            <template #icon>
              <Download :size="14" />
            </template>
            导出报告
          </n-button>
        </div>
      </div>
      <div class="reports-tabs">
        <n-tabs v-model:value="activeReportTab" type="line">
          <n-tab-pane name="issues" tab="问题列表">
            <div class="issues-list">
              <div class="issue-item" v-for="issue in issues" :key="issue.id">
                <div class="issue-severity" :class="issue.severity">
                  <component :is="getSeverityIcon(issue.severity)" :size="16" />
                </div>
                <div class="issue-content">
                  <h4 class="issue-title">{{ issue.title }}</h4>
                  <p class="issue-description">{{ issue.description }}</p>
                  <div class="issue-meta">
                    <span class="issue-file">{{ issue.file }}</span>
                    <span class="issue-line">第{{ issue.line }}行</span>
                    <span class="issue-rule">{{ issue.rule }}</span>
                  </div>
                </div>
                <div class="issue-actions">
                  <n-button size="small" @click="fixIssue(issue)">
                    修复
                  </n-button>
                  <n-button size="small" @click="ignoreIssue(issue)">
                    忽略
                  </n-button>
                </div>
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="metrics" tab="指标详情">
            <div class="metrics-grid">
              <div class="metric-card" v-for="metric in detailedMetrics" :key="metric.name">
                <div class="metric-header">
                  <h4 class="metric-name">{{ metric.name }}</h4>
                  <div class="metric-trend" :class="getMetricTrendClass(metric.trend)">
                    <component :is="getMetricTrendIcon(metric.trend)" :size="14" />
                  </div>
                </div>
                <div class="metric-value">{{ metric.value }}</div>
                <div class="metric-description">{{ metric.description }}</div>
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="history" tab="历史记录">
            <div class="history-list">
              <div class="history-item" v-for="record in analysisHistory" :key="record.id">
                <div class="history-time">{{ formatDateTime(record.timestamp) }}</div>
                <div class="history-content">
                  <div class="history-title">{{ record.title }}</div>
                  <div class="history-summary">{{ record.summary }}</div>
                </div>
                <div class="history-result" :class="record.result">
                  <component :is="getResultIcon(record.result)" :size="16" />
                  {{ getResultText(record.result) }}
                </div>
              </div>
            </div>
          </n-tab-pane>
        </n-tabs>
      </div>
    </div>

    <!-- 质量门禁配置模态框 -->
    <n-modal v-model:show="showGateModal" preset="card" title="配置质量门禁" class="gate-modal">
      <div class="gate-form">
        <n-form :model="gateForm" label-placement="top">
          <n-form-item label="门禁名称">
            <n-input v-model:value="gateForm.name" placeholder="输入门禁名称" />
          </n-form-item>
          <n-form-item label="描述">
            <n-input
              v-model:value="gateForm.description"
              type="textarea"
              placeholder="输入门禁描述"
              :rows="3"
            />
          </n-form-item>
          <n-form-item label="条件配置">
            <div class="conditions-config">
              <div class="condition-row" v-for="(condition, index) in gateForm.conditions" :key="index">
                <n-select
                  v-model:value="condition.metric"
                  :options="metricOptions"
                  placeholder="选择指标"
                  style="width: 150px"
                />
                <n-select
                  v-model:value="condition.operator"
                  :options="operatorOptions"
                  placeholder="操作符"
                  style="width: 100px"
                />
                <n-input-number
                  v-model:value="condition.threshold"
                  placeholder="阈值"
                  style="width: 120px"
                />
                <n-button @click="removeCondition(index)" size="small" type="error">
                  <template #icon>
                    <Trash2 :size="14" />
                  </template>
                </n-button>
              </div>
              <n-button @click="addCondition" size="small" dashed block>
                <template #icon>
                  <Plus :size="14" />
                </template>
                添加条件
              </n-button>
            </div>
          </n-form-item>
        </n-form>
        <div class="modal-actions">
          <n-button @click="showGateModal = false">取消</n-button>
          <n-button type="primary" @click="saveQualityGate">保存</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  RefreshCw, Play, Shield, AlertTriangle, Bug, Target, BarChart3,
  Plus, Download, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown,
  Minus, FileText, Settings, Trash2, ArrowUp, ArrowDown
} from 'lucide-vue-next'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const trendPeriod = ref('7d')
const activeReportTab = ref('issues')
const showGateModal = ref(false)

// 质量数据
const qualityData = ref({
  grade: 'A',
  score: 85,
  codeSmells: 23,
  codeSmellsChange: -5,
  bugs: 3,
  bugsChange: -2,
  coverage: 78
})

// 趋势周期选项
const trendPeriodOptions = [
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '90天', value: '90d' }
]

// 工具集成
const tools = ref([
  {
    name: 'SonarQube',
    description: '代码质量和安全分析',
    icon: Shield,
    status: 'active'
  },
  {
    name: 'ESLint',
    description: 'JavaScript代码检查',
    icon: FileText,
    status: 'active'
  },
  {
    name: 'Prettier',
    description: '代码格式化工具',
    icon: Settings,
    status: 'active'
  },
  {
    name: 'Vitest',
    description: '单元测试框架',
    icon: Target,
    status: 'warning'
  }
])

// 质量门禁
const qualityGates = ref([
  {
    id: '1',
    name: '主分支门禁',
    description: '主分支合并前的质量检查',
    status: 'passed',
    conditions: [
      {
        metric: '代码覆盖率',
        operator: '>=',
        threshold: 80,
        currentValue: 85,
        status: 'passed'
      },
      {
        metric: 'Bug数量',
        operator: '<=',
        threshold: 5,
        currentValue: 3,
        status: 'passed'
      },
      {
        metric: '代码异味',
        operator: '<=',
        threshold: 30,
        currentValue: 23,
        status: 'passed'
      }
    ]
  },
  {
    id: '2',
    name: '发布门禁',
    description: '生产环境发布前的质量检查',
    status: 'failed',
    conditions: [
      {
        metric: '代码覆盖率',
        operator: '>=',
        threshold: 90,
        currentValue: 85,
        status: 'failed'
      },
      {
        metric: 'Bug数量',
        operator: '<=',
        threshold: 0,
        currentValue: 3,
        status: 'failed'
      }
    ]
  }
])

// 问题列表
const issues = ref([
  {
    id: '1',
    severity: 'high',
    title: '潜在的空指针异常',
    description: '变量可能为null，需要添加空值检查',
    file: 'src/utils/helper.ts',
    line: 45,
    rule: 'typescript:no-null-check'
  },
  {
    id: '2',
    severity: 'medium',
    title: '未使用的变量',
    description: '变量声明后未被使用',
    file: 'src/components/UserCard.vue',
    line: 23,
    rule: 'eslint:no-unused-vars'
  },
  {
    id: '3',
    severity: 'low',
    title: '代码复杂度过高',
    description: '函数的圈复杂度超过建议值',
    file: 'src/services/api.ts',
    line: 78,
    rule: 'sonar:complexity'
  }
])

// 详细指标
const detailedMetrics = ref([
  {
    name: '圈复杂度',
    value: '12.5',
    description: '平均圈复杂度',
    trend: 'down'
  },
  {
    name: '重复代码',
    value: '2.3%',
    description: '重复代码比例',
    trend: 'down'
  },
  {
    name: '技术债务',
    value: '4.2h',
    description: '预估修复时间',
    trend: 'up'
  },
  {
    name: '可维护性',
    value: 'A',
    description: '可维护性评级',
    trend: 'stable'
  }
])

// 分析历史
const analysisHistory = ref([
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    title: '代码质量分析',
    summary: '发现23个代码异味，3个Bug',
    result: 'warning'
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    title: '安全扫描',
    summary: '未发现安全漏洞',
    result: 'success'
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    title: '测试覆盖率检查',
    summary: '覆盖率78%，低于目标值',
    result: 'error'
  }
])

// 门禁表单
const gateForm = ref({
  name: '',
  description: '',
  conditions: [
    {
      metric: '',
      operator: '',
      threshold: null
    }
  ]
})

// 指标选项
const metricOptions = [
  { label: '代码覆盖率', value: 'coverage' },
  { label: 'Bug数量', value: 'bugs' },
  { label: '代码异味', value: 'code_smells' },
  { label: '安全漏洞', value: 'vulnerabilities' },
  { label: '重复代码', value: 'duplicated_lines' }
]

// 操作符选项
const operatorOptions = [
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '=', value: '=' }
]

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    message.success('数据已刷新')
  } catch (error) {
    message.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const runQualityCheck = async () => {
  try {
    message.info('正在运行质量检查...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    message.success('质量检查完成')
  } catch (error) {
    message.error('质量检查失败')
  }
}

const getChangeClass = (change: number) => {
  return change > 0 ? 'increase' : change < 0 ? 'decrease' : 'stable'
}

const getChangeIcon = (change: number) => {
  return change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
}

const getToolStatusText = (status: string) => {
  const texts = {
    active: '已激活',
    warning: '需配置',
    error: '错误'
  }
  return texts[status] || '未知'
}

const getGateStatusIcon = (status: string) => {
  const icons = {
    passed: CheckCircle,
    failed: XCircle,
    pending: Clock
  }
  return icons[status] || Clock
}

const getGateStatusText = (status: string) => {
  const texts = {
    passed: '通过',
    failed: '失败',
    pending: '待检查'
  }
  return texts[status] || '未知'
}

const getConditionClass = (status: string) => {
  return status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'warning'
}

const getConditionIcon = (status: string) => {
  const icons = {
    passed: CheckCircle,
    failed: XCircle,
    pending: Clock
  }
  return icons[status] || Clock
}

const getSeverityIcon = (severity: string) => {
  const icons = {
    high: XCircle,
    medium: AlertTriangle,
    low: Minus
  }
  return icons[severity] || Minus
}

const getMetricTrendClass = (trend: string) => {
  return trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-stable'
}

const getMetricTrendIcon = (trend: string) => {
  const icons = {
    up: ArrowUp,
    down: ArrowDown,
    stable: Minus
  }
  return icons[trend] || Minus
}

const getResultIcon = (result: string) => {
  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle
  }
  return icons[result] || Clock
}

const getResultText = (result: string) => {
  const texts = {
    success: '成功',
    warning: '警告',
    error: '失败'
  }
  return texts[result] || '未知'
}

const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const configureTool = (tool: any) => {
  message.info(`配置 ${tool.name}...`)
}

const runTool = (tool: any) => {
  message.info(`运行 ${tool.name}...`)
}

const viewToolResults = (tool: any) => {
  message.info(`查看 ${tool.name} 结果...`)
}

const fixIssue = (issue: any) => {
  message.info(`修复问题: ${issue.title}`)
}

const ignoreIssue = (issue: any) => {
  message.info(`忽略问题: ${issue.title}`)
}

const exportReport = () => {
  message.success('报告导出已开始')
}

const addCondition = () => {
  gateForm.value.conditions.push({
    metric: '',
    operator: '',
    threshold: null
  })
}

const removeCondition = (index: number) => {
  gateForm.value.conditions.splice(index, 1)
}

const saveQualityGate = () => {
  message.success('质量门禁已保存')
  showGateModal.value = false
  // 重置表单
  gateForm.value = {
    name: '',
    description: '',
    conditions: [{ metric: '', operator: '', threshold: null }]
  }
}

onMounted(() => {
  // 初始化数据
})
</script>

<style scoped>
.code-quality-page {
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

.quality-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.overview-cards {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6;
}

.quality-card {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.card-header {
  @apply flex items-center justify-between mb-3;
}

.card-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center;
}

.card-icon.success {
  @apply bg-green-500/20 text-green-400;
}

.card-icon.warning {
  @apply bg-yellow-500/20 text-yellow-400;
}

.card-icon.error {
  @apply bg-red-500/20 text-red-400;
}

.card-icon.info {
  @apply bg-blue-500/20 text-blue-400;
}

.card-title {
  @apply text-sm text-slate-400;
}

.card-content {
  @apply space-y-2;
}

.quality-grade {
  @apply text-3xl font-bold text-green-400;
}

.quality-score {
  @apply text-sm text-slate-400;
}

.metric-value {
  @apply text-2xl font-bold text-white;
}

.metric-change {
  @apply flex items-center gap-1 text-sm;
}

.metric-change.increase {
  @apply text-red-400;
}

.metric-change.decrease {
  @apply text-green-400;
}

.metric-change.stable {
  @apply text-slate-400;
}

.coverage-bar {
  @apply mt-2;
}

.quality-trends {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.trends-header {
  @apply flex items-center justify-between mb-6;
}

.section-title {
  @apply text-lg font-semibold text-white;
}

.trends-chart {
  @apply h-64 flex items-center justify-center;
}

.chart-placeholder {
  @apply text-center text-slate-500;
}

.chart-placeholder p {
  @apply mt-2;
}

.chart-note {
  @apply text-sm;
}

.tools-integration {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.tools-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.tool-card {
  @apply bg-slate-700/30 rounded-lg p-4 border border-slate-600/30;
}

.tool-card.active {
  @apply border-green-500/30 bg-green-500/5;
}

.tool-header {
  @apply flex items-start gap-3 mb-3;
}

.tool-icon {
  @apply text-slate-400;
}

.tool-info {
  @apply flex-1;
}

.tool-name {
  @apply font-semibold text-white mb-1;
}

.tool-description {
  @apply text-sm text-slate-400;
}

.tool-actions {
  @apply flex items-center gap-2;
}

.quality-gates {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.gates-header {
  @apply flex items-center justify-between mb-6;
}

.gates-list {
  @apply space-y-4;
}

.gate-item {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.gate-header {
  @apply flex items-start justify-between mb-4;
}

.gate-name {
  @apply font-semibold text-white mb-1;
}

.gate-description {
  @apply text-sm text-slate-400;
}

.gate-conditions {
  @apply space-y-2;
}

.condition-item {
  @apply grid grid-cols-5 gap-4 items-center p-3 bg-slate-600/20 rounded-lg text-sm;
}

.condition-metric {
  @apply text-white;
}

.condition-operator {
  @apply text-slate-400 text-center;
}

.condition-threshold {
  @apply text-slate-400 text-center;
}

.condition-current {
  @apply text-center font-medium;
}

.condition-current.success {
  @apply text-green-400;
}

.condition-current.error {
  @apply text-red-400;
}

.condition-current.warning {
  @apply text-yellow-400;
}

.condition-status {
  @apply flex justify-center;
}

.analysis-reports {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.reports-header {
  @apply flex items-center justify-between mb-6;
}

.issues-list {
  @apply space-y-4;
}

.issue-item {
  @apply flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg;
}

.issue-severity {
  @apply w-8 h-8 rounded-lg flex items-center justify-center;
}

.issue-severity.high {
  @apply bg-red-500/20 text-red-400;
}

.issue-severity.medium {
  @apply bg-yellow-500/20 text-yellow-400;
}

.issue-severity.low {
  @apply bg-blue-500/20 text-blue-400;
}

.issue-content {
  @apply flex-1;
}

.issue-title {
  @apply font-semibold text-white mb-1;
}

.issue-description {
  @apply text-sm text-slate-400 mb-2;
}

.issue-meta {
  @apply flex items-center gap-4 text-xs text-slate-500;
}

.issue-actions {
  @apply flex items-center gap-2;
}

.metrics-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.metric-card {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.metric-header {
  @apply flex items-center justify-between mb-2;
}

.metric-name {
  @apply font-medium text-white;
}

.metric-trend {
  @apply w-6 h-6 rounded flex items-center justify-center;
}

.metric-trend.trend-up {
  @apply bg-red-500/20 text-red-400;
}

.metric-trend.trend-down {
  @apply bg-green-500/20 text-green-400;
}

.metric-trend.trend-stable {
  @apply bg-slate-500/20 text-slate-400;
}

.metric-value {
  @apply text-xl font-bold text-white mb-1;
}

.metric-description {
  @apply text-sm text-slate-400;
}

.history-list {
  @apply space-y-3;
}

.history-item {
  @apply flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg;
}

.history-time {
  @apply text-sm text-slate-400 w-20;
}

.history-content {
  @apply flex-1;
}

.history-title {
  @apply font-medium text-white;
}

.history-summary {
  @apply text-sm text-slate-400;
}

.history-result {
  @apply flex items-center gap-1 text-sm;
}

.history-result.success {
  @apply text-green-400;
}

.history-result.warning {
  @apply text-yellow-400;
}

.history-result.error {
  @apply text-red-400;
}

.gate-modal {
  @apply w-full max-w-2xl;
}

.gate-form {
  @apply space-y-4;
}

.conditions-config {
  @apply space-y-3;
}

.condition-row {
  @apply flex items-center gap-3;
}

.modal-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-slate-700/50;
}
</style>