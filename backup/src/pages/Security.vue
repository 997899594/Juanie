<template>
  <div class="security-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">安全合规管理</h1>
          <p class="page-subtitle">管理系统安全策略、漏洞扫描和合规检查</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshData" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button @click="runFullScan">
            <template #icon>
              <Scan :size="16" />
            </template>
            全面扫描
          </n-button>
          <n-button type="primary" @click="showPolicyModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            新建策略
          </n-button>
        </div>
      </div>
    </div>

    <!-- 安全概览 -->
    <div class="security-overview">
      <div class="overview-stats">
        <div class="stat-card critical">
          <div class="stat-icon">
            <AlertTriangle :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ criticalVulnerabilities }}</div>
            <div class="stat-label">严重漏洞</div>
          </div>
          <div class="stat-trend">
            <TrendingUp :size="16" class="trend-up" />
            <span>+2</span>
          </div>
        </div>
        
        <div class="stat-card high">
          <div class="stat-icon">
            <AlertCircle :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ highVulnerabilities }}</div>
            <div class="stat-label">高危漏洞</div>
          </div>
          <div class="stat-trend">
            <TrendingDown :size="16" class="trend-down" />
            <span>-5</span>
          </div>
        </div>
        
        <div class="stat-card medium">
          <div class="stat-icon">
            <Info :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ mediumVulnerabilities }}</div>
            <div class="stat-label">中危漏洞</div>
          </div>
          <div class="stat-trend">
            <Minus :size="16" class="trend-stable" />
            <span>0</span>
          </div>
        </div>
        
        <div class="stat-card compliance">
          <div class="stat-icon">
            <Shield :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ complianceScore }}%</div>
            <div class="stat-label">合规评分</div>
          </div>
          <div class="stat-trend">
            <TrendingUp :size="16" class="trend-up" />
            <span>+3%</span>
          </div>
        </div>
        
        <div class="stat-card policies">
          <div class="stat-icon">
            <FileText :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ activePolicies }}</div>
            <div class="stat-label">活跃策略</div>
          </div>
          <div class="stat-trend">
            <Plus :size="16" class="trend-up" />
            <span>+1</span>
          </div>
        </div>
      </div>
      
      <!-- 安全趋势图表 -->
      <div class="security-charts">
        <div class="chart-container">
          <h3 class="chart-title">漏洞趋势</h3>
          <div class="chart-content">
            <div class="chart-placeholder">
              <BarChart3 :size="48" />
              <p>漏洞数量趋势图表</p>
            </div>
          </div>
        </div>
        
        <div class="chart-container">
          <h3 class="chart-title">合规状态</h3>
          <div class="chart-content">
            <div class="compliance-chart">
              <n-progress
                type="circle"
                :percentage="complianceScore"
                :stroke-width="8"
                :show-indicator="false"
                class="compliance-progress"
              />
              <div class="compliance-details">
                <div class="compliance-item">
                  <span class="compliance-label">通过:</span>
                  <span class="compliance-value">{{ passedChecks }}</span>
                </div>
                <div class="compliance-item">
                  <span class="compliance-label">失败:</span>
                  <span class="compliance-value">{{ failedChecks }}</span>
                </div>
                <div class="compliance-item">
                  <span class="compliance-label">警告:</span>
                  <span class="compliance-value">{{ warningChecks }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <n-tabs v-model:value="activeTab" type="line" animated>
        <!-- 漏洞扫描 -->
        <n-tab-pane name="vulnerabilities" tab="漏洞扫描">
          <div class="vulnerabilities-section">
            <div class="section-header">
              <div class="section-filters">
                <n-input
                  v-model:value="vulnerabilitySearchQuery"
                  placeholder="搜索漏洞..."
                  clearable
                  size="small"
                  style="width: 200px"
                >
                  <template #prefix>
                    <Search :size="16" />
                  </template>
                </n-input>
                <n-select
                  v-model:value="severityFilter"
                  :options="severityOptions"
                  placeholder="严重程度"
                  clearable
                  size="small"
                  style="width: 120px"
                />
                <n-select
                  v-model:value="statusFilter"
                  :options="statusOptions"
                  placeholder="状态"
                  clearable
                  size="small"
                  style="width: 120px"
                />
                <n-button @click="exportVulnerabilities" size="small">
                  <template #icon>
                    <Download :size="16" />
                  </template>
                  导出
                </n-button>
              </div>
              <div class="section-actions">
                <n-button @click="startVulnerabilityScan" :loading="scanLoading">
                  <template #icon>
                    <Scan :size="16" />
                  </template>
                  开始扫描
                </n-button>
              </div>
            </div>
            
            <div class="vulnerabilities-list">
              <div
                v-for="vulnerability in filteredVulnerabilities"
                :key="vulnerability.id"
                class="vulnerability-card"
                :class="getSeverityClass(vulnerability.severity)"
                @click="selectVulnerability(vulnerability)"
              >
                <div class="vulnerability-header">
                  <div class="vulnerability-info">
                    <h4 class="vulnerability-title">{{ vulnerability.title }}</h4>
                    <p class="vulnerability-id">{{ vulnerability.cveId }}</p>
                  </div>
                  <div class="vulnerability-severity">
                    <n-tag
                      :type="getSeverityType(vulnerability.severity)"
                      size="small"
                      :bordered="false"
                    >
                      {{ vulnerability.severity }}
                    </n-tag>
                  </div>
                </div>
                
                <div class="vulnerability-details">
                  <p class="vulnerability-description">{{ vulnerability.description }}</p>
                  <div class="vulnerability-meta">
                    <div class="meta-item">
                      <Package :size="14" />
                      <span>{{ vulnerability.package }}</span>
                    </div>
                    <div class="meta-item">
                      <Calendar :size="14" />
                      <span>{{ formatDate(vulnerability.discoveredAt) }}</span>
                    </div>
                    <div class="meta-item">
                      <Target :size="14" />
                      <span>{{ vulnerability.affectedAssets }}个资产</span>
                    </div>
                  </div>
                </div>
                
                <div class="vulnerability-actions">
                  <n-button size="small" @click.stop="fixVulnerability(vulnerability)">
                    <template #icon>
                      <Wrench :size="14" />
                    </template>
                    修复
                  </n-button>
                  <n-button size="small" @click.stop="ignoreVulnerability(vulnerability)">
                    <template #icon>
                      <EyeOff :size="14" />
                    </template>
                    忽略
                  </n-button>
                  <n-dropdown
                    :options="getVulnerabilityActions(vulnerability)"
                    @select="handleVulnerabilityAction"
                  >
                    <n-button size="small" circle>
                      <template #icon>
                        <MoreVertical :size="14" />
                      </template>
                    </n-button>
                  </n-dropdown>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>
        
        <!-- 安全策略 -->
        <n-tab-pane name="policies" tab="安全策略">
          <div class="policies-section">
            <div class="section-header">
              <div class="section-filters">
                <n-input
                  v-model:value="policySearchQuery"
                  placeholder="搜索策略..."
                  clearable
                  size="small"
                  style="width: 200px"
                >
                  <template #prefix>
                    <Search :size="16" />
                  </template>
                </n-input>
                <n-select
                  v-model:value="policyTypeFilter"
                  :options="policyTypeOptions"
                  placeholder="策略类型"
                  clearable
                  size="small"
                  style="width: 150px"
                />
                <n-select
                  v-model:value="policyStatusFilter"
                  :options="policyStatusOptions"
                  placeholder="状态"
                  clearable
                  size="small"
                  style="width: 120px"
                />
              </div>
              <div class="section-actions">
                <n-button @click="importPolicies">
                  <template #icon>
                    <Upload :size="16" />
                  </template>
                  导入策略
                </n-button>
                <n-button type="primary" @click="showPolicyModal = true">
                  <template #icon>
                    <Plus :size="16" />
                  </template>
                  新建策略
                </n-button>
              </div>
            </div>
            
            <div class="policies-grid">
              <div
                v-for="policy in filteredPolicies"
                :key="policy.id"
                class="policy-card"
                :class="{ active: policy.enabled }"
              >
                <div class="policy-header">
                  <div class="policy-info">
                    <h4 class="policy-name">{{ policy.name }}</h4>
                    <p class="policy-type">{{ policy.type }}</p>
                  </div>
                  <div class="policy-status">
                    <n-switch
                      v-model:value="policy.enabled"
                      @update:value="togglePolicy(policy)"
                    />
                  </div>
                </div>
                
                <div class="policy-description">
                  <p>{{ policy.description }}</p>
                </div>
                
                <div class="policy-stats">
                  <div class="stat-item">
                    <span class="stat-label">规则数:</span>
                    <span class="stat-value">{{ policy.rulesCount }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">违规:</span>
                    <span class="stat-value">{{ policy.violations }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">最后检查:</span>
                    <span class="stat-value">{{ formatTime(policy.lastChecked) }}</span>
                  </div>
                </div>
                
                <div class="policy-actions">
                  <n-button size="small" @click="editPolicy(policy)">
                    <template #icon>
                      <Edit :size="14" />
                    </template>
                    编辑
                  </n-button>
                  <n-button size="small" @click="runPolicyCheck(policy)">
                    <template #icon>
                      <Play :size="14" />
                    </template>
                    执行检查
                  </n-button>
                  <n-button size="small" @click="viewPolicyDetails(policy)">
                    <template #icon>
                      <Eye :size="14" />
                    </template>
                    详情
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>
        
        <!-- 合规检查 -->
        <n-tab-pane name="compliance" tab="合规检查">
          <div class="compliance-section">
            <div class="section-header">
              <div class="section-filters">
                <n-select
                  v-model:value="complianceFramework"
                  :options="complianceFrameworkOptions"
                  placeholder="合规框架"
                  size="small"
                  style="width: 150px"
                />
                <n-select
                  v-model:value="complianceStatusFilter"
                  :options="complianceStatusOptions"
                  placeholder="状态"
                  clearable
                  size="small"
                  style="width: 120px"
                />
                <n-button @click="generateComplianceReport" size="small">
                  <template #icon>
                    <FileText :size="16" />
                  </template>
                  生成报告
                </n-button>
              </div>
              <div class="section-actions">
                <n-button @click="runComplianceCheck" :loading="complianceLoading">
                  <template #icon>
                    <CheckCircle :size="16" />
                  </template>
                  执行检查
                </n-button>
              </div>
            </div>
            
            <div class="compliance-categories">
              <div
                v-for="category in complianceCategories"
                :key="category.id"
                class="compliance-category"
              >
                <div class="category-header">
                  <div class="category-info">
                    <h4 class="category-name">{{ category.name }}</h4>
                    <p class="category-description">{{ category.description }}</p>
                  </div>
                  <div class="category-score">
                    <n-progress
                      type="circle"
                      :percentage="category.score"
                      :stroke-width="6"
                      :show-indicator="false"
                      :size="60"
                    />
                    <span class="score-text">{{ category.score }}%</span>
                  </div>
                </div>
                
                <div class="category-checks">
                  <div
                    v-for="check in category.checks"
                    :key="check.id"
                    class="compliance-check"
                    :class="getComplianceCheckClass(check.status)"
                  >
                    <div class="check-icon">
                      <CheckCircle v-if="check.status === 'passed'" :size="16" />
                      <XCircle v-else-if="check.status === 'failed'" :size="16" />
                      <AlertTriangle v-else :size="16" />
                    </div>
                    <div class="check-content">
                      <h5 class="check-title">{{ check.title }}</h5>
                      <p class="check-description">{{ check.description }}</p>
                      <div class="check-meta">
                        <span class="check-id">{{ check.id }}</span>
                        <span class="check-severity">{{ check.severity }}</span>
                        <span class="check-last-run">{{ formatTime(check.lastRun) }}</span>
                      </div>
                    </div>
                    <div class="check-actions">
                      <n-button size="small" @click="viewCheckDetails(check)">
                        详情
                      </n-button>
                      <n-button v-if="check.status === 'failed'" size="small" type="primary" @click="fixComplianceIssue(check)">
                        修复
                      </n-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>
        
        <!-- 安全报告 -->
        <n-tab-pane name="reports" tab="安全报告">
          <div class="reports-section">
            <div class="section-header">
              <div class="section-filters">
                <n-date-picker
                  v-model:value="reportDateRange"
                  type="daterange"
                  placeholder="选择日期范围"
                  size="small"
                />
                <n-select
                  v-model:value="reportType"
                  :options="reportTypeOptions"
                  placeholder="报告类型"
                  size="small"
                  style="width: 150px"
                />
              </div>
              <div class="section-actions">
                <n-button @click="scheduleReport">
                  <template #icon>
                    <Clock :size="16" />
                  </template>
                  定时报告
                </n-button>
                <n-button type="primary" @click="generateReport">
                  <template #icon>
                    <FileText :size="16" />
                  </template>
                  生成报告
                </n-button>
              </div>
            </div>
            
            <div class="reports-list">
              <div
                v-for="report in securityReports"
                :key="report.id"
                class="report-card"
              >
                <div class="report-header">
                  <div class="report-info">
                    <h4 class="report-title">{{ report.title }}</h4>
                    <p class="report-type">{{ report.type }}</p>
                  </div>
                  <div class="report-status">
                    <n-tag
                      :type="getReportStatusType(report.status)"
                      size="small"
                      :bordered="false"
                    >
                      {{ report.status }}
                    </n-tag>
                  </div>
                </div>
                
                <div class="report-summary">
                  <div class="summary-item">
                    <span class="summary-label">生成时间:</span>
                    <span class="summary-value">{{ formatDateTime(report.generatedAt) }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">覆盖范围:</span>
                    <span class="summary-value">{{ report.scope }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="summary-label">发现问题:</span>
                    <span class="summary-value">{{ report.issuesFound }}</span>
                  </div>
                </div>
                
                <div class="report-actions">
                  <n-button size="small" @click="viewReport(report)">
                    <template #icon>
                      <Eye :size="14" />
                    </template>
                    查看
                  </n-button>
                  <n-button size="small" @click="downloadReport(report)">
                    <template #icon>
                      <Download :size="14" />
                    </template>
                    下载
                  </n-button>
                  <n-button size="small" @click="shareReport(report)">
                    <template #icon>
                      <Share :size="14" />
                    </template>
                    分享
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 新建策略模态框 -->
    <n-modal v-model:show="showPolicyModal" preset="card" title="新建安全策略" class="policy-modal">
      <div class="policy-form">
        <n-form :model="policyForm" label-placement="top">
          <div class="form-section">
            <h4 class="form-section-title">基本信息</h4>
            <div class="form-row">
              <n-form-item label="策略名称" class="form-item">
                <n-input v-model:value="policyForm.name" placeholder="输入策略名称" />
              </n-form-item>
              <n-form-item label="策略类型" class="form-item">
                <n-select
                  v-model:value="policyForm.type"
                  :options="policyTypeOptions"
                  placeholder="选择策略类型"
                />
              </n-form-item>
            </div>
            <n-form-item label="策略描述">
              <n-input
                v-model:value="policyForm.description"
                type="textarea"
                placeholder="描述策略的用途和规则"
                :rows="3"
              />
            </n-form-item>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">规则配置</h4>
            <n-dynamic-input
              v-model:value="policyForm.rules"
              :on-create="createPolicyRule"
            >
              <template #default="{ value }">
                <div class="rule-input">
                  <n-input
                    v-model:value="value.name"
                    placeholder="规则名称"
                    style="width: 30%"
                  />
                  <n-select
                    v-model:value="value.condition"
                    :options="ruleConditionOptions"
                    placeholder="条件"
                    style="width: 25%"
                  />
                  <n-input
                    v-model:value="value.value"
                    placeholder="值"
                    style="width: 25%"
                  />
                  <n-select
                    v-model:value="value.action"
                    :options="ruleActionOptions"
                    placeholder="动作"
                    style="width: 20%"
                  />
                </div>
              </template>
            </n-dynamic-input>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">执行配置</h4>
            <div class="form-row">
              <n-form-item label="执行频率" class="form-item">
                <n-select
                  v-model:value="policyForm.frequency"
                  :options="frequencyOptions"
                  placeholder="选择执行频率"
                />
              </n-form-item>
              <n-form-item label="优先级" class="form-item">
                <n-select
                  v-model:value="policyForm.priority"
                  :options="priorityOptions"
                  placeholder="选择优先级"
                />
              </n-form-item>
            </div>
            <div class="form-row">
              <n-form-item label="启用策略" class="form-item">
                <n-switch v-model:value="policyForm.enabled" />
              </n-form-item>
              <n-form-item label="发送通知" class="form-item">
                <n-switch v-model:value="policyForm.notifications" />
              </n-form-item>
            </div>
          </div>
        </n-form>
        
        <div class="modal-actions">
          <n-button @click="showPolicyModal = false">取消</n-button>
          <n-button type="primary" @click="createPolicy">创建策略</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  RefreshCw, Plus, Scan, AlertTriangle, AlertCircle, Info, Shield, FileText,
  TrendingUp, TrendingDown, Minus, BarChart3, Search, Download, Package,
  Calendar, Target, Wrench, EyeOff, MoreVertical, Upload, Edit, Play, Eye,
  CheckCircle, XCircle, Clock, Share
} from 'lucide-vue-next'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const scanLoading = ref(false)
const complianceLoading = ref(false)
const activeTab = ref('vulnerabilities')
const showPolicyModal = ref(false)

// 搜索和筛选
const vulnerabilitySearchQuery = ref('')
const severityFilter = ref(null)
const statusFilter = ref(null)
const policySearchQuery = ref('')
const policyTypeFilter = ref(null)
const policyStatusFilter = ref(null)
const complianceFramework = ref('ISO27001')
const complianceStatusFilter = ref(null)
const reportDateRange = ref(null)
const reportType = ref(null)

// 统计数据
const criticalVulnerabilities = ref(3)
const highVulnerabilities = ref(12)
const mediumVulnerabilities = ref(28)
const complianceScore = ref(85)
const activePolicies = ref(15)
const passedChecks = ref(42)
const failedChecks = ref(8)
const warningChecks = ref(5)

// 漏洞数据
const vulnerabilities = ref([
  {
    id: 'vuln-1',
    title: 'SQL注入漏洞',
    cveId: 'CVE-2024-0001',
    severity: 'Critical',
    description: '用户输入未经过滤直接拼接到SQL查询中，可能导致数据库被攻击',
    package: 'web-api',
    discoveredAt: new Date('2024-01-20T10:30:00'),
    affectedAssets: 5,
    status: 'Open'
  },
  {
    id: 'vuln-2',
    title: 'XSS跨站脚本攻击',
    cveId: 'CVE-2024-0002',
    severity: 'High',
    description: '前端页面存在XSS漏洞，攻击者可以注入恶意脚本',
    package: 'web-frontend',
    discoveredAt: new Date('2024-01-19T15:20:00'),
    affectedAssets: 3,
    status: 'In Progress'
  },
  {
    id: 'vuln-3',
    title: '弱密码策略',
    cveId: 'CVE-2024-0003',
    severity: 'Medium',
    description: '系统密码策略过于宽松，容易被暴力破解',
    package: 'auth-service',
    discoveredAt: new Date('2024-01-18T09:15:00'),
    affectedAssets: 8,
    status: 'Open'
  }
])

// 安全策略数据
const policies = ref([
  {
    id: 'policy-1',
    name: '密码复杂度策略',
    type: '访问控制',
    description: '确保用户密码符合复杂度要求',
    enabled: true,
    rulesCount: 5,
    violations: 2,
    lastChecked: new Date('2024-01-20T08:00:00')
  },
  {
    id: 'policy-2',
    name: '网络访问控制',
    type: '网络安全',
    description: '限制网络访问权限和端口开放',
    enabled: true,
    rulesCount: 8,
    violations: 0,
    lastChecked: new Date('2024-01-20T07:30:00')
  },
  {
    id: 'policy-3',
    name: '数据加密策略',
    type: '数据保护',
    description: '确保敏感数据在传输和存储时加密',
    enabled: false,
    rulesCount: 3,
    violations: 1,
    lastChecked: new Date('2024-01-19T18:00:00')
  }
])

// 合规检查数据
const complianceCategories = ref([
  {
    id: 'cat-1',
    name: '访问控制',
    description: 'ISO 27001 A.9 访问控制要求',
    score: 92,
    checks: [
      {
        id: 'check-1',
        title: '用户访问权限管理',
        description: '确保用户只能访问其工作所需的资源',
        status: 'passed',
        severity: 'High',
        lastRun: new Date('2024-01-20T08:00:00')
      },
      {
        id: 'check-2',
        title: '特权账户管理',
        description: '特权账户应受到额外保护和监控',
        status: 'failed',
        severity: 'Critical',
        lastRun: new Date('2024-01-20T08:00:00')
      }
    ]
  },
  {
    id: 'cat-2',
    name: '密码学',
    description: 'ISO 27001 A.10 密码学要求',
    score: 78,
    checks: [
      {
        id: 'check-3',
        title: '数据传输加密',
        description: '敏感数据在网络传输时必须加密',
        status: 'passed',
        severity: 'High',
        lastRun: new Date('2024-01-20T08:00:00')
      },
      {
        id: 'check-4',
        title: '密钥管理',
        description: '加密密钥应安全生成、存储和管理',
        status: 'warning',
        severity: 'Medium',
        lastRun: new Date('2024-01-20T08:00:00')
      }
    ]
  }
])

// 安全报告数据
const securityReports = ref([
  {
    id: 'report-1',
    title: '月度安全评估报告',
    type: '综合报告',
    status: 'completed',
    generatedAt: new Date('2024-01-20T10:00:00'),
    scope: '全系统',
    issuesFound: 23
  },
  {
    id: 'report-2',
    title: '漏洞扫描报告',
    type: '漏洞报告',
    status: 'completed',
    generatedAt: new Date('2024-01-19T16:30:00'),
    scope: 'Web应用',
    issuesFound: 15
  },
  {
    id: 'report-3',
    title: '合规检查报告',
    type: '合规报告',
    status: 'generating',
    generatedAt: new Date('2024-01-20T11:00:00'),
    scope: 'ISO 27001',
    issuesFound: 0
  }
])

// 表单数据
const policyForm = ref({
  name: '',
  type: '',
  description: '',
  rules: [{ name: '', condition: '', value: '', action: '' }],
  frequency: 'daily',
  priority: 'medium',
  enabled: true,
  notifications: true
})

// 选项数据
const severityOptions = [
  { label: '全部', value: null },
  { label: '严重', value: 'Critical' },
  { label: '高危', value: 'High' },
  { label: '中危', value: 'Medium' },
  { label: '低危', value: 'Low' }
]

const statusOptions = [
  { label: '全部', value: null },
  { label: '开放', value: 'Open' },
  { label: '处理中', value: 'In Progress' },
  { label: '已修复', value: 'Fixed' },
  { label: '已忽略', value: 'Ignored' }
]

const policyTypeOptions = [
  { label: '访问控制', value: '访问控制' },
  { label: '网络安全', value: '网络安全' },
  { label: '数据保护', value: '数据保护' },
  { label: '系统安全', value: '系统安全' },
  { label: '应用安全', value: '应用安全' }
]

const policyStatusOptions = [
  { label: '全部', value: null },
  { label: '启用', value: true },
  { label: '禁用', value: false }
]

const complianceFrameworkOptions = [
  { label: 'ISO 27001', value: 'ISO27001' },
  { label: 'SOC 2', value: 'SOC2' },
  { label: 'PCI DSS', value: 'PCIDSS' },
  { label: 'GDPR', value: 'GDPR' }
]

const complianceStatusOptions = [
  { label: '全部', value: null },
  { label: '通过', value: 'passed' },
  { label: '失败', value: 'failed' },
  { label: '警告', value: 'warning' }
]

const reportTypeOptions = [
  { label: '综合报告', value: '综合报告' },
  { label: '漏洞报告', value: '漏洞报告' },
  { label: '合规报告', value: '合规报告' },
  { label: '策略报告', value: '策略报告' }
]

const ruleConditionOptions = [
  { label: '等于', value: 'equals' },
  { label: '包含', value: 'contains' },
  { label: '大于', value: 'greater_than' },
  { label: '小于', value: 'less_than' },
  { label: '匹配', value: 'matches' }
]

const ruleActionOptions = [
  { label: '阻止', value: 'block' },
  { label: '警告', value: 'warn' },
  { label: '记录', value: 'log' },
  { label: '通知', value: 'notify' }
]

const frequencyOptions = [
  { label: '实时', value: 'realtime' },
  { label: '每小时', value: 'hourly' },
  { label: '每日', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' }
]

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' }
]

// 计算属性
const filteredVulnerabilities = computed(() => {
  let filtered = vulnerabilities.value

  if (vulnerabilitySearchQuery.value) {
    const query = vulnerabilitySearchQuery.value.toLowerCase()
    filtered = filtered.filter(vuln =>
      vuln.title.toLowerCase().includes(query) ||
      vuln.cveId.toLowerCase().includes(query) ||
      vuln.package.toLowerCase().includes(query)
    )
  }

  if (severityFilter.value) {
    filtered = filtered.filter(vuln => vuln.severity === severityFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(vuln => vuln.status === statusFilter.value)
  }

  return filtered
})

const filteredPolicies = computed(() => {
  let filtered = policies.value

  if (policySearchQuery.value) {
    const query = policySearchQuery.value.toLowerCase()
    filtered = filtered.filter(policy =>
      policy.name.toLowerCase().includes(query) ||
      policy.type.toLowerCase().includes(query)
    )
  }

  if (policyTypeFilter.value) {
    filtered = filtered.filter(policy => policy.type === policyTypeFilter.value)
  }

  if (policyStatusFilter.value !== null) {
    filtered = filtered.filter(policy => policy.enabled === policyStatusFilter.value)
  }

  return filtered
})

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

const runFullScan = async () => {
  scanLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 3000))
    message.success('全面扫描已完成')
  } catch (error) {
    message.error('扫描失败')
  } finally {
    scanLoading.value = false
  }
}

const getSeverityClass = (severity: string) => {
  return {
    critical: severity === 'Critical',
    high: severity === 'High',
    medium: severity === 'Medium',
    low: severity === 'Low'
  }
}

const getSeverityType = (severity: string) => {
  const types = {
    Critical: 'error',
    High: 'warning',
    Medium: 'info',
    Low: 'success'
  }
  return types[severity] || 'default'
}

const getComplianceCheckClass = (status: string) => {
  return {
    passed: status === 'passed',
    failed: status === 'failed',
    warning: status === 'warning'
  }
}

const getReportStatusType = (status: string) => {
  const types = {
    completed: 'success',
    generating: 'info',
    failed: 'error'
  }
  return types[status] || 'default'
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN')
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN')
}

const selectVulnerability = (vulnerability: any) => {
  message.info(`选择漏洞: ${vulnerability.title}`)
}

const fixVulnerability = (vulnerability: any) => {
  message.info(`修复漏洞: ${vulnerability.title}`)
}

const ignoreVulnerability = (vulnerability: any) => {
  message.info(`忽略漏洞: ${vulnerability.title}`)
}

const getVulnerabilityActions = (vulnerability: any) => {
  return [
    { label: '查看详情', key: 'details', props: { vulnerability } },
    { label: '分配给', key: 'assign', props: { vulnerability } },
    { label: '添加备注', key: 'comment', props: { vulnerability } },
    { label: '导出', key: 'export', props: { vulnerability } }
  ]
}

const handleVulnerabilityAction = (key: string, option: any) => {
  const vulnerability = option.props.vulnerability
  message.info(`${key}: ${vulnerability.title}`)
}

const startVulnerabilityScan = async () => {
  scanLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    message.success('漏洞扫描已开始')
  } catch (error) {
    message.error('扫描启动失败')
  } finally {
    scanLoading.value = false
  }
}

const exportVulnerabilities = () => {
  message.info('导出漏洞列表')
}

const togglePolicy = (policy: any) => {
  message.info(`${policy.enabled ? '启用' : '禁用'}策略: ${policy.name}`)
}

const editPolicy = (policy: any) => {
  message.info(`编辑策略: ${policy.name}`)
}

const runPolicyCheck = (policy: any) => {
  message.info(`执行策略检查: ${policy.name}`)
}

const viewPolicyDetails = (policy: any) => {
  message.info(`查看策略详情: ${policy.name}`)
}

const importPolicies = () => {
  message.info('导入安全策略')
}

const runComplianceCheck = async () => {
  complianceLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    message.success('合规检查已完成')
  } catch (error) {
    message.error('合规检查失败')
  } finally {
    complianceLoading.value = false
  }
}

const generateComplianceReport = () => {
  message.info('生成合规报告')
}

const viewCheckDetails = (check: any) => {
  message.info(`查看检查详情: ${check.title}`)
}

const fixComplianceIssue = (check: any) => {
  message.info(`修复合规问题: ${check.title}`)
}

const scheduleReport = () => {
  message.info('设置定时报告')
}

const generateReport = () => {
  message.info('生成安全报告')
}

const viewReport = (report: any) => {
  message.info(`查看报告: ${report.title}`)
}

const downloadReport = (report: any) => {
  message.info(`下载报告: ${report.title}`)
}

const shareReport = (report: any) => {
  message.info(`分享报告: ${report.title}`)
}

const createPolicyRule = () => {
  return { name: '', condition: '', value: '', action: '' }
}

const createPolicy = () => {
  if (!policyForm.value.name || !policyForm.value.type) {
    message.error('请填写必填字段')
    return
  }

  const newPolicy = {
    id: Date.now().toString(),
    name: policyForm.value.name,
    type: policyForm.value.type,
    description: policyForm.value.description,
    enabled: policyForm.value.enabled,
    rulesCount: policyForm.value.rules.length,
    violations: 0,
    lastChecked: new Date()
  }

  policies.value.push(newPolicy)
  message.success(`策略 ${policyForm.value.name} 创建成功`)
  showPolicyModal.value = false

  // 重置表单
  policyForm.value = {
    name: '',
    type: '',
    description: '',
    rules: [{ name: '', condition: '', value: '', action: '' }],
    frequency: 'daily',
    priority: 'medium',
    enabled: true,
    notifications: true
  }
}

onMounted(() => {
  // 初始化数据
})
</script>

<style scoped>
.security-page {
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

.security-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 space-y-6;
}

.overview-stats {
  @apply grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4;
}

.stat-card {
  @apply bg-slate-700/30 rounded-lg p-4 flex items-center gap-4 relative;
}

.stat-card.critical .stat-icon {
  @apply bg-red-500/20 text-red-400;
}

.stat-card.high .stat-icon {
  @apply bg-orange-500/20 text-orange-400;
}

.stat-card.medium .stat-icon {
  @apply bg-yellow-500/20 text-yellow-400;
}

.stat-card.compliance .stat-icon {
  @apply bg-green-500/20 text-green-400;
}

.stat-card.policies .stat-icon {
  @apply bg-blue-500/20 text-blue-400;
}

.stat-icon {
  @apply w-12 h-12 rounded-lg flex items-center justify-center;
}

.stat-value {
  @apply text-2xl font-bold text-white;
}

.stat-label {
  @apply text-sm text-slate-400;
}

.stat-trend {
  @apply absolute top-2 right-2 flex items-center gap-1 text-xs;
}

.trend-up {
  @apply text-green-400;
}

.trend-down {
  @apply text-red-400;
}

.trend-stable {
  @apply text-slate-400;
}

.security-charts {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
}

.chart-container {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.chart-title {
  @apply text-white font-medium mb-4;
}

.chart-content {
  @apply h-48 flex items-center justify-center;
}

.chart-placeholder {
  @apply text-center text-slate-400;
}

.chart-placeholder p {
  @apply mt-2 text-sm;
}

.compliance-chart {
  @apply flex items-center gap-6;
}

.compliance-progress {
  @apply flex-shrink-0;
}

.compliance-details {
  @apply space-y-2;
}

.compliance-item {
  @apply flex items-center gap-2 text-sm;
}

.compliance-label {
  @apply text-slate-400;
}

.compliance-value {
  @apply text-white font-medium;
}

.main-content {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.section-header {
  @apply flex items-center justify-between mb-6;
}

.section-filters {
  @apply flex items-center gap-3;
}

.section-actions {
  @apply flex items-center gap-3;
}

.vulnerabilities-list {
  @apply space-y-4;
}

.vulnerability-card {
  @apply bg-slate-700/30 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-slate-700/50;
}

.vulnerability-card.critical {
  @apply border-l-4 border-red-500;
}

.vulnerability-card.high {
  @apply border-l-4 border-orange-500;
}

.vulnerability-card.medium {
  @apply border-l-4 border-yellow-500;
}

.vulnerability-card.low {
  @apply border-l-4 border-green-500;
}

.vulnerability-header {
  @apply flex items-center justify-between mb-3;
}

.vulnerability-title {
  @apply text-white font-medium;
}

.vulnerability-id {
  @apply text-slate-400 text-sm;
}

.vulnerability-details {
  @apply mb-4;
}

.vulnerability-description {
  @apply text-slate-300 text-sm mb-3;
}

.vulnerability-meta {
  @apply flex items-center gap-4 text-sm text-slate-400;
}

.meta-item {
  @apply flex items-center gap-1;
}

.vulnerability-actions {
  @apply flex items-center gap-2;
}

.policies-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.policy-card {
  @apply bg-slate-700/30 rounded-lg p-4 transition-all duration-200;
}

.policy-card.active {
  @apply border border-green-500/50 bg-green-500/10;
}

.policy-header {
  @apply flex items-center justify-between mb-3;
}

.policy-name {
  @apply text-white font-medium;
}

.policy-type {
  @apply text-slate-400 text-sm;
}

.policy-description {
  @apply text-slate-300 text-sm mb-4;
}

.policy-stats {
  @apply space-y-2 mb-4;
}

.stat-item {
  @apply flex items-center justify-between text-sm;
}

.stat-label {
  @apply text-slate-400;
}

.stat-value {
  @apply text-white;
}

.policy-actions {
  @apply flex items-center gap-2;
}

.compliance-categories {
  @apply space-y-6;
}

.compliance-category {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.category-header {
  @apply flex items-center justify-between mb-4;
}

.category-name {
  @apply text-white font-medium;
}

.category-description {
  @apply text-slate-400 text-sm;
}

.category-score {
  @apply relative flex items-center justify-center;
}

.score-text {
  @apply absolute text-white font-medium;
}

.category-checks {
  @apply space-y-3;
}

.compliance-check {
  @apply flex items-center gap-4 p-3 rounded-lg;
}

.compliance-check.passed {
  @apply bg-green-500/10 border border-green-500/20;
}

.compliance-check.failed {
  @apply bg-red-500/10 border border-red-500/20;
}

.compliance-check.warning {
  @apply bg-yellow-500/10 border border-yellow-500/20;
}

.check-icon {
  @apply flex-shrink-0;
}

.compliance-check.passed .check-icon {
  @apply text-green-400;
}

.compliance-check.failed .check-icon {
  @apply text-red-400;
}

.compliance-check.warning .check-icon {
  @apply text-yellow-400;
}

.check-content {
  @apply flex-1;
}

.check-title {
  @apply text-white font-medium mb-1;
}

.check-description {
  @apply text-slate-300 text-sm mb-2;
}

.check-meta {
  @apply flex items-center gap-4 text-xs text-slate-400;
}

.check-actions {
  @apply flex items-center gap-2;
}

.reports-list {
  @apply space-y-4;
}

.report-card {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.report-header {
  @apply flex items-center justify-between mb-3;
}

.report-title {
  @apply text-white font-medium;
}

.report-type {
  @apply text-slate-400 text-sm;
}

.report-summary {
  @apply space-y-2 mb-4;
}

.summary-item {
  @apply flex items-center justify-between text-sm;
}

.summary-label {
  @apply text-slate-400;
}

.summary-value {
  @apply text-white;
}

.report-actions {
  @apply flex items-center gap-2;
}

.policy-modal {
  @apply w-full max-w-4xl;
}

.policy-form {
  @apply space-y-6;
}

.form-section {
  @apply space-y-4;
}

.form-section-title {
  @apply text-white font-medium pb-2 border-b border-slate-700/50;
}

.form-row {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.form-item {
  @apply flex-1;
}

.rule-input {
  @apply flex items-center gap-2;
}

.modal-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-slate-700/50;
}
</style>