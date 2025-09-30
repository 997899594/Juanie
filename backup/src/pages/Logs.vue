<template>
  <div class="logs-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">日志管理</h1>
      <div class="header-actions">
        <n-button type="primary" @click="refreshLogs">
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button type="primary" @click="showExportModal = true">
          <template #icon>
            <n-icon><DownloadIcon /></n-icon>
          </template>
          导出日志
        </n-button>
        <n-button type="primary" @click="showAlertRuleModal = true">
          <template #icon>
            <n-icon><BellIcon /></n-icon>
          </template>
          告警规则
        </n-button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="overview-cards">
      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">今日日志量</span>
          <n-icon class="card-icon" color="#3b82f6">
            <FileTextIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ formatNumber(logStats.todayCount) }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+12.5%</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">错误日志</span>
          <n-icon class="card-icon" color="#ef4444">
            <AlertTriangleIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ formatNumber(logStats.errorCount) }}</div>
        <div class="card-trend trend-down">
          <n-icon><TrendingDownIcon /></n-icon>
          <span>-8.2%</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">警告日志</span>
          <n-icon class="card-icon" color="#f59e0b">
            <AlertCircleIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ formatNumber(logStats.warningCount) }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+3.1%</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">活跃服务</span>
          <n-icon class="card-icon" color="#10b981">
            <ServerIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ logStats.activeServices }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+2</span>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-section">
      <div class="chart-card">
        <h3 class="chart-title">日志趋势</h3>
        <div class="chart-placeholder">
          日志量趋势图表 (集成 ECharts)
        </div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">日志级别分布</h3>
        <div class="chart-placeholder">
          日志级别饼图 (集成 ECharts)
        </div>
      </div>
    </div>

    <!-- 日志搜索和过滤 -->
    <div class="search-section">
      <div class="search-header">
        <h3 class="section-title">日志查询</h3>
        <div class="search-actions">
          <n-button @click="clearFilters">清空筛选</n-button>
          <n-button type="primary" @click="searchLogs">搜索</n-button>
        </div>
      </div>
      
      <div class="search-filters">
        <div class="filter-row">
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索日志内容..."
            clearable
            style="width: 300px;"
          >
            <template #prefix>
              <n-icon><SearchIcon /></n-icon>
            </template>
          </n-input>
          
          <n-select
            v-model:value="selectedLevel"
            placeholder="日志级别"
            clearable
            style="width: 150px;"
            :options="logLevelOptions"
          />
          
          <n-select
            v-model:value="selectedService"
            placeholder="服务名称"
            clearable
            style="width: 200px;"
            :options="serviceOptions"
          />
          
          <n-date-picker
            v-model:value="dateRange"
            type="datetimerange"
            clearable
            style="width: 350px;"
          />
        </div>
        
        <div class="filter-row">
          <n-input
            v-model:value="hostFilter"
            placeholder="主机名"
            clearable
            style="width: 200px;"
          />
          
          <n-input
            v-model:value="userFilter"
            placeholder="用户ID"
            clearable
            style="width: 150px;"
          />
          
          <n-select
            v-model:value="selectedEnvironment"
            placeholder="环境"
            clearable
            style="width: 150px;"
            :options="environmentOptions"
          />
        </div>
      </div>
    </div>

    <!-- 日志列表 -->
    <div class="logs-table-section">
      <div class="table-header">
        <h3 class="section-title">日志记录</h3>
        <div class="table-actions">
          <n-button-group>
            <n-button 
              :type="viewMode === 'table' ? 'primary' : 'default'"
              @click="viewMode = 'table'"
            >
              <template #icon>
                <n-icon><TableIcon /></n-icon>
              </template>
              表格视图
            </n-button>
            <n-button 
              :type="viewMode === 'raw' ? 'primary' : 'default'"
              @click="viewMode = 'raw'"
            >
              <template #icon>
                <n-icon><CodeIcon /></n-icon>
              </template>
              原始日志
            </n-button>
          </n-button-group>
        </div>
      </div>

      <!-- 表格视图 -->
      <div v-if="viewMode === 'table'" class="table-view">
        <n-data-table
          :columns="logColumns"
          :data="filteredLogs"
          :pagination="pagination"
          :loading="loading"
          striped
          :row-class-name="getRowClassName"
        />
      </div>

      <!-- 原始日志视图 -->
      <div v-else class="raw-view">
        <div class="raw-logs">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            :class="['log-entry', `log-${log.level.toLowerCase()}`]"
          >
            <div class="log-header">
              <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
              <span :class="['log-level', `level-${log.level.toLowerCase()}`]">
                {{ log.level }}
              </span>
              <span class="log-service">{{ log.service }}</span>
            </div>
            <div class="log-content">{{ log.message }}</div>
            <div v-if="log.details" class="log-details">
              <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出日志模态框 -->
    <n-modal v-model:show="showExportModal" preset="dialog" title="导出日志">
      <div class="export-form">
        <div class="form-group">
          <label class="form-label">导出格式</label>
          <n-radio-group v-model:value="exportFormat">
            <n-radio value="json">JSON</n-radio>
            <n-radio value="csv">CSV</n-radio>
            <n-radio value="txt">TXT</n-radio>
          </n-radio-group>
        </div>
        
        <div class="form-group">
          <label class="form-label">时间范围</label>
          <n-date-picker
            v-model:value="exportDateRange"
            type="datetimerange"
            style="width: 100%;"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">日志级别</label>
          <n-checkbox-group v-model:value="exportLevels">
            <n-checkbox value="ERROR">错误</n-checkbox>
            <n-checkbox value="WARN">警告</n-checkbox>
            <n-checkbox value="INFO">信息</n-checkbox>
            <n-checkbox value="DEBUG">调试</n-checkbox>
          </n-checkbox-group>
        </div>
        
        <div class="form-group">
          <label class="form-label">最大记录数</label>
          <n-input-number
            v-model:value="exportMaxRecords"
            :min="1"
            :max="100000"
            style="width: 100%;"
          />
        </div>
      </div>
      
      <template #action>
        <n-button @click="showExportModal = false">取消</n-button>
        <n-button type="primary" @click="exportLogs">导出</n-button>
      </template>
    </n-modal>

    <!-- 告警规则模态框 -->
    <n-modal v-model:show="showAlertRuleModal" preset="dialog" title="告警规则管理" style="width: 800px;">
      <div class="alert-rules-content">
        <div class="rules-header">
          <n-button type="primary" @click="showCreateRuleModal = true">
            <template #icon>
              <n-icon><PlusIcon /></n-icon>
            </template>
            新建规则
          </n-button>
        </div>
        
        <div class="rules-list">
          <div
            v-for="rule in alertRules"
            :key="rule.id"
            class="rule-card"
          >
            <div class="rule-header">
              <div class="rule-info">
                <h4 class="rule-name">{{ rule.name }}</h4>
                <p class="rule-description">{{ rule.description }}</p>
              </div>
              <div class="rule-actions">
                <n-switch v-model:value="rule.enabled" />
                <n-button size="small" @click="editRule(rule)">编辑</n-button>
                <n-button size="small" type="error" @click="deleteRule(rule.id)">删除</n-button>
              </div>
            </div>
            
            <div class="rule-details">
              <div class="rule-condition">
                <strong>条件:</strong> {{ rule.condition }}
              </div>
              <div class="rule-threshold">
                <strong>阈值:</strong> {{ rule.threshold }}
              </div>
              <div class="rule-notification">
                <strong>通知方式:</strong> {{ rule.notificationMethods.join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- 创建告警规则模态框 -->
    <n-modal v-model:show="showCreateRuleModal" preset="dialog" title="创建告警规则" style="width: 600px;">
      <div class="create-rule-form">
        <div class="form-group">
          <label class="form-label">规则名称</label>
          <n-input v-model:value="ruleForm.name" placeholder="输入规则名称" />
        </div>
        
        <div class="form-group">
          <label class="form-label">描述</label>
          <n-input
            v-model:value="ruleForm.description"
            type="textarea"
            placeholder="输入规则描述"
            :rows="3"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">监控条件</label>
          <n-select
            v-model:value="ruleForm.condition"
            placeholder="选择监控条件"
            :options="conditionOptions"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">阈值</label>
          <n-input-number
            v-model:value="ruleForm.threshold"
            placeholder="输入阈值"
            style="width: 100%;"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">时间窗口 (分钟)</label>
          <n-input-number
            v-model:value="ruleForm.timeWindow"
            :min="1"
            :max="1440"
            style="width: 100%;"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">通知方式</label>
          <n-checkbox-group v-model:value="ruleForm.notificationMethods">
            <n-checkbox value="email">邮件</n-checkbox>
            <n-checkbox value="sms">短信</n-checkbox>
            <n-checkbox value="webhook">Webhook</n-checkbox>
            <n-checkbox value="slack">Slack</n-checkbox>
          </n-checkbox-group>
        </div>
      </div>
      
      <template #action>
        <n-button @click="showCreateRuleModal = false">取消</n-button>
        <n-button type="primary" @click="createAlertRule">创建</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  RefreshIcon,
  DownloadIcon,
  BellIcon,
  FileTextIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  ServerIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SearchIcon,
  TableIcon,
  CodeIcon,
  PlusIcon
} from '@vicons/lucide'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const viewMode = ref<'table' | 'raw'>('table')
const showExportModal = ref(false)
const showAlertRuleModal = ref(false)
const showCreateRuleModal = ref(false)

// 搜索和过滤
const searchQuery = ref('')
const selectedLevel = ref<string | null>(null)
const selectedService = ref<string | null>(null)
const selectedEnvironment = ref<string | null>(null)
const dateRange = ref<[number, number] | null>(null)
const hostFilter = ref('')
const userFilter = ref('')

// 导出配置
const exportFormat = ref('json')
const exportDateRange = ref<[number, number] | null>(null)
const exportLevels = ref(['ERROR', 'WARN', 'INFO'])
const exportMaxRecords = ref(10000)

// 告警规则表单
const ruleForm = reactive({
  name: '',
  description: '',
  condition: '',
  threshold: 0,
  timeWindow: 5,
  notificationMethods: [] as string[]
})

// 统计数据
const logStats = reactive({
  todayCount: 1234567,
  errorCount: 1234,
  warningCount: 5678,
  activeServices: 24
})

// 模拟日志数据
const logs = ref([
  {
    id: '1',
    timestamp: new Date('2024-01-15T10:30:00'),
    level: 'ERROR',
    service: 'user-service',
    host: 'web-01',
    user: 'user123',
    environment: 'production',
    message: 'Database connection failed: Connection timeout after 30s',
    details: {
      error: 'ConnectionTimeoutException',
      stack: 'at DatabaseConnection.connect()',
      query: 'SELECT * FROM users WHERE id = ?'
    }
  },
  {
    id: '2',
    timestamp: new Date('2024-01-15T10:29:45'),
    level: 'WARN',
    service: 'payment-service',
    host: 'web-02',
    user: 'user456',
    environment: 'production',
    message: 'Payment processing took longer than expected: 5.2s',
    details: {
      duration: 5200,
      paymentId: 'pay_123456',
      amount: 99.99
    }
  },
  {
    id: '3',
    timestamp: new Date('2024-01-15T10:29:30'),
    level: 'INFO',
    service: 'auth-service',
    host: 'web-01',
    user: 'user789',
    environment: 'production',
    message: 'User login successful',
    details: {
      userId: 'user789',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0...'
    }
  },
  {
    id: '4',
    timestamp: new Date('2024-01-15T10:29:15'),
    level: 'DEBUG',
    service: 'order-service',
    host: 'web-03',
    user: 'user101',
    environment: 'staging',
    message: 'Processing order validation',
    details: {
      orderId: 'order_789',
      items: 3,
      total: 156.78
    }
  }
])

// 告警规则数据
const alertRules = ref([
  {
    id: '1',
    name: '错误日志告警',
    description: '当错误日志数量超过阈值时触发告警',
    condition: 'error_count_per_minute',
    threshold: 10,
    timeWindow: 5,
    enabled: true,
    notificationMethods: ['email', 'slack']
  },
  {
    id: '2',
    name: '服务响应时间告警',
    description: '当服务响应时间超过阈值时触发告警',
    condition: 'response_time_avg',
    threshold: 3000,
    timeWindow: 10,
    enabled: true,
    notificationMethods: ['email', 'webhook']
  }
])

// 选项数据
const logLevelOptions = [
  { label: '错误', value: 'ERROR' },
  { label: '警告', value: 'WARN' },
  { label: '信息', value: 'INFO' },
  { label: '调试', value: 'DEBUG' }
]

const serviceOptions = computed(() => {
  const services = [...new Set(logs.value.map(log => log.service))]
  return services.map(service => ({ label: service, value: service }))
})

const environmentOptions = [
  { label: '生产环境', value: 'production' },
  { label: '测试环境', value: 'staging' },
  { label: '开发环境', value: 'development' }
]

const conditionOptions = [
  { label: '每分钟错误数', value: 'error_count_per_minute' },
  { label: '平均响应时间', value: 'response_time_avg' },
  { label: '服务可用性', value: 'service_availability' },
  { label: '内存使用率', value: 'memory_usage' },
  { label: 'CPU使用率', value: 'cpu_usage' }
]

// 表格列配置
const logColumns = [
  {
    title: '时间',
    key: 'timestamp',
    width: 180,
    render: (row: any) => formatTimestamp(row.timestamp)
  },
  {
    title: '级别',
    key: 'level',
    width: 80,
    render: (row: any) => {
      const levelClass = `level-${row.level.toLowerCase()}`
      return `<span class="log-level ${levelClass}">${row.level}</span>`
    }
  },
  {
    title: '服务',
    key: 'service',
    width: 120
  },
  {
    title: '主机',
    key: 'host',
    width: 100
  },
  {
    title: '用户',
    key: 'user',
    width: 100
  },
  {
    title: '环境',
    key: 'environment',
    width: 100
  },
  {
    title: '消息',
    key: 'message',
    ellipsis: {
      tooltip: true
    }
  }
]

// 分页配置
const pagination = reactive({
  page: 1,
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  showQuickJumper: true,
  itemCount: 0
})

// 计算属性
const filteredLogs = computed(() => {
  let filtered = logs.value

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(log =>
      log.message.toLowerCase().includes(query) ||
      log.service.toLowerCase().includes(query)
    )
  }

  // 级别过滤
  if (selectedLevel.value) {
    filtered = filtered.filter(log => log.level === selectedLevel.value)
  }

  // 服务过滤
  if (selectedService.value) {
    filtered = filtered.filter(log => log.service === selectedService.value)
  }

  // 环境过滤
  if (selectedEnvironment.value) {
    filtered = filtered.filter(log => log.environment === selectedEnvironment.value)
  }

  // 主机过滤
  if (hostFilter.value) {
    filtered = filtered.filter(log =>
      log.host.toLowerCase().includes(hostFilter.value.toLowerCase())
    )
  }

  // 用户过滤
  if (userFilter.value) {
    filtered = filtered.filter(log =>
      log.user.toLowerCase().includes(userFilter.value.toLowerCase())
    )
  }

  // 时间范围过滤
  if (dateRange.value) {
    const [start, end] = dateRange.value
    filtered = filtered.filter(log =>
      log.timestamp.getTime() >= start && log.timestamp.getTime() <= end
    )
  }

  pagination.itemCount = filtered.length
  return filtered
})

// 方法
const formatNumber = (num: number) => {
  return num.toLocaleString()
}

const formatTimestamp = (timestamp: Date) => {
  return timestamp.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getRowClassName = (row: any) => {
  return `log-row-${row.level.toLowerCase()}`
}

const refreshLogs = () => {
  loading.value = true
  // 模拟刷新
  setTimeout(() => {
    loading.value = false
    message.success('日志已刷新')
  }, 1000)
}

const searchLogs = () => {
  loading.value = true
  // 模拟搜索
  setTimeout(() => {
    loading.value = false
    message.success(`找到 ${filteredLogs.value.length} 条日志`)
  }, 500)
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedLevel.value = null
  selectedService.value = null
  selectedEnvironment.value = null
  dateRange.value = null
  hostFilter.value = ''
  userFilter.value = ''
  message.success('筛选条件已清空')
}

const exportLogs = () => {
  // 模拟导出
  message.success(`正在导出 ${exportFormat.value.toUpperCase()} 格式的日志...`)
  showExportModal.value = false
}

const createAlertRule = () => {
  const newRule = {
    id: Date.now().toString(),
    ...ruleForm,
    enabled: true
  }
  
  alertRules.value.push(newRule)
  message.success(`告警规则 "${ruleForm.name}" 创建成功`)
  
  // 重置表单
  Object.assign(ruleForm, {
    name: '',
    description: '',
    condition: '',
    threshold: 0,
    timeWindow: 5,
    notificationMethods: []
  })
  
  showCreateRuleModal.value = false
}

const editRule = (rule: any) => {
  Object.assign(ruleForm, rule)
  showCreateRuleModal.value = true
}

const deleteRule = (ruleId: string) => {
  const index = alertRules.value.findIndex(rule => rule.id === ruleId)
  if (index > -1) {
    alertRules.value.splice(index, 1)
    message.success('告警规则已删除')
  }
}

onMounted(() => {
  // 初始化数据
  pagination.itemCount = logs.value.length
})
</script>

<style scoped>
.logs-page {
  padding: 24px;
  background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
  min-height: 100vh;
  color: white;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(45deg, #fff, #e0e7ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.overview-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.overview-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.card-icon {
  font-size: 24px;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  color: white;
}

.card-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

.trend-up {
  color: #10b981;
}

.trend-down {
  color: #f59e0b;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.chart-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: white;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.search-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: white;
}

.search-actions {
  display: flex;
  gap: 12px;
}

.search-filters {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.logs-table-section {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.table-actions {
  display: flex;
  gap: 12px;
}

.table-view {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

.raw-view {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.raw-logs {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.log-entry {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid;
}

.log-entry.log-error {
  background: rgba(239, 68, 68, 0.1);
  border-left-color: #ef4444;
}

.log-entry.log-warn {
  background: rgba(245, 158, 11, 0.1);
  border-left-color: #f59e0b;
}

.log-entry.log-info {
  background: rgba(59, 130, 246, 0.1);
  border-left-color: #3b82f6;
}

.log-entry.log-debug {
  background: rgba(156, 163, 175, 0.1);
  border-left-color: #9ca3af;
}

.log-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.log-timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.log-level {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
}

.log-level.level-error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.log-level.level-warn {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.log-level.level-info {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.log-level.level-debug {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

.log-service {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.log-content {
  color: white;
  line-height: 1.5;
  margin-bottom: 8px;
}

.log-details {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 8px;
  font-size: 11px;
}

.log-details pre {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
}

.export-form,
.create-rule-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.alert-rules-content {
  max-height: 500px;
  overflow-y: auto;
}

.rules-header {
  margin-bottom: 20px;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-card {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e5e5e5;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.rule-info {
  flex: 1;
}

.rule-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #333;
}

.rule-description {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.rule-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rule-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #555;
}

.rule-condition,
.rule-threshold,
.rule-notification {
  padding: 4px 0;
}

/* 表格行样式 */
:deep(.log-row-error) {
  background: rgba(239, 68, 68, 0.05) !important;
}

:deep(.log-row-warn) {
  background: rgba(245, 158, 11, 0.05) !important;
}

:deep(.log-row-info) {
  background: rgba(59, 130, 246, 0.05) !important;
}

:deep(.log-row-debug) {
  background: rgba(156, 163, 175, 0.05) !important;
}

/* 表格内的日志级别样式 */
:deep(.log-level) {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
}

:deep(.log-level.level-error) {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

:deep(.log-level.level-warn) {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

:deep(.log-level.level-info) {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

:deep(.log-level.level-debug) {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

@media (max-width: 768px) {
  .logs-page {
    padding: 16px;
  }
  
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .charts-section {
    grid-template-columns: 1fr;
  }
  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-row > * {
    width: 100% !important;
  }
  
  .table-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .search-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .rule-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .rule-actions {
    justify-content: flex-start;
  }
}
</style>