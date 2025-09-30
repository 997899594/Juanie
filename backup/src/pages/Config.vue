<template>
  <div class="config-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">配置管理中心</h1>
      <div class="header-actions">
        <n-button type="primary" @click="refreshConfigs">
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button type="primary" @click="showCreateConfigModal = true">
          <template #icon>
            <n-icon><PlusIcon /></n-icon>
          </template>
          新建配置
        </n-button>
        <n-button type="primary" @click="showImportModal = true">
          <template #icon>
            <n-icon><UploadIcon /></n-icon>
          </template>
          导入配置
        </n-button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="overview-cards">
      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">配置总数</span>
          <n-icon class="card-icon" color="#3b82f6">
            <SettingsIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ configStats.totalConfigs }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+5</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">活跃环境</span>
          <n-icon class="card-icon" color="#10b981">
            <LayersIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ configStats.activeEnvironments }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+1</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">今日更新</span>
          <n-icon class="card-icon" color="#f59e0b">
            <EditIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ configStats.todayUpdates }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+12</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">版本数量</span>
          <n-icon class="card-icon" color="#8b5cf6">
            <GitBranchIcon />
          </n-icon>
        </div>
        <div class="card-value">{{ configStats.totalVersions }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+8</span>
        </div>
      </div>
    </div>

    <!-- 环境切换和筛选 -->
    <div class="filters-section">
      <div class="environment-tabs">
        <n-tabs
          v-model:value="selectedEnvironment"
          type="segment"
          @update:value="handleEnvironmentChange"
        >
          <n-tab-pane
            v-for="env in environments"
            :key="env.value"
            :name="env.value"
            :tab="env.label"
          />
        </n-tabs>
      </div>
      
      <div class="filters">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索配置..."
          clearable
          style="width: 300px;"
        >
          <template #prefix>
            <n-icon><SearchIcon /></n-icon>
          </template>
        </n-input>
        
        <n-select
          v-model:value="selectedNamespace"
          placeholder="命名空间"
          clearable
          style="width: 200px;"
          :options="namespaceOptions"
        />
        
        <n-select
          v-model:value="selectedType"
          placeholder="配置类型"
          clearable
          style="width: 150px;"
          :options="typeOptions"
        />
        
        <n-button @click="clearFilters">清空筛选</n-button>
      </div>
    </div>

    <!-- 配置列表 -->
    <div class="configs-section">
      <div class="section-header">
        <h3 class="section-title">配置列表</h3>
        <div class="section-actions">
          <n-button-group>
            <n-button 
              :type="viewMode === 'card' ? 'primary' : 'default'"
              @click="viewMode = 'card'"
            >
              <template #icon>
                <n-icon><GridIcon /></n-icon>
              </template>
              卡片视图
            </n-button>
            <n-button 
              :type="viewMode === 'table' ? 'primary' : 'default'"
              @click="viewMode = 'table'"
            >
              <template #icon>
                <n-icon><ListIcon /></n-icon>
              </template>
              列表视图
            </n-button>
          </n-button-group>
        </div>
      </div>

      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="configs-grid">
        <!-- 空状态 -->
        <div v-if="filteredConfigs.length === 0" class="empty-state">
          <n-empty description="暂无配置数据">
            <template #extra>
              <n-button type="primary" @click="showCreateConfigModal = true">
                创建第一个配置
              </n-button>
            </template>
          </n-empty>
        </div>
        
        <div
          v-for="config in filteredConfigs"
          :key="config.id"
          class="config-card"
          @click="viewConfigDetail(config)"
        >
          <div class="config-header">
            <div class="config-info">
              <h4 class="config-name">{{ config.name }}</h4>
              <span class="config-namespace">{{ config.namespace }}</span>
            </div>
            <div class="config-actions">
              <n-dropdown :options="getConfigActions(config)" @select="handleConfigAction">
                <n-button size="small" quaternary>
                  <template #icon>
                    <n-icon><MoreVerticalIcon /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
          
          <div class="config-meta">
            <div class="meta-item">
              <span class="meta-label">类型:</span>
              <span :class="['meta-value', 'type-' + config.type.toLowerCase()]">
                {{ getTypeLabel(config.type) }}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">版本:</span>
              <span class="meta-value">v{{ config.version }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">更新时间:</span>
              <span class="meta-value">{{ formatTime(config.updatedAt) }}</span>
            </div>
          </div>
          
          <div class="config-description">
            {{ config.description || '暂无描述' }}
          </div>
          
          <div class="config-status">
            <n-tag
              :type="config.status === 'active' ? 'success' : 'warning'"
              size="small"
            >
              {{ config.status === 'active' ? '已激活' : '未激活' }}
            </n-tag>
            <span class="config-size">{{ formatSize(config.size) }}</span>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <div v-else class="configs-table">
        <!-- 空状态 -->
        <div v-if="filteredConfigs.length === 0" class="empty-state">
          <n-empty description="暂无配置数据">
            <template #extra>
              <n-button type="primary" @click="showCreateConfigModal = true">
                创建第一个配置
              </n-button>
            </template>
          </n-empty>
        </div>
        
        <n-data-table
          v-else
          :columns="configColumns"
          :data="filteredConfigs"
          :pagination="pagination"
          :loading="loading"
          striped
        />
      </div>
    </div>

    <!-- 配置详情抽屉 -->
    <n-drawer
      v-model:show="showConfigDetail"
      :width="800"
      placement="right"
    >
      <n-drawer-content title="配置详情">
        <div v-if="selectedConfig" class="config-detail">
          <!-- 基本信息 -->
          <div class="detail-section">
            <h4 class="detail-title">基本信息</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">配置名称:</span>
                <span class="detail-value">{{ selectedConfig.name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">命名空间:</span>
                <span class="detail-value">{{ selectedConfig.namespace }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">配置类型:</span>
                <span class="detail-value">{{ getTypeLabel(selectedConfig.type) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">当前版本:</span>
                <span class="detail-value">v{{ selectedConfig.version }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">状态:</span>
                <n-tag
                  :type="selectedConfig.status === 'active' ? 'success' : 'warning'"
                  size="small"
                >
                  {{ selectedConfig.status === 'active' ? '已激活' : '未激活' }}
                </n-tag>
              </div>
              <div class="detail-item">
                <span class="detail-label">文件大小:</span>
                <span class="detail-value">{{ formatSize(selectedConfig.size) }}</span>
              </div>
            </div>
          </div>

          <!-- 配置内容 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="detail-title">配置内容</h4>
              <div class="section-actions">
                <n-button size="small" @click="editConfig(selectedConfig)">
                  <template #icon>
                    <n-icon><EditIcon /></n-icon>
                  </template>
                  编辑
                </n-button>
                <n-button size="small" @click="downloadConfig(selectedConfig)">
                  <template #icon>
                    <n-icon><DownloadIcon /></n-icon>
                  </template>
                  下载
                </n-button>
              </div>
            </div>
            <div class="config-content">
              <n-code
                :code="selectedConfig.content"
                :language="getLanguage(selectedConfig.type)"
                show-line-numbers
              />
            </div>
          </div>

          <!-- 版本历史 -->
          <div class="detail-section">
            <h4 class="detail-title">版本历史</h4>
            <div class="version-list">
              <div
                v-for="version in selectedConfig.versions"
                :key="version.id"
                class="version-item"
              >
                <div class="version-info">
                  <span class="version-number">v{{ version.version }}</span>
                  <span class="version-time">{{ formatTime(version.createdAt) }}</span>
                  <span class="version-author">{{ version.author }}</span>
                </div>
                <div class="version-actions">
                  <n-button size="tiny" @click="compareVersion(version)">对比</n-button>
                  <n-button size="tiny" @click="rollbackVersion(version)">回滚</n-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 环境部署状态 -->
          <div class="detail-section">
            <h4 class="detail-title">环境部署状态</h4>
            <div class="deployment-status">
              <div
                v-for="env in selectedConfig.deployments"
                :key="env.environment"
                class="deployment-item"
              >
                <div class="deployment-info">
                  <span class="deployment-env">{{ env.environment }}</span>
                  <span class="deployment-version">v{{ env.version }}</span>
                </div>
                <div class="deployment-status-badge">
                  <n-tag
                    :type="env.status === 'deployed' ? 'success' : 'error'"
                    size="small"
                  >
                    {{ env.status === 'deployed' ? '已部署' : '部署失败' }}
                  </n-tag>
                </div>
                <div class="deployment-actions">
                  <n-button size="tiny" @click="deployToEnvironment(env)">部署</n-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- 创建配置模态框 -->
    <n-modal v-model:show="showCreateConfigModal" preset="dialog" title="创建配置" style="width: 800px;">
      <div class="create-config-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">配置名称</label>
            <n-input v-model:value="configForm.name" placeholder="输入配置名称" />
          </div>
          <div class="form-group">
            <label class="form-label">命名空间</label>
            <n-select
              v-model:value="configForm.namespace"
              placeholder="选择命名空间"
              :options="namespaceOptions"
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">配置类型</label>
            <n-select
              v-model:value="configForm.type"
              placeholder="选择配置类型"
              :options="typeOptions"
            />
          </div>
          <div class="form-group">
            <label class="form-label">环境</label>
            <n-select
              v-model:value="configForm.environment"
              placeholder="选择环境"
              :options="environments"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">描述</label>
          <n-input
            v-model:value="configForm.description"
            type="textarea"
            placeholder="输入配置描述"
            :rows="3"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">配置内容</label>
          <n-input
            v-model:value="configForm.content"
            type="textarea"
            placeholder="输入配置内容"
            :rows="10"
          />
        </div>
      </div>
      
      <template #action>
        <n-button @click="showCreateConfigModal = false">取消</n-button>
        <n-button type="primary" @click="createConfig">创建</n-button>
      </template>
    </n-modal>

    <!-- 导入配置模态框 -->
    <n-modal v-model:show="showImportModal" preset="dialog" title="导入配置">
      <div class="import-form">
        <div class="form-group">
          <label class="form-label">导入方式</label>
          <n-radio-group v-model:value="importMethod">
            <n-radio value="file">文件上传</n-radio>
            <n-radio value="url">URL导入</n-radio>
            <n-radio value="git">Git仓库</n-radio>
          </n-radio-group>
        </div>
        
        <div v-if="importMethod === 'file'" class="form-group">
          <label class="form-label">选择文件</label>
          <n-upload
            :default-file-list="[]"
            :max="1"
            accept=".json,.yaml,.yml,.properties,.xml"
          >
            <n-button>选择配置文件</n-button>
          </n-upload>
        </div>
        
        <div v-if="importMethod === 'url'" class="form-group">
          <label class="form-label">配置URL</label>
          <n-input v-model:value="importUrl" placeholder="输入配置文件URL" />
        </div>
        
        <div v-if="importMethod === 'git'" class="form-group">
          <label class="form-label">Git仓库地址</label>
          <n-input v-model:value="gitRepo" placeholder="输入Git仓库地址" />
          <label class="form-label">分支/标签</label>
          <n-input v-model:value="gitBranch" placeholder="输入分支或标签名" />
          <label class="form-label">配置路径</label>
          <n-input v-model:value="gitPath" placeholder="输入配置文件路径" />
        </div>
        
        <div class="form-group">
          <label class="form-label">目标环境</label>
          <n-select
            v-model:value="importEnvironment"
            placeholder="选择目标环境"
            :options="environments"
          />
        </div>
      </div>
      
      <template #action>
        <n-button @click="showImportModal = false">取消</n-button>
        <n-button type="primary" @click="importConfig">导入</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  Refresh as RefreshIcon,
  Add as PlusIcon,
  CloudUpload as UploadIcon,
  Settings as SettingsIcon,
  Layers as LayersIcon,
  Create as EditIcon,
  GitBranch as GitBranchIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Grid as GridIcon,
  List as ListIcon,
  EllipsisVertical as MoreVerticalIcon,
  Download as DownloadIcon
} from '@vicons/ionicons5'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const viewMode = ref<'card' | 'table'>('card')
const selectedEnvironment = ref('production')
const showConfigDetail = ref(false)
const showCreateConfigModal = ref(false)
const showImportModal = ref(false)
const selectedConfig = ref<any>(null)

// 搜索和过滤
const searchQuery = ref('')
const selectedNamespace = ref<string | null>(null)
const selectedType = ref<string | null>(null)

// 导入配置
const importMethod = ref('file')
const importUrl = ref('')
const gitRepo = ref('')
const gitBranch = ref('main')
const gitPath = ref('')
const importEnvironment = ref('')

// 配置表单
const configForm = reactive({
  name: '',
  namespace: '',
  type: '',
  environment: '',
  description: '',
  content: ''
})

// 统计数据
const configStats = reactive({
  totalConfigs: 156,
  activeEnvironments: 4,
  todayUpdates: 23,
  totalVersions: 342
})

// 环境选项
const environments = [
  { label: '生产环境', value: 'production' },
  { label: '预发布', value: 'staging' },
  { label: '测试环境', value: 'testing' },
  { label: '开发环境', value: 'development' }
]

// 命名空间选项
const namespaceOptions = [
  { label: 'default', value: 'default' },
  { label: 'microservice', value: 'microservice' },
  { label: 'database', value: 'database' },
  { label: 'cache', value: 'cache' },
  { label: 'monitoring', value: 'monitoring' }
]

// 配置类型选项
const typeOptions = [
  { label: 'JSON', value: 'json' },
  { label: 'YAML', value: 'yaml' },
  { label: 'Properties', value: 'properties' },
  { label: 'XML', value: 'xml' },
  { label: 'TOML', value: 'toml' }
]

// 模拟配置数据
const configs = ref([
  {
    id: '1',
    name: 'application.yml',
    namespace: 'microservice',
    type: 'yaml',
    version: '1.2.3',
    status: 'active',
    size: 2048,
    description: '微服务应用主配置文件',
    updatedAt: new Date('2024-01-15T10:30:00'),
    content: `server:
  port: 8080
  servlet:
    context-path: /api

spring:
  application:
    name: user-service
  datasource:
    url: jdbc:mysql://localhost:3306/userdb
    username: root
    password: password
  redis:
    host: localhost
    port: 6379`,
    versions: [
      { id: '1', version: '1.2.3', createdAt: new Date('2024-01-15T10:30:00'), author: 'admin' },
      { id: '2', version: '1.2.2', createdAt: new Date('2024-01-14T15:20:00'), author: 'developer' },
      { id: '3', version: '1.2.1', createdAt: new Date('2024-01-13T09:15:00'), author: 'admin' }
    ],
    deployments: [
      { environment: 'production', version: '1.2.3', status: 'deployed' },
      { environment: 'staging', version: '1.2.3', status: 'deployed' },
      { environment: 'testing', version: '1.2.2', status: 'deployed' },
      { environment: 'development', version: '1.2.3', status: 'failed' }
    ]
  },
  {
    id: '2',
    name: 'database.properties',
    namespace: 'database',
    type: 'properties',
    version: '2.1.0',
    status: 'active',
    size: 1024,
    description: '数据库连接配置',
    updatedAt: new Date('2024-01-14T16:45:00'),
    content: `# Database Configuration
db.host=localhost
db.port=3306
db.name=production_db
db.username=dbuser
db.password=dbpass123
db.pool.min=5
db.pool.max=20
db.timeout=30000`,
    versions: [
      { id: '1', version: '2.1.0', createdAt: new Date('2024-01-14T16:45:00'), author: 'dba' },
      { id: '2', version: '2.0.9', createdAt: new Date('2024-01-12T11:30:00'), author: 'admin' }
    ],
    deployments: [
      { environment: 'production', version: '2.1.0', status: 'deployed' },
      { environment: 'staging', version: '2.1.0', status: 'deployed' }
    ]
  },
  {
    id: '3',
    name: 'redis.json',
    namespace: 'cache',
    type: 'json',
    version: '1.0.5',
    status: 'inactive',
    size: 512,
    description: 'Redis缓存配置',
    updatedAt: new Date('2024-01-13T14:20:00'),
    content: `{
  "host": "redis-cluster.internal",
  "port": 6379,
  "password": "redis_password",
  "database": 0,
  "timeout": 5000,
  "pool": {
    "maxActive": 100,
    "maxIdle": 20,
    "minIdle": 5
  },
  "cluster": {
    "nodes": [
      "redis-1.internal:6379",
      "redis-2.internal:6379",
      "redis-3.internal:6379"
    ]
  }
}`,
    versions: [
      { id: '1', version: '1.0.5', createdAt: new Date('2024-01-13T14:20:00'), author: 'devops' }
    ],
    deployments: [
      { environment: 'production', version: '1.0.4', status: 'deployed' },
      { environment: 'staging', version: '1.0.5', status: 'failed' }
    ]
  }
])

// 表格列配置
const configColumns = [
  {
    title: '配置名称',
    key: 'name',
    width: 200
  },
  {
    title: '命名空间',
    key: 'namespace',
    width: 120
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render: (row: any) => getTypeLabel(row.type)
  },
  {
    title: '版本',
    key: 'version',
    width: 100,
    render: (row: any) => `v${row.version}`
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row: any) => {
      const type = row.status === 'active' ? 'success' : 'warning'
      const text = row.status === 'active' ? '已激活' : '未激活'
      return `<n-tag type="${type}" size="small">${text}</n-tag>`
    }
  },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render: (row: any) => formatSize(row.size)
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 180,
    render: (row: any) => formatTime(row.updatedAt)
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (row: any) => {
      return `
        <n-button size="small" @click="viewConfigDetail(${JSON.stringify(row)})">查看</n-button>
        <n-button size="small" @click="editConfig(${JSON.stringify(row)})">编辑</n-button>
      `
    }
  }
]

// 分页配置
const pagination = reactive({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  showQuickJumper: true,
  itemCount: 0
})

// 计算属性
const filteredConfigs = computed(() => {
  let filtered = configs.value

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(config =>
      config.name.toLowerCase().includes(query) ||
      config.description.toLowerCase().includes(query)
    )
  }

  // 命名空间过滤
  if (selectedNamespace.value) {
    filtered = filtered.filter(config => config.namespace === selectedNamespace.value)
  }

  // 类型过滤
  if (selectedType.value) {
    filtered = filtered.filter(config => config.type === selectedType.value)
  }

  pagination.itemCount = filtered.length
  return filtered
})

// 方法
const formatTime = (time: Date) => {
  return time.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getTypeLabel = (type: string) => {
  const typeMap: Record<string, string> = {
    json: 'JSON',
    yaml: 'YAML',
    properties: 'Properties',
    xml: 'XML',
    toml: 'TOML'
  }
  return typeMap[type] || type.toUpperCase()
}

const getLanguage = (type: string) => {
  const languageMap: Record<string, string> = {
    json: 'json',
    yaml: 'yaml',
    properties: 'properties',
    xml: 'xml',
    toml: 'toml'
  }
  return languageMap[type] || 'text'
}

const getConfigActions = (config: any) => {
  return [
    {
      label: '查看详情',
      key: 'view',
      props: { onClick: () => viewConfigDetail(config) }
    },
    {
      label: '编辑配置',
      key: 'edit',
      props: { onClick: () => editConfig(config) }
    },
    {
      label: '复制配置',
      key: 'copy',
      props: { onClick: () => copyConfig(config) }
    },
    {
      label: '下载配置',
      key: 'download',
      props: { onClick: () => downloadConfig(config) }
    },
    {
      label: '删除配置',
      key: 'delete',
      props: { onClick: () => deleteConfig(config) }
    }
  ]
}

const handleEnvironmentChange = (env: string) => {
  selectedEnvironment.value = env
  message.info(`切换到 ${environments.find(e => e.value === env)?.label} 环境`)
}

const refreshConfigs = () => {
  loading.value = true
  setTimeout(() => {
    loading.value = false
    message.success('配置列表已刷新')
  }, 1000)
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedNamespace.value = null
  selectedType.value = null
  message.success('筛选条件已清空')
}

const viewConfigDetail = (config: any) => {
  selectedConfig.value = config
  showConfigDetail.value = true
}

const editConfig = (config: any) => {
  Object.assign(configForm, config)
  showCreateConfigModal.value = true
}

const copyConfig = (config: any) => {
  navigator.clipboard.writeText(config.content)
  message.success('配置内容已复制到剪贴板')
}

const downloadConfig = (config: any) => {
  const blob = new Blob([config.content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = config.name
  a.click()
  URL.revokeObjectURL(url)
  message.success('配置文件下载成功')
}

const deleteConfig = (config: any) => {
  const index = configs.value.findIndex(c => c.id === config.id)
  if (index > -1) {
    configs.value.splice(index, 1)
    message.success(`配置 "${config.name}" 已删除`)
  }
}

const createConfig = () => {
  const newConfig = {
    id: Date.now().toString(),
    ...configForm,
    version: '1.0.0',
    status: 'active',
    size: new Blob([configForm.content]).size,
    updatedAt: new Date(),
    versions: [
      { id: '1', version: '1.0.0', createdAt: new Date(), author: 'admin' }
    ],
    deployments: []
  }
  
  configs.value.push(newConfig)
  message.success(`配置 "${configForm.name}" 创建成功`)
  
  // 重置表单
  Object.assign(configForm, {
    name: '',
    namespace: '',
    type: '',
    environment: '',
    description: '',
    content: ''
  })
  
  showCreateConfigModal.value = false
}

const importConfig = () => {
  message.success('配置导入成功')
  showImportModal.value = false
}

const compareVersion = (version: any) => {
  message.info(`对比版本 v${version.version}`)
}

const rollbackVersion = (version: any) => {
  message.success(`已回滚到版本 v${version.version}`)
}

const deployToEnvironment = (env: any) => {
  message.success(`正在部署到 ${env.environment} 环境`)
}

const handleConfigAction = (key: string) => {
  // 处理配置操作
}

onMounted(() => {
  pagination.itemCount = configs.value.length
})
</script>

<style scoped>
.config-page {
  padding: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
  min-height: 100vh;
  color: #1e293b;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(203, 213, 225, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(45deg, #1e293b, #3b82f6);
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(203, 213, 225, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  color: #1e293b;
  margin: 8px 0;
}

.card-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.card-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}

.trend-up {
  color: #059669;
}

.trend-down {
  color: #dc2626;
}

.configs-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(203, 213, 225, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.section-actions {
  display: flex;
  gap: 12px;
}

.filters {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 150px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.config-card {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.3);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.config-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.config-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.config-namespace {
  font-size: 12px;
  color: #64748b;
  background: rgba(203, 213, 225, 0.3);
  padding: 2px 8px;
  border-radius: 12px;
  display: inline-block;
}

.config-actions {
  display: flex;
  gap: 4px;
}

.config-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.meta-value {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
}

.config-description {
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 16px;
  min-height: 42px;
}

.config-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-size {
  font-size: 12px;
  color: #64748b;
}

.configs-table {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(203, 213, 225, 0.3);
}

.config-detail {
  color: #1e293b;
}

.detail-section {
  margin-bottom: 32px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #1e293b;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.detail-value {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
}

.config-content {
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(203, 213, 225, 0.3);
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid rgba(203, 213, 225, 0.3);
}

.version-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.version-number {
  font-weight: 600;
  color: #1e293b;
}

.version-time {
  font-size: 12px;
  color: #64748b;
}

.version-author {
  font-size: 12px;
  color: #64748b;
  background: rgba(203, 213, 225, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
}

.version-actions {
  display: flex;
  gap: 8px;
}

.deployment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deployment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid rgba(203, 213, 225, 0.3);
}

.deployment-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.deployment-env {
  font-weight: 600;
  color: #1e293b;
}

.deployment-version {
  font-size: 12px;
  color: #64748b;
  background: rgba(203, 213, 225, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
}

.deployment-actions {
  display: flex;
  gap: 8px;
}

.form-container {
  max-width: 600px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.import-area {
  border: 2px dashed rgba(203, 213, 225, 0.5);
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.import-area:hover {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.05);
}

.import-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  color: #64748b;
}

.import-text {
  font-size: 16px;
  color: #374151;
  margin-bottom: 8px;
}

.import-hint {
  font-size: 14px;
  color: #64748b;
}

/* Responsive Design */
@media (max-width: 768px) {
  .config-page {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .filters {
    flex-direction: column;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .config-meta {
    grid-template-columns: 1fr;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .deployment-item,
  .version-item {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .deployment-info,
  .version-info {
    justify-content: space-between;
  }
  
  .deployment-actions,
  .version-actions {
    justify-content: center;
  }
}
</style>