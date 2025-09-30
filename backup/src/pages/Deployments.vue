<template>
  <div class="deployments-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">部署管理</h1>
          <p class="page-subtitle">管理应用部署、环境配置和发布策略</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshData" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button @click="showEnvironmentModal = true">
            <template #icon>
              <Settings :size="16" />
            </template>
            环境配置
          </n-button>
          <n-button type="primary" @click="showDeployModal = true">
            <template #icon>
              <Rocket :size="16" />
            </template>
            新建部署
          </n-button>
        </div>
      </div>
    </div>

    <!-- 环境概览 -->
    <div class="environments-overview">
      <div class="environments-grid">
        <div
          v-for="env in environments"
          :key="env.id"
          class="environment-card"
          :class="{ active: selectedEnvironment?.id === env.id }"
          @click="selectEnvironment(env)"
        >
          <div class="env-header">
            <div class="env-info">
              <h3 class="env-name">{{ env.name }}</h3>
              <p class="env-description">{{ env.description }}</p>
            </div>
            <div class="env-status">
              <n-tag
                :type="getEnvironmentStatusType(env.status)"
                :bordered="false"
                size="small"
              >
                {{ getEnvironmentStatusName(env.status) }}
              </n-tag>
            </div>
          </div>
          
          <div class="env-stats">
            <div class="stat-item">
              <span class="stat-label">应用数</span>
              <span class="stat-value">{{ env.applications.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">运行中</span>
              <span class="stat-value">{{ getRunningApps(env) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最后部署</span>
              <span class="stat-value">{{ formatTime(env.lastDeployment) }}</span>
            </div>
          </div>

          <div class="env-actions">
            <n-button size="small" @click.stop="deployToEnvironment(env)">
              <template #icon>
                <Play :size="14" />
              </template>
              部署
            </n-button>
            <n-dropdown
              :options="getEnvironmentActions(env)"
              @select="handleEnvironmentAction"
            >
              <n-button size="small" circle @click.stop>
                <template #icon>
                  <MoreVertical :size="14" />
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：部署历史 -->
      <div class="deployments-section">
        <div class="section-header">
          <h3 class="section-title">部署历史</h3>
          <div class="section-filters">
            <n-select
              v-model:value="environmentFilter"
              :options="environmentFilterOptions"
              placeholder="筛选环境"
              clearable
              size="small"
              style="width: 120px"
            />
            <n-select
              v-model:value="statusFilter"
              :options="deploymentStatusOptions"
              placeholder="筛选状态"
              clearable
              size="small"
              style="width: 120px"
            />
            <n-date-picker
              v-model:value="dateRange"
              type="daterange"
              clearable
              size="small"
              style="width: 200px"
            />
          </div>
        </div>

        <div class="deployments-list">
          <div
            v-for="deployment in filteredDeployments"
            :key="deployment.id"
            class="deployment-card"
            :class="{ active: selectedDeployment?.id === deployment.id }"
            @click="selectDeployment(deployment)"
          >
            <div class="deployment-header">
              <div class="deployment-info">
                <h4 class="deployment-title">{{ deployment.application }}</h4>
                <p class="deployment-version">v{{ deployment.version }}</p>
              </div>
              <div class="deployment-status">
                <n-tag
                  :type="getDeploymentStatusType(deployment.status)"
                  :bordered="false"
                  size="small"
                >
                  {{ getDeploymentStatusName(deployment.status) }}
                </n-tag>
              </div>
            </div>

            <div class="deployment-meta">
              <div class="meta-item">
                <Server :size="14" />
                <span>{{ deployment.environment }}</span>
              </div>
              <div class="meta-item">
                <User :size="14" />
                <span>{{ deployment.deployedBy }}</span>
              </div>
              <div class="meta-item">
                <Clock :size="14" />
                <span>{{ formatTime(deployment.deployedAt) }}</span>
              </div>
              <div class="meta-item">
                <Timer :size="14" />
                <span>{{ deployment.duration }}</span>
              </div>
            </div>

            <div class="deployment-progress" v-if="deployment.status === 'deploying'">
              <n-progress
                :percentage="deployment.progress"
                :show-indicator="false"
                size="small"
              />
              <span class="progress-text">{{ deployment.currentStep }}</span>
            </div>

            <div class="deployment-actions">
              <n-button
                v-if="deployment.status === 'success'"
                size="small"
                @click.stop="rollbackDeployment(deployment)"
              >
                <template #icon>
                  <RotateCcw :size="14" />
                </template>
                回滚
              </n-button>
              <n-button
                v-if="deployment.status === 'deploying'"
                size="small"
                type="error"
                @click.stop="cancelDeployment(deployment)"
              >
                <template #icon>
                  <X :size="14" />
                </template>
                取消
              </n-button>
              <n-button
                v-if="deployment.status === 'failed'"
                size="small"
                @click.stop="retryDeployment(deployment)"
              >
                <template #icon>
                  <RefreshCw :size="14" />
                </template>
                重试
              </n-button>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <n-pagination
            v-model:page="currentPage"
            :page-count="totalPages"
            size="small"
            show-size-picker
            :page-sizes="[10, 20, 50]"
            :page-size="pageSize"
            @update:page-size="handlePageSizeChange"
          />
        </div>
      </div>

      <!-- 右侧：部署详情 -->
      <div class="deployment-detail">
        <div v-if="selectedDeployment" class="detail-content">
          <!-- 部署概览 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">部署概览</h4>
              <div class="section-actions">
                <n-button size="small" @click="viewLogs(selectedDeployment)">
                  <template #icon>
                    <FileText :size="14" />
                  </template>
                  查看日志
                </n-button>
              </div>
            </div>
            
            <div class="deployment-overview">
              <div class="overview-grid">
                <div class="overview-item">
                  <span class="item-label">应用名称</span>
                  <span class="item-value">{{ selectedDeployment.application }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">版本</span>
                  <span class="item-value">v{{ selectedDeployment.version }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">环境</span>
                  <span class="item-value">{{ selectedDeployment.environment }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">部署策略</span>
                  <span class="item-value">{{ selectedDeployment.strategy }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">部署人</span>
                  <span class="item-value">{{ selectedDeployment.deployedBy }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">部署时间</span>
                  <span class="item-value">{{ formatDateTime(selectedDeployment.deployedAt) }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">持续时间</span>
                  <span class="item-value">{{ selectedDeployment.duration }}</span>
                </div>
                <div class="overview-item">
                  <span class="item-label">状态</span>
                  <n-tag
                    :type="getDeploymentStatusType(selectedDeployment.status)"
                    size="small"
                  >
                    {{ getDeploymentStatusName(selectedDeployment.status) }}
                  </n-tag>
                </div>
              </div>
            </div>
          </div>

          <!-- 部署步骤 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">部署步骤</h4>
            </div>
            
            <div class="deployment-steps">
              <div
                v-for="(step, index) in selectedDeployment.steps"
                :key="index"
                class="step-item"
                :class="getStepClass(step.status)"
              >
                <div class="step-indicator">
                  <CheckCircle v-if="step.status === 'completed'" :size="20" />
                  <AlertCircle v-else-if="step.status === 'failed'" :size="20" />
                  <Loader v-else-if="step.status === 'running'" :size="20" class="animate-spin" />
                  <Circle v-else :size="20" />
                </div>
                <div class="step-content">
                  <h5 class="step-name">{{ step.name }}</h5>
                  <p class="step-description">{{ step.description }}</p>
                  <div class="step-meta">
                    <span class="step-duration">{{ step.duration }}</span>
                    <span v-if="step.status === 'failed'" class="step-error">{{ step.error }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 配置信息 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">配置信息</h4>
            </div>
            
            <div class="config-info">
              <div class="config-section">
                <h5 class="config-title">环境变量</h5>
                <div class="config-list">
                  <div
                    v-for="(value, key) in selectedDeployment.config.environment"
                    :key="key"
                    class="config-item"
                  >
                    <span class="config-key">{{ key }}</span>
                    <span class="config-value">{{ value }}</span>
                  </div>
                </div>
              </div>
              
              <div class="config-section">
                <h5 class="config-title">资源配置</h5>
                <div class="config-list">
                  <div class="config-item">
                    <span class="config-key">CPU</span>
                    <span class="config-value">{{ selectedDeployment.config.resources.cpu }}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-key">内存</span>
                    <span class="config-value">{{ selectedDeployment.config.resources.memory }}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-key">实例数</span>
                    <span class="config-value">{{ selectedDeployment.config.resources.replicas }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 健康检查 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">健康检查</h4>
            </div>
            
            <div class="health-checks">
              <div
                v-for="check in selectedDeployment.healthChecks"
                :key="check.name"
                class="health-check-item"
              >
                <div class="check-header">
                  <div class="check-name">{{ check.name }}</div>
                  <n-tag
                    :type="getHealthCheckType(check.status)"
                    size="small"
                    :bordered="false"
                  >
                    {{ check.status }}
                  </n-tag>
                </div>
                <div class="check-details">
                  <div class="check-meta">
                    <span>{{ check.endpoint }}</span>
                    <span>{{ check.lastCheck }}</span>
                  </div>
                  <div v-if="check.message" class="check-message">{{ check.message }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else class="empty-detail">
          <div class="empty-icon">
            <Package :size="48" />
          </div>
          <h3>选择部署</h3>
          <p>请从左侧列表中选择一个部署查看详细信息</p>
        </div>
      </div>
    </div>

    <!-- 新建部署模态框 -->
    <n-modal v-model:show="showDeployModal" preset="card" title="新建部署" class="deploy-modal">
      <div class="deploy-form">
        <n-form :model="deployForm" label-placement="top">
          <div class="form-section">
            <h4 class="form-section-title">基本信息</h4>
            <div class="form-row">
              <n-form-item label="应用名称" class="form-item">
                <n-select
                  v-model:value="deployForm.application"
                  :options="applicationOptions"
                  placeholder="选择应用"
                />
              </n-form-item>
              <n-form-item label="版本" class="form-item">
                <n-input v-model:value="deployForm.version" placeholder="输入版本号" />
              </n-form-item>
            </div>
            <div class="form-row">
              <n-form-item label="目标环境" class="form-item">
                <n-select
                  v-model:value="deployForm.environment"
                  :options="environmentOptions"
                  placeholder="选择环境"
                />
              </n-form-item>
              <n-form-item label="部署策略" class="form-item">
                <n-select
                  v-model:value="deployForm.strategy"
                  :options="strategyOptions"
                  placeholder="选择策略"
                />
              </n-form-item>
            </div>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">配置信息</h4>
            <n-form-item label="环境变量">
              <n-dynamic-input
                v-model:value="deployForm.environmentVariables"
                :on-create="createEnvironmentVariable"
              >
                <template #default="{ value }">
                  <div class="env-var-input">
                    <n-input
                      v-model:value="value.key"
                      placeholder="变量名"
                      style="width: 40%"
                    />
                    <n-input
                      v-model:value="value.value"
                      placeholder="变量值"
                      style="width: 60%"
                    />
                  </div>
                </template>
              </n-dynamic-input>
            </n-form-item>
            
            <div class="form-row">
              <n-form-item label="CPU (核)" class="form-item">
                <n-input-number
                  v-model:value="deployForm.resources.cpu"
                  :min="0.1"
                  :step="0.1"
                  placeholder="CPU"
                />
              </n-form-item>
              <n-form-item label="内存 (GB)" class="form-item">
                <n-input-number
                  v-model:value="deployForm.resources.memory"
                  :min="0.5"
                  :step="0.5"
                  placeholder="内存"
                />
              </n-form-item>
              <n-form-item label="实例数" class="form-item">
                <n-input-number
                  v-model:value="deployForm.resources.replicas"
                  :min="1"
                  placeholder="实例数"
                />
              </n-form-item>
            </div>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">高级选项</h4>
            <n-form-item label="健康检查路径">
              <n-input v-model:value="deployForm.healthCheckPath" placeholder="/health" />
            </n-form-item>
            <div class="form-row">
              <n-form-item label="超时时间 (秒)" class="form-item">
                <n-input-number
                  v-model:value="deployForm.timeout"
                  :min="60"
                  placeholder="超时时间"
                />
              </n-form-item>
              <n-form-item label="重试次数" class="form-item">
                <n-input-number
                  v-model:value="deployForm.retries"
                  :min="0"
                  :max="5"
                  placeholder="重试次数"
                />
              </n-form-item>
            </div>
            <n-form-item>
              <n-checkbox v-model:checked="deployForm.autoRollback">
                部署失败时自动回滚
              </n-checkbox>
            </n-form-item>
          </div>
        </n-form>
        
        <div class="modal-actions">
          <n-button @click="showDeployModal = false">取消</n-button>
          <n-button type="primary" @click="startDeployment">开始部署</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 环境配置模态框 -->
    <n-modal v-model:show="showEnvironmentModal" preset="card" title="环境配置" class="environment-modal">
      <div class="environment-form">
        <n-tabs type="line" animated>
          <n-tab-pane name="list" tab="环境列表">
            <div class="environments-management">
              <div class="management-header">
                <n-button type="primary" @click="addEnvironment">
                  <template #icon>
                    <Plus :size="16" />
                  </template>
                  添加环境
                </n-button>
              </div>
              <div class="environments-table">
                <n-data-table
                  :columns="environmentColumns"
                  :data="environments"
                  :pagination="false"
                />
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="settings" tab="全局设置">
            <div class="global-settings">
              <n-form label-placement="top">
                <n-form-item label="默认部署策略">
                  <n-select
                    v-model:value="globalSettings.defaultStrategy"
                    :options="strategyOptions"
                  />
                </n-form-item>
                <n-form-item label="部署超时时间 (分钟)">
                  <n-input-number
                    v-model:value="globalSettings.deploymentTimeout"
                    :min="5"
                    :max="120"
                  />
                </n-form-item>
                <n-form-item>
                  <n-checkbox v-model:checked="globalSettings.enableNotifications">
                    启用部署通知
                  </n-checkbox>
                </n-form-item>
                <n-form-item>
                  <n-checkbox v-model:checked="globalSettings.requireApproval">
                    生产环境需要审批
                  </n-checkbox>
                </n-form-item>
              </n-form>
            </div>
          </n-tab-pane>
        </n-tabs>
        
        <div class="modal-actions">
          <n-button @click="showEnvironmentModal = false">关闭</n-button>
          <n-button type="primary" @click="saveEnvironmentSettings">保存设置</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  RefreshCw, Settings, Rocket, Play, MoreVertical, Server, User, Clock, Timer,
  RotateCcw, X, FileText, CheckCircle, AlertCircle, Loader, Circle, Package,
  Plus
} from 'lucide-vue-next'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const selectedEnvironment = ref(null)
const selectedDeployment = ref(null)
const showDeployModal = ref(false)
const showEnvironmentModal = ref(false)
const environmentFilter = ref(null)
const statusFilter = ref(null)
const dateRange = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)

// 环境数据
const environments = ref([
  {
    id: '1',
    name: '开发环境',
    description: '用于日常开发和测试',
    status: 'healthy',
    lastDeployment: new Date('2024-01-20T10:30:00'),
    applications: [
      { name: 'web-app', status: 'running' },
      { name: 'api-service', status: 'running' },
      { name: 'worker', status: 'stopped' }
    ]
  },
  {
    id: '2',
    name: '测试环境',
    description: '用于集成测试和QA验证',
    status: 'healthy',
    lastDeployment: new Date('2024-01-20T09:15:00'),
    applications: [
      { name: 'web-app', status: 'running' },
      { name: 'api-service', status: 'running' }
    ]
  },
  {
    id: '3',
    name: '预发布环境',
    description: '生产前最后验证环境',
    status: 'warning',
    lastDeployment: new Date('2024-01-19T16:45:00'),
    applications: [
      { name: 'web-app', status: 'running' },
      { name: 'api-service', status: 'error' }
    ]
  },
  {
    id: '4',
    name: '生产环境',
    description: '线上生产环境',
    status: 'healthy',
    lastDeployment: new Date('2024-01-19T14:20:00'),
    applications: [
      { name: 'web-app', status: 'running' },
      { name: 'api-service', status: 'running' },
      { name: 'worker', status: 'running' }
    ]
  }
])

// 部署历史数据
const deployments = ref([
  {
    id: '1',
    application: 'web-app',
    version: '1.2.3',
    environment: '生产环境',
    status: 'success',
    deployedBy: '张三',
    deployedAt: new Date('2024-01-20T10:30:00'),
    duration: '5分32秒',
    strategy: '滚动更新',
    progress: 100,
    currentStep: '部署完成',
    steps: [
      { name: '代码检出', description: '从Git仓库检出代码', status: 'completed', duration: '30秒' },
      { name: '构建镜像', description: '构建Docker镜像', status: 'completed', duration: '2分15秒' },
      { name: '推送镜像', description: '推送到镜像仓库', status: 'completed', duration: '45秒' },
      { name: '部署应用', description: '部署到Kubernetes集群', status: 'completed', duration: '1分30秒' },
      { name: '健康检查', description: '验证应用健康状态', status: 'completed', duration: '32秒' }
    ],
    config: {
      environment: {
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com',
        DATABASE_URL: 'postgresql://...'
      },
      resources: {
        cpu: '2',
        memory: '4GB',
        replicas: 3
      }
    },
    healthChecks: [
      {
        name: 'HTTP健康检查',
        endpoint: '/health',
        status: 'healthy',
        lastCheck: '2分钟前',
        message: '所有检查通过'
      },
      {
        name: '数据库连接',
        endpoint: '/health/db',
        status: 'healthy',
        lastCheck: '2分钟前'
      }
    ]
  },
  {
    id: '2',
    application: 'api-service',
    version: '2.1.0',
    environment: '测试环境',
    status: 'deploying',
    deployedBy: '李四',
    deployedAt: new Date('2024-01-20T11:00:00'),
    duration: '进行中',
    strategy: '蓝绿部署',
    progress: 65,
    currentStep: '部署新版本',
    steps: [
      { name: '代码检出', description: '从Git仓库检出代码', status: 'completed', duration: '25秒' },
      { name: '构建镜像', description: '构建Docker镜像', status: 'completed', duration: '1分50秒' },
      { name: '推送镜像', description: '推送到镜像仓库', status: 'completed', duration: '40秒' },
      { name: '部署应用', description: '部署到Kubernetes集群', status: 'running', duration: '进行中' },
      { name: '健康检查', description: '验证应用健康状态', status: 'pending' }
    ],
    config: {
      environment: {
        NODE_ENV: 'test',
        API_URL: 'https://test-api.example.com'
      },
      resources: {
        cpu: '1',
        memory: '2GB',
        replicas: 2
      }
    },
    healthChecks: []
  },
  {
    id: '3',
    application: 'worker',
    version: '1.0.5',
    environment: '开发环境',
    status: 'failed',
    deployedBy: '王五',
    deployedAt: new Date('2024-01-20T09:45:00'),
    duration: '3分12秒',
    strategy: '重新创建',
    progress: 0,
    currentStep: '部署失败',
    steps: [
      { name: '代码检出', description: '从Git仓库检出代码', status: 'completed', duration: '28秒' },
      { name: '构建镜像', description: '构建Docker镜像', status: 'completed', duration: '2分5秒' },
      { name: '推送镜像', description: '推送到镜像仓库', status: 'failed', duration: '39秒', error: '网络连接超时' }
    ],
    config: {
      environment: {
        NODE_ENV: 'development'
      },
      resources: {
        cpu: '0.5',
        memory: '1GB',
        replicas: 1
      }
    },
    healthChecks: []
  }
])

// 表单数据
const deployForm = ref({
  application: '',
  version: '',
  environment: '',
  strategy: 'rolling',
  environmentVariables: [{ key: '', value: '' }],
  resources: {
    cpu: 1,
    memory: 2,
    replicas: 1
  },
  healthCheckPath: '/health',
  timeout: 300,
  retries: 3,
  autoRollback: true
})

const globalSettings = ref({
  defaultStrategy: 'rolling',
  deploymentTimeout: 30,
  enableNotifications: true,
  requireApproval: true
})

// 选项数据
const environmentFilterOptions = computed(() => [
  { label: '全部环境', value: null },
  ...environments.value.map(env => ({ label: env.name, value: env.name }))
])

const deploymentStatusOptions = [
  { label: '全部状态', value: null },
  { label: '成功', value: 'success' },
  { label: '进行中', value: 'deploying' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' }
]

const applicationOptions = [
  { label: 'web-app', value: 'web-app' },
  { label: 'api-service', value: 'api-service' },
  { label: 'worker', value: 'worker' },
  { label: 'admin-panel', value: 'admin-panel' }
]

const environmentOptions = computed(() =>
  environments.value.map(env => ({ label: env.name, value: env.name }))
)

const strategyOptions = [
  { label: '滚动更新', value: 'rolling' },
  { label: '蓝绿部署', value: 'blue-green' },
  { label: '金丝雀发布', value: 'canary' },
  { label: '重新创建', value: 'recreate' }
]

const environmentColumns = [
  { title: '环境名称', key: 'name' },
  { title: '描述', key: 'description' },
  { title: '状态', key: 'status', render: (row) => getEnvironmentStatusName(row.status) },
  { title: '应用数', key: 'applications', render: (row) => row.applications.length },
  {
    title: '操作',
    key: 'actions',
    render: (row) => '编辑 | 删除'
  }
]

// 计算属性
const filteredDeployments = computed(() => {
  let filtered = deployments.value

  if (environmentFilter.value) {
    filtered = filtered.filter(d => d.environment === environmentFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(d => d.status === statusFilter.value)
  }

  if (dateRange.value && dateRange.value.length === 2) {
    const [start, end] = dateRange.value
    filtered = filtered.filter(d => {
      const deployDate = d.deployedAt.getTime()
      return deployDate >= start && deployDate <= end
    })
  }

  return filtered
})

const totalPages = computed(() => Math.ceil(filteredDeployments.value.length / pageSize.value))

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

const selectEnvironment = (env: any) => {
  selectedEnvironment.value = env
}

const selectDeployment = (deployment: any) => {
  selectedDeployment.value = deployment
}

const getEnvironmentStatusType = (status: string) => {
  const types = {
    healthy: 'success',
    warning: 'warning',
    error: 'error',
    offline: 'default'
  }
  return types[status] || 'default'
}

const getEnvironmentStatusName = (status: string) => {
  const names = {
    healthy: '健康',
    warning: '警告',
    error: '错误',
    offline: '离线'
  }
  return names[status] || status
}

const getRunningApps = (env: any) => {
  return env.applications.filter(app => app.status === 'running').length
}

const getDeploymentStatusType = (status: string) => {
  const types = {
    success: 'success',
    deploying: 'info',
    failed: 'error',
    cancelled: 'warning'
  }
  return types[status] || 'default'
}

const getDeploymentStatusName = (status: string) => {
  const names = {
    success: '成功',
    deploying: '部署中',
    failed: '失败',
    cancelled: '已取消'
  }
  return names[status] || status
}

const getStepClass = (status: string) => {
  return {
    completed: status === 'completed',
    running: status === 'running',
    failed: status === 'failed',
    pending: status === 'pending'
  }
}

const getHealthCheckType = (status: string) => {
  const types = {
    healthy: 'success',
    warning: 'warning',
    error: 'error'
  }
  return types[status] || 'default'
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

const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN')
}

const deployToEnvironment = (env: any) => {
  deployForm.value.environment = env.name
  showDeployModal.value = true
}

const getEnvironmentActions = (env: any) => {
  return [
    { label: '编辑环境', key: 'edit', props: { env } },
    { label: '查看日志', key: 'logs', props: { env } },
    { label: '重启服务', key: 'restart', props: { env } },
    { label: '删除环境', key: 'delete', props: { env } }
  ]
}

const handleEnvironmentAction = (key: string, option: any) => {
  const env = option.props.env
  message.info(`${key} - ${env.name}`)
}

const rollbackDeployment = (deployment: any) => {
  message.info(`回滚部署: ${deployment.application} v${deployment.version}`)
}

const cancelDeployment = (deployment: any) => {
  deployment.status = 'cancelled'
  message.success('部署已取消')
}

const retryDeployment = (deployment: any) => {
  deployment.status = 'deploying'
  deployment.progress = 0
  deployment.currentStep = '重新开始部署'
  message.info('重新开始部署')
}

const viewLogs = (deployment: any) => {
  message.info(`查看部署日志: ${deployment.application}`)
}

const handlePageSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const createEnvironmentVariable = () => {
  return { key: '', value: '' }
}

const startDeployment = () => {
  if (!deployForm.value.application || !deployForm.value.version || !deployForm.value.environment) {
    message.error('请填写必填字段')
    return
  }

  // 模拟创建部署
  const newDeployment = {
    id: Date.now().toString(),
    application: deployForm.value.application,
    version: deployForm.value.version,
    environment: deployForm.value.environment,
    status: 'deploying',
    deployedBy: '当前用户',
    deployedAt: new Date(),
    duration: '进行中',
    strategy: deployForm.value.strategy,
    progress: 0,
    currentStep: '开始部署',
    steps: [
      { name: '代码检出', description: '从Git仓库检出代码', status: 'running' },
      { name: '构建镜像', description: '构建Docker镜像', status: 'pending' },
      { name: '推送镜像', description: '推送到镜像仓库', status: 'pending' },
      { name: '部署应用', description: '部署到Kubernetes集群', status: 'pending' },
      { name: '健康检查', description: '验证应用健康状态', status: 'pending' }
    ],
    config: {
      environment: deployForm.value.environmentVariables.reduce((acc, item) => {
        if (item.key && item.value) {
          acc[item.key] = item.value
        }
        return acc
      }, {}),
      resources: deployForm.value.resources
    },
    healthChecks: []
  }

  deployments.value.unshift(newDeployment)
  selectedDeployment.value = newDeployment
  message.success('部署已开始')
  showDeployModal.value = false

  // 重置表单
  deployForm.value = {
    application: '',
    version: '',
    environment: '',
    strategy: 'rolling',
    environmentVariables: [{ key: '', value: '' }],
    resources: {
      cpu: 1,
      memory: 2,
      replicas: 1
    },
    healthCheckPath: '/health',
    timeout: 300,
    retries: 3,
    autoRollback: true
  }
}

const addEnvironment = () => {
  message.info('添加新环境')
}

const saveEnvironmentSettings = () => {
  message.success('环境设置已保存')
  showEnvironmentModal.value = false
}

onMounted(() => {
  // 默认选择第一个部署
  if (deployments.value.length > 0) {
    selectedDeployment.value = deployments.value[0]
  }
})
</script>

<style scoped>
.deployments-page {
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

.environments-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.environments-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4;
}

.environment-card {
  @apply bg-slate-700/30 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-slate-700/50;
}

.environment-card.active {
  @apply bg-blue-500/20 border border-blue-500/30;
}

.env-header {
  @apply flex items-start justify-between mb-3;
}

.env-name {
  @apply font-semibold text-white mb-1;
}

.env-description {
  @apply text-sm text-slate-400;
}

.env-stats {
  @apply grid grid-cols-3 gap-2 mb-3;
}

.stat-item {
  @apply text-center;
}

.stat-label {
  @apply text-xs text-slate-500 block;
}

.stat-value {
  @apply text-sm font-semibold text-white;
}

.env-actions {
  @apply flex items-center gap-2;
}

.main-content {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

.deployments-section {
  @apply lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.section-header {
  @apply flex items-center justify-between mb-6;
}

.section-title {
  @apply text-lg font-semibold text-white;
}

.section-filters {
  @apply flex items-center gap-3;
}

.deployments-list {
  @apply space-y-3 mb-6;
}

.deployment-card {
  @apply bg-slate-700/30 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-slate-700/50;
}

.deployment-card.active {
  @apply bg-blue-500/20 border border-blue-500/30;
}

.deployment-header {
  @apply flex items-start justify-between mb-3;
}

.deployment-title {
  @apply font-semibold text-white mb-1;
}

.deployment-version {
  @apply text-sm text-slate-400;
}

.deployment-meta {
  @apply flex flex-wrap items-center gap-4 mb-3 text-sm text-slate-400;
}

.meta-item {
  @apply flex items-center gap-1;
}

.deployment-progress {
  @apply mb-3;
}

.progress-text {
  @apply text-sm text-slate-400 mt-1;
}

.deployment-actions {
  @apply flex items-center gap-2;
}

.pagination-wrapper {
  @apply flex justify-center;
}

.deployment-detail {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.detail-content {
  @apply space-y-6;
}

.detail-section {
  @apply space-y-4;
}

.section-actions {
  @apply flex items-center gap-2;
}

.deployment-overview {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.overview-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.overview-item {
  @apply flex flex-col gap-1;
}

.item-label {
  @apply text-sm text-slate-400;
}

.item-value {
  @apply font-medium text-white;
}

.deployment-steps {
  @apply space-y-3;
}

.step-item {
  @apply flex items-start gap-3 p-3 rounded-lg;
}

.step-item.completed {
  @apply bg-green-500/10;
}

.step-item.running {
  @apply bg-blue-500/10;
}

.step-item.failed {
  @apply bg-red-500/10;
}

.step-item.pending {
  @apply bg-slate-700/30;
}

.step-indicator {
  @apply flex-shrink-0 mt-1;
}

.step-item.completed .step-indicator {
  @apply text-green-400;
}

.step-item.running .step-indicator {
  @apply text-blue-400;
}

.step-item.failed .step-indicator {
  @apply text-red-400;
}

.step-item.pending .step-indicator {
  @apply text-slate-500;
}

.step-content {
  @apply flex-1;
}

.step-name {
  @apply font-medium text-white mb-1;
}

.step-description {
  @apply text-sm text-slate-400 mb-2;
}

.step-meta {
  @apply flex items-center gap-4 text-xs text-slate-500;
}

.step-error {
  @apply text-red-400;
}

.config-info {
  @apply space-y-4;
}

.config-section {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.config-title {
  @apply font-medium text-white mb-3;
}

.config-list {
  @apply space-y-2;
}

.config-item {
  @apply flex items-center justify-between text-sm;
}

.config-key {
  @apply text-slate-400;
}

.config-value {
  @apply text-white font-mono;
}

.health-checks {
  @apply space-y-3;
}

.health-check-item {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.check-header {
  @apply flex items-center justify-between mb-2;
}

.check-name {
  @apply font-medium text-white;
}

.check-details {
  @apply space-y-1;
}

.check-meta {
  @apply flex items-center gap-4 text-sm text-slate-400;
}

.check-message {
  @apply text-sm text-slate-300;
}

.empty-detail {
  @apply text-center py-16;
}

.empty-icon {
  @apply text-slate-500 mb-4;
}

.empty-detail h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.empty-detail p {
  @apply text-slate-400;
}

.deploy-modal,
.environment-modal {
  @apply w-full max-w-4xl;
}

.deploy-form,
.environment-form {
  @apply space-y-4;
}

.form-section {
  @apply space-y-4;
}

.form-section-title {
  @apply text-lg font-semibold text-white border-b border-slate-700/50 pb-2;
}

.form-row {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.form-item {
  @apply flex-1;
}

.env-var-input {
  @apply flex items-center gap-2;
}

.modal-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-slate-700/50;
}

.environments-management {
  @apply space-y-4;
}

.management-header {
  @apply flex justify-end;
}

.environments-table {
  @apply bg-slate-700/30 rounded-lg;
}

.global-settings {
  @apply space-y-4;
}
</style>