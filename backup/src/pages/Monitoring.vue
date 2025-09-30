<template>
  <div class="monitoring-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">监控告警</h1>
          <p class="page-subtitle">实时监控系统状态，及时发现和处理异常</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshData" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button type="primary" @click="showAlertModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            创建告警规则
          </n-button>
        </div>
      </div>
    </div>

    <!-- 系统状态概览 -->
    <div class="system-overview">
      <div class="overview-cards">
        <div class="status-card healthy">
          <div class="card-header">
            <div class="card-icon">
              <Activity :size="24" />
            </div>
            <div class="card-title">系统状态</div>
          </div>
          <div class="card-content">
            <div class="status-indicator">
              <div class="status-dot"></div>
              <span class="status-text">健康</span>
            </div>
            <div class="uptime">运行时间: 99.9%</div>
          </div>
        </div>

        <div class="status-card">
          <div class="card-header">
            <div class="card-icon warning">
              <AlertTriangle :size="24" />
            </div>
            <div class="card-title">活跃告警</div>
          </div>
          <div class="card-content">
            <div class="metric-value">{{ activeAlerts.length }}</div>
            <div class="metric-breakdown">
              <span class="critical">{{ getCriticalCount() }} 严重</span>
              <span class="warning">{{ getWarningCount() }} 警告</span>
            </div>
          </div>
        </div>

        <div class="status-card">
          <div class="card-header">
            <div class="card-icon info">
              <Server :size="24" />
            </div>
            <div class="card-title">服务状态</div>
          </div>
          <div class="card-content">
            <div class="services-summary">
              <div class="service-stat">
                <span class="count">{{ getServiceCount('healthy') }}</span>
                <span class="label">正常</span>
              </div>
              <div class="service-stat">
                <span class="count">{{ getServiceCount('warning') }}</span>
                <span class="label">异常</span>
              </div>
            </div>
          </div>
        </div>

        <div class="status-card">
          <div class="card-header">
            <div class="card-icon success">
              <TrendingUp :size="24" />
            </div>
            <div class="card-title">性能指标</div>
          </div>
          <div class="card-content">
            <div class="performance-metrics">
              <div class="metric-item">
                <span class="metric-label">响应时间</span>
                <span class="metric-value">125ms</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">吞吐量</span>
                <span class="metric-value">1.2k/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 实时监控图表 -->
    <div class="monitoring-charts">
      <div class="charts-header">
        <h3 class="section-title">实时监控</h3>
        <div class="chart-controls">
          <n-select
            v-model:value="timeRange"
            :options="timeRangeOptions"
            size="small"
            style="width: 120px"
          />
          <n-button size="small" @click="toggleAutoRefresh">
            <template #icon>
              <component :is="autoRefresh ? Pause : Play" :size="14" />
            </template>
            {{ autoRefresh ? '暂停' : '开始' }}
          </n-button>
        </div>
      </div>
      
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <h4 class="chart-title">CPU使用率</h4>
            <div class="chart-value">{{ systemMetrics.cpu }}%</div>
          </div>
          <div class="chart-content">
            <div class="chart-placeholder">
              <BarChart3 :size="32" />
              <p>CPU使用率趋势图</p>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h4 class="chart-title">内存使用率</h4>
            <div class="chart-value">{{ systemMetrics.memory }}%</div>
          </div>
          <div class="chart-content">
            <div class="chart-placeholder">
              <BarChart3 :size="32" />
              <p>内存使用率趋势图</p>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h4 class="chart-title">网络流量</h4>
            <div class="chart-value">{{ systemMetrics.network }}MB/s</div>
          </div>
          <div class="chart-content">
            <div class="chart-placeholder">
              <BarChart3 :size="32" />
              <p>网络流量趋势图</p>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h4 class="chart-title">磁盘I/O</h4>
            <div class="chart-value">{{ systemMetrics.disk }}MB/s</div>
          </div>
          <div class="chart-content">
            <div class="chart-placeholder">
              <BarChart3 :size="32" />
              <p>磁盘I/O趋势图</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 服务监控 -->
    <div class="services-monitoring">
      <div class="services-header">
        <h3 class="section-title">服务监控</h3>
        <div class="services-filters">
          <n-select
            v-model:value="serviceFilter"
            :options="serviceFilterOptions"
            placeholder="筛选服务"
            clearable
            size="small"
            style="width: 150px"
          />
        </div>
      </div>
      
      <div class="services-grid">
        <div
          v-for="service in filteredServices"
          :key="service.name"
          class="service-card"
          :class="service.status"
        >
          <div class="service-header">
            <div class="service-info">
              <h4 class="service-name">{{ service.name }}</h4>
              <p class="service-description">{{ service.description }}</p>
            </div>
            <div class="service-status">
              <n-tag
                :type="getServiceStatusType(service.status)"
                :bordered="false"
                size="small"
              >
                <template #icon>
                  <component :is="getServiceStatusIcon(service.status)" :size="12" />
                </template>
                {{ getServiceStatusText(service.status) }}
              </n-tag>
            </div>
          </div>
          
          <div class="service-metrics">
            <div class="metric-row">
              <span class="metric-label">响应时间</span>
              <span class="metric-value">{{ service.responseTime }}ms</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">错误率</span>
              <span class="metric-value">{{ service.errorRate }}%</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">QPS</span>
              <span class="metric-value">{{ service.qps }}</span>
            </div>
          </div>
          
          <div class="service-actions">
            <n-button size="small" @click="viewServiceDetail(service)">
              详情
            </n-button>
            <n-button size="small" @click="restartService(service)" v-if="service.status === 'error'">
              重启
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 告警列表 -->
    <div class="alerts-section">
      <div class="alerts-header">
        <h3 class="section-title">告警列表</h3>
        <div class="alerts-filters">
          <n-select
            v-model:value="alertFilter"
            :options="alertFilterOptions"
            placeholder="筛选告警"
            clearable
            size="small"
            style="width: 120px"
          />
          <n-button size="small" @click="clearAllAlerts" v-if="activeAlerts.length > 0">
            清除所有
          </n-button>
        </div>
      </div>
      
      <div class="alerts-list">
        <div
          v-for="alert in filteredAlerts"
          :key="alert.id"
          class="alert-item"
          :class="alert.severity"
        >
          <div class="alert-severity">
            <component :is="getAlertIcon(alert.severity)" :size="20" />
          </div>
          <div class="alert-content">
            <h4 class="alert-title">{{ alert.title }}</h4>
            <p class="alert-description">{{ alert.description }}</p>
            <div class="alert-meta">
              <span class="alert-service">{{ alert.service }}</span>
              <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
            </div>
          </div>
          <div class="alert-actions">
            <n-button size="small" @click="acknowledgeAlert(alert)">
              确认
            </n-button>
            <n-button size="small" @click="resolveAlert(alert)">
              解决
            </n-button>
            <n-dropdown
              :options="getAlertActions(alert)"
              @select="handleAlertAction"
            >
              <n-button size="small">
                <template #icon>
                  <MoreVertical :size="14" />
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="filteredAlerts.length === 0" class="empty-alerts">
        <div class="empty-icon">
          <CheckCircle :size="48" />
        </div>
        <h3>暂无告警</h3>
        <p>系统运行正常，没有活跃的告警</p>
      </div>
    </div>

    <!-- 告警规则管理 -->
    <div class="alert-rules">
      <div class="rules-header">
        <h3 class="section-title">告警规则</h3>
        <div class="rules-actions">
          <n-button size="small" @click="importRules">
            <template #icon>
              <Upload :size="14" />
            </template>
            导入规则
          </n-button>
          <n-button size="small" @click="exportRules">
            <template #icon>
              <Download :size="14" />
            </template>
            导出规则
          </n-button>
        </div>
      </div>
      
      <div class="rules-list">
        <div
          v-for="rule in alertRules"
          :key="rule.id"
          class="rule-item"
        >
          <div class="rule-header">
            <div class="rule-info">
              <h4 class="rule-name">{{ rule.name }}</h4>
              <p class="rule-condition">{{ rule.condition }}</p>
            </div>
            <div class="rule-status">
              <n-switch
                v-model:value="rule.enabled"
                @update:value="toggleRule(rule)"
              />
            </div>
          </div>
          <div class="rule-details">
            <div class="rule-meta">
              <span class="rule-severity">严重级别: {{ rule.severity }}</span>
              <span class="rule-frequency">检查频率: {{ rule.frequency }}</span>
              <span class="rule-notifications">通知方式: {{ rule.notifications.join(', ') }}</span>
            </div>
          </div>
          <div class="rule-actions">
            <n-button size="small" @click="editRule(rule)">
              编辑
            </n-button>
            <n-button size="small" @click="testRule(rule)">
              测试
            </n-button>
            <n-button size="small" type="error" @click="deleteRule(rule)">
              删除
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建告警规则模态框 -->
    <n-modal v-model:show="showAlertModal" preset="card" title="创建告警规则" class="alert-modal">
      <div class="alert-form">
        <n-form :model="alertForm" label-placement="top">
          <n-form-item label="规则名称">
            <n-input v-model:value="alertForm.name" placeholder="输入规则名称" />
          </n-form-item>
          <n-form-item label="监控指标">
            <n-select
              v-model:value="alertForm.metric"
              :options="metricOptions"
              placeholder="选择监控指标"
            />
          </n-form-item>
          <n-form-item label="条件">
            <div class="condition-config">
              <n-select
                v-model:value="alertForm.operator"
                :options="operatorOptions"
                placeholder="操作符"
                style="width: 100px"
              />
              <n-input-number
                v-model:value="alertForm.threshold"
                placeholder="阈值"
                style="width: 120px"
              />
              <n-select
                v-model:value="alertForm.unit"
                :options="unitOptions"
                placeholder="单位"
                style="width: 80px"
              />
            </div>
          </n-form-item>
          <n-form-item label="严重级别">
            <n-select
              v-model:value="alertForm.severity"
              :options="severityOptions"
              placeholder="选择严重级别"
            />
          </n-form-item>
          <n-form-item label="检查频率">
            <n-select
              v-model:value="alertForm.frequency"
              :options="frequencyOptions"
              placeholder="选择检查频率"
            />
          </n-form-item>
          <n-form-item label="通知方式">
            <n-checkbox-group v-model:value="alertForm.notifications">
              <n-checkbox value="email">邮件</n-checkbox>
              <n-checkbox value="sms">短信</n-checkbox>
              <n-checkbox value="webhook">Webhook</n-checkbox>
              <n-checkbox value="slack">Slack</n-checkbox>
            </n-checkbox-group>
          </n-form-item>
          <n-form-item label="描述">
            <n-input
              v-model:value="alertForm.description"
              type="textarea"
              placeholder="输入规则描述"
              :rows="3"
            />
          </n-form-item>
        </n-form>
        <div class="modal-actions">
          <n-button @click="showAlertModal = false">取消</n-button>
          <n-button type="primary" @click="saveAlertRule">保存</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  RefreshCw, Plus, Activity, AlertTriangle, Server, TrendingUp,
  BarChart3, Play, Pause, CheckCircle, XCircle, Clock, MoreVertical,
  Upload, Download, Trash2
} from 'lucide-vue-next'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const timeRange = ref('1h')
const autoRefresh = ref(true)
const serviceFilter = ref(null)
const alertFilter = ref(null)
const showAlertModal = ref(false)

// 系统指标
const systemMetrics = ref({
  cpu: 45,
  memory: 68,
  network: 12.5,
  disk: 8.3
})

// 时间范围选项
const timeRangeOptions = [
  { label: '1小时', value: '1h' },
  { label: '6小时', value: '6h' },
  { label: '24小时', value: '24h' },
  { label: '7天', value: '7d' }
]

// 服务列表
const services = ref([
  {
    name: 'Web服务',
    description: '前端Web应用服务',
    status: 'healthy',
    responseTime: 125,
    errorRate: 0.1,
    qps: 1200
  },
  {
    name: 'API网关',
    description: 'API网关服务',
    status: 'healthy',
    responseTime: 89,
    errorRate: 0.05,
    qps: 2500
  },
  {
    name: '用户服务',
    description: '用户管理微服务',
    status: 'warning',
    responseTime: 245,
    errorRate: 2.1,
    qps: 800
  },
  {
    name: '数据库',
    description: 'PostgreSQL数据库',
    status: 'healthy',
    responseTime: 15,
    errorRate: 0,
    qps: 3200
  },
  {
    name: '缓存服务',
    description: 'Redis缓存服务',
    status: 'error',
    responseTime: 0,
    errorRate: 100,
    qps: 0
  }
])

// 服务筛选选项
const serviceFilterOptions = [
  { label: '正常', value: 'healthy' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' }
]

// 活跃告警
const activeAlerts = ref([
  {
    id: '1',
    title: 'Redis服务连接失败',
    description: '缓存服务无法连接，可能影响系统性能',
    service: '缓存服务',
    severity: 'critical',
    timestamp: new Date(Date.now() - 1000 * 60 * 5)
  },
  {
    id: '2',
    title: '用户服务响应时间过长',
    description: '用户服务平均响应时间超过200ms',
    service: '用户服务',
    severity: 'warning',
    timestamp: new Date(Date.now() - 1000 * 60 * 15)
  },
  {
    id: '3',
    title: 'CPU使用率偏高',
    description: 'Web服务器CPU使用率持续超过80%',
    service: 'Web服务',
    severity: 'warning',
    timestamp: new Date(Date.now() - 1000 * 60 * 30)
  }
])

// 告警筛选选项
const alertFilterOptions = [
  { label: '严重', value: 'critical' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' }
]

// 告警规则
const alertRules = ref([
  {
    id: '1',
    name: 'CPU使用率告警',
    condition: 'CPU使用率 > 80%',
    severity: '警告',
    frequency: '1分钟',
    notifications: ['邮件', 'Slack'],
    enabled: true
  },
  {
    id: '2',
    name: '内存使用率告警',
    condition: '内存使用率 > 90%',
    severity: '严重',
    frequency: '30秒',
    notifications: ['邮件', '短信', 'Webhook'],
    enabled: true
  },
  {
    id: '3',
    name: '服务响应时间告警',
    condition: '响应时间 > 500ms',
    severity: '警告',
    frequency: '2分钟',
    notifications: ['邮件'],
    enabled: false
  }
])

// 告警表单
const alertForm = ref({
  name: '',
  metric: '',
  operator: '',
  threshold: null,
  unit: '',
  severity: '',
  frequency: '',
  notifications: [],
  description: ''
})

// 表单选项
const metricOptions = [
  { label: 'CPU使用率', value: 'cpu' },
  { label: '内存使用率', value: 'memory' },
  { label: '磁盘使用率', value: 'disk' },
  { label: '网络流量', value: 'network' },
  { label: '响应时间', value: 'response_time' },
  { label: '错误率', value: 'error_rate' }
]

const operatorOptions = [
  { label: '>', value: '>' },
  { label: '>=', value: '>=' },
  { label: '<', value: '<' },
  { label: '<=', value: '<=' },
  { label: '=', value: '=' }
]

const unitOptions = [
  { label: '%', value: '%' },
  { label: 'ms', value: 'ms' },
  { label: 'MB', value: 'MB' },
  { label: 'GB', value: 'GB' }
]

const severityOptions = [
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '严重', value: 'critical' }
]

const frequencyOptions = [
  { label: '30秒', value: '30s' },
  { label: '1分钟', value: '1m' },
  { label: '2分钟', value: '2m' },
  { label: '5分钟', value: '5m' },
  { label: '10分钟', value: '10m' }
]

// 计算属性
const filteredServices = computed(() => {
  if (!serviceFilter.value) return services.value
  return services.value.filter(service => service.status === serviceFilter.value)
})

const filteredAlerts = computed(() => {
  if (!alertFilter.value) return activeAlerts.value
  return activeAlerts.value.filter(alert => alert.severity === alertFilter.value)
})

// 自动刷新定时器
let refreshTimer: NodeJS.Timeout | null = null

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    // 模拟数据刷新
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 更新系统指标
    systemMetrics.value = {
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 100),
      network: Math.floor(Math.random() * 50),
      disk: Math.floor(Math.random() * 30)
    }
    
    message.success('数据已刷新')
  } catch (error) {
    message.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    refreshData()
  }, 30000) // 30秒刷新一次
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

const getCriticalCount = () => {
  return activeAlerts.value.filter(alert => alert.severity === 'critical').length
}

const getWarningCount = () => {
  return activeAlerts.value.filter(alert => alert.severity === 'warning').length
}

const getServiceCount = (status: string) => {
  return services.value.filter(service => service.status === status).length
}

const getServiceStatusType = (status: string) => {
  const types = {
    healthy: 'success',
    warning: 'warning',
    error: 'error'
  }
  return types[status] || 'default'
}

const getServiceStatusIcon = (status: string) => {
  const icons = {
    healthy: CheckCircle,
    warning: AlertTriangle,
    error: XCircle
  }
  return icons[status] || Clock
}

const getServiceStatusText = (status: string) => {
  const texts = {
    healthy: '正常',
    warning: '警告',
    error: '错误'
  }
  return texts[status] || '未知'
}

const getAlertIcon = (severity: string) => {
  const icons = {
    critical: XCircle,
    warning: AlertTriangle,
    info: CheckCircle
  }
  return icons[severity] || CheckCircle
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const viewServiceDetail = (service: any) => {
  message.info(`查看 ${service.name} 详情`)
}

const restartService = async (service: any) => {
  try {
    message.info(`正在重启 ${service.name}...`)
    await new Promise(resolve => setTimeout(resolve, 2000))
    service.status = 'healthy'
    message.success(`${service.name} 重启成功`)
  } catch (error) {
    message.error(`${service.name} 重启失败`)
  }
}

const acknowledgeAlert = (alert: any) => {
  message.success(`已确认告警: ${alert.title}`)
}

const resolveAlert = (alert: any) => {
  const index = activeAlerts.value.findIndex(a => a.id === alert.id)
  if (index > -1) {
    activeAlerts.value.splice(index, 1)
    message.success(`已解决告警: ${alert.title}`)
  }
}

const clearAllAlerts = () => {
  activeAlerts.value = []
  message.success('已清除所有告警')
}

const getAlertActions = (alert: any) => {
  return [
    {
      label: '查看详情',
      key: 'detail',
      props: { alert }
    },
    {
      label: '静音1小时',
      key: 'mute',
      props: { alert }
    },
    {
      label: '删除',
      key: 'delete',
      props: { alert }
    }
  ]
}

const handleAlertAction = (key: string, option: any) => {
  const alert = option.props.alert
  switch (key) {
    case 'detail':
      message.info(`查看告警详情: ${alert.title}`)
      break
    case 'mute':
      message.info(`已静音告警: ${alert.title}`)
      break
    case 'delete':
      resolveAlert(alert)
      break
  }
}

const toggleRule = (rule: any) => {
  message.success(`告警规则 ${rule.name} 已${rule.enabled ? '启用' : '禁用'}`)
}

const editRule = (rule: any) => {
  message.info(`编辑规则: ${rule.name}`)
}

const testRule = (rule: any) => {
  message.info(`测试规则: ${rule.name}`)
}

const deleteRule = (rule: any) => {
  const index = alertRules.value.findIndex(r => r.id === rule.id)
  if (index > -1) {
    alertRules.value.splice(index, 1)
    message.success(`已删除规则: ${rule.name}`)
  }
}

const importRules = () => {
  message.info('导入规则功能开发中...')
}

const exportRules = () => {
  message.success('规则导出已开始')
}

const saveAlertRule = () => {
  // 验证表单
  if (!alertForm.value.name || !alertForm.value.metric) {
    message.error('请填写必填字段')
    return
  }
  
  // 添加新规则
  const newRule = {
    id: Date.now().toString(),
    name: alertForm.value.name,
    condition: `${alertForm.value.metric} ${alertForm.value.operator} ${alertForm.value.threshold}${alertForm.value.unit}`,
    severity: alertForm.value.severity,
    frequency: alertForm.value.frequency,
    notifications: alertForm.value.notifications,
    enabled: true
  }
  
  alertRules.value.push(newRule)
  message.success('告警规则已保存')
  showAlertModal.value = false
  
  // 重置表单
  alertForm.value = {
    name: '',
    metric: '',
    operator: '',
    threshold: null,
    unit: '',
    severity: '',
    frequency: '',
    notifications: [],
    description: ''
  }
}

onMounted(() => {
  if (autoRefresh.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.monitoring-page {
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

.system-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.overview-cards {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6;
}

.status-card {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.status-card.healthy {
  @apply border border-green-500/30 bg-green-500/5;
}

.card-header {
  @apply flex items-center justify-between mb-3;
}

.card-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center;
}

.card-icon.warning {
  @apply bg-yellow-500/20 text-yellow-400;
}

.card-icon.info {
  @apply bg-blue-500/20 text-blue-400;
}

.card-icon.success {
  @apply bg-green-500/20 text-green-400;
}

.status-card.healthy .card-icon {
  @apply bg-green-500/20 text-green-400;
}

.card-title {
  @apply text-sm text-slate-400;
}

.card-content {
  @apply space-y-2;
}

.status-indicator {
  @apply flex items-center gap-2;
}

.status-dot {
  @apply w-3 h-3 rounded-full bg-green-400 animate-pulse;
}

.status-text {
  @apply text-lg font-semibold text-green-400;
}

.uptime {
  @apply text-sm text-slate-400;
}

.metric-value {
  @apply text-2xl font-bold text-white;
}

.metric-breakdown {
  @apply flex items-center gap-3 text-sm;
}

.metric-breakdown .critical {
  @apply text-red-400;
}

.metric-breakdown .warning {
  @apply text-yellow-400;
}

.services-summary {
  @apply flex items-center gap-4;
}

.service-stat {
  @apply text-center;
}

.service-stat .count {
  @apply block text-xl font-bold text-white;
}

.service-stat .label {
  @apply text-sm text-slate-400;
}

.performance-metrics {
  @apply space-y-2;
}

.metric-item {
  @apply flex items-center justify-between text-sm;
}

.metric-label {
  @apply text-slate-400;
}

.metric-value {
  @apply text-white font-medium;
}

.monitoring-charts {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.charts-header {
  @apply flex items-center justify-between mb-6;
}

.section-title {
  @apply text-lg font-semibold text-white;
}

.chart-controls {
  @apply flex items-center gap-3;
}

.charts-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.chart-card {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.chart-header {
  @apply flex items-center justify-between mb-3;
}

.chart-title {
  @apply font-medium text-white;
}

.chart-value {
  @apply text-lg font-bold text-blue-400;
}

.chart-content {
  @apply h-32 flex items-center justify-center;
}

.chart-placeholder {
  @apply text-center text-slate-500;
}

.chart-placeholder p {
  @apply mt-2 text-sm;
}

.services-monitoring {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.services-header {
  @apply flex items-center justify-between mb-6;
}

.services-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.service-card {
  @apply bg-slate-700/30 rounded-lg p-4 border border-slate-600/30;
}

.service-card.healthy {
  @apply border-green-500/30 bg-green-500/5;
}

.service-card.warning {
  @apply border-yellow-500/30 bg-yellow-500/5;
}

.service-card.error {
  @apply border-red-500/30 bg-red-500/5;
}

.service-header {
  @apply flex items-start justify-between mb-3;
}

.service-name {
  @apply font-semibold text-white mb-1;
}

.service-description {
  @apply text-sm text-slate-400;
}

.service-metrics {
  @apply space-y-2 mb-3;
}

.metric-row {
  @apply flex items-center justify-between text-sm;
}

.metric-row .metric-label {
  @apply text-slate-400;
}

.metric-row .metric-value {
  @apply text-white font-medium;
}

.service-actions {
  @apply flex items-center gap-2;
}

.alerts-section {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.alerts-header {
  @apply flex items-center justify-between mb-6;
}

.alerts-filters {
  @apply flex items-center gap-3;
}

.alerts-list {
  @apply space-y-4;
}

.alert-item {
  @apply flex items-start gap-4 p-4 rounded-lg border;
}

.alert-item.critical {
  @apply bg-red-500/10 border-red-500/30;
}

.alert-item.warning {
  @apply bg-yellow-500/10 border-yellow-500/30;
}

.alert-item.info {
  @apply bg-blue-500/10 border-blue-500/30;
}

.alert-severity {
  @apply w-10 h-10 rounded-lg flex items-center justify-center;
}

.alert-item.critical .alert-severity {
  @apply bg-red-500/20 text-red-400;
}

.alert-item.warning .alert-severity {
  @apply bg-yellow-500/20 text-yellow-400;
}

.alert-item.info .alert-severity {
  @apply bg-blue-500/20 text-blue-400;
}

.alert-content {
  @apply flex-1;
}

.alert-title {
  @apply font-semibold text-white mb-1;
}

.alert-description {
  @apply text-sm text-slate-400 mb-2;
}

.alert-meta {
  @apply flex items-center gap-4 text-xs text-slate-500;
}

.alert-actions {
  @apply flex items-center gap-2;
}

.empty-alerts {
  @apply text-center py-16;
}

.empty-icon {
  @apply text-green-500 mb-4;
}

.empty-alerts h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.empty-alerts p {
  @apply text-slate-400;
}

.alert-rules {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.rules-header {
  @apply flex items-center justify-between mb-6;
}

.rules-actions {
  @apply flex items-center gap-2;
}

.rules-list {
  @apply space-y-4;
}

.rule-item {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.rule-header {
  @apply flex items-start justify-between mb-3;
}

.rule-name {
  @apply font-semibold text-white mb-1;
}

.rule-condition {
  @apply text-sm text-slate-400;
}

.rule-details {
  @apply mb-3;
}

.rule-meta {
  @apply flex flex-wrap gap-4 text-sm text-slate-400;
}

.rule-actions {
  @apply flex items-center gap-2;
}

.alert-modal {
  @apply w-full max-w-2xl;
}

.alert-form {
  @apply space-y-4;
}

.condition-config {
  @apply flex items-center gap-3;
}

.modal-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-slate-700/50;
}
</style>