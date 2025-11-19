<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCostTracking, type CostFilters } from '@/composables/useCostTracking'
import { useAppStore } from '@/stores/app'
import PageContainer from '@/components/PageContainer.vue'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertTitle,
  AlertDescription,
  Badge,
} from '@juanie/ui'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Server,
  Database,
  Network,
  HardDrive,
  Loader2,
  AlertTriangle,
  Download,
} from 'lucide-vue-next'
import { useProjects } from '@/composables/useProjects'
import { VisXYContainer, VisLine, VisArea, VisAxis, VisTooltip } from '@unovis/vue'
import { VisDonut, VisSingleContainer } from '@unovis/vue'

const route = useRoute()
const appStore = useAppStore()
const { projects, fetchProjects } = useProjects()

const {
  costs,
  summary,
  alerts,
  loading,
  hasCosts,
  hasAlerts,
  refreshAll,
} = useCostTracking()

// 筛选状态
const selectedProject = ref<string>('all')
const selectedTimeRange = ref<string>('30')

// 时间范围选项
const timeRangeOptions = [
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
  { value: '90', label: '最近 90 天' },
  { value: 'custom', label: '自定义' },
]

// 构建筛选条件
const buildFilters = (): CostFilters => {
  const organizationId = appStore.currentOrganizationId || ''
  const filters: CostFilters = { organizationId }

  if (selectedProject.value !== 'all') {
    filters.projectId = selectedProject.value
  }

  // 计算日期范围
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - Number.parseInt(selectedTimeRange.value))

  filters.startDate = startDate.toISOString().split('T')[0]
  filters.endDate = endDate.toISOString().split('T')[0]

  return filters
}

// 加载数据
const loadData = async () => {
  const filters = buildFilters()
  await refreshAll(filters)
}

// 监听筛选条件变化
watch([selectedProject, selectedTimeRange], () => {
  loadData()
})

// 准备趋势图表数据
const trendData = computed(() => {
  if (!hasCosts.value) return []
  
  return costs.value
    .map((c) => ({
      date: new Date(c.date),
      total: c.costs.total,
      compute: c.costs.compute,
      storage: c.costs.storage,
      network: c.costs.network,
      database: c.costs.database,
    }))
    .reverse()
})

// 准备分类图表数据
const categoryData = computed(() => {
  if (!summary.value) return []
  
  return [
    { category: '计算', value: summary.value.totalCompute, color: '#3b82f6' },
    { category: '存储', value: summary.value.totalStorage, color: '#8b5cf6' },
    { category: '网络', value: summary.value.totalNetwork, color: '#10b981' },
    { category: '数据库', value: summary.value.totalDatabase, color: '#f59e0b' },
  ].filter(d => d.value > 0)
})

// Unovis 配置
const x = (d: any) => d.date
const y = (d: any) => d.total

// 获取告警严重程度的 variant
const getAlertVariant = (severity: string): 'default' | 'destructive' => {
  return severity === 'high' ? 'destructive' : 'default'
}

// 格式化货币
const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amount)
}

// 计算成本变化趋势
const costTrend = computed(() => {
  if (costs.value.length < 2) return null

  const latest = costs.value[0]?.costs.total || 0
  const previous = costs.value[1]?.costs.total || 0

  if (previous === 0) return null

  const change = ((latest - previous) / previous) * 100
  return {
    value: Math.abs(change).toFixed(1),
    isIncrease: change > 0,
  }
})

// 导出数据
function exportData() {
  if (!hasCosts.value) return

  // 准备 CSV 数据
  const headers = ['日期', '总成本', '计算', '存储', '网络', '数据库']
  const rows = costs.value.map(c => [
    c.date,
    c.costs.total.toFixed(2),
    c.costs.compute.toFixed(2),
    c.costs.storage.toFixed(2),
    c.costs.network.toFixed(2),
    c.costs.database.toFixed(2),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  // 下载文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `cost-report-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 初始化
onMounted(async () => {
  // 加载项目列表
  if (appStore.currentOrganizationId) {
    await fetchProjects(appStore.currentOrganizationId)
  }
  await loadData()
})
</script>

<template>
  <PageContainer title="成本追踪" description="查看和分析组织的成本数据">
    <template #actions>
      <div class="flex gap-2">
        <Select v-model="selectedTimeRange">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="选择时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in timeRangeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="selectedProject">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部项目</SelectItem>
            <SelectItem
              v-for="project in projects"
              :key="project.id"
              :value="project.id"
            >
              {{ project.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" @click="exportData" :disabled="!hasCosts">
          <Download class="mr-2 h-4 w-4" />
          导出报告
        </Button>
      </div>
    </template>

    <!-- 成本告警 -->
    <div v-if="hasAlerts" class="space-y-4 mb-6">
      <Alert
        v-for="(alert, index) in alerts"
        :key="index"
        :variant="getAlertVariant(alert.severity)"
      >
        <AlertTriangle class="h-4 w-4" />
        <AlertTitle>成本告警</AlertTitle>
        <AlertDescription>
          {{ alert.message }}
        </AlertDescription>
      </Alert>
    </div>

    <!-- 成本汇总卡片 -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">总成本</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ summary ? formatCurrency(summary.grandTotal, summary.currency) : '-' }}
          </div>
          <div v-if="costTrend" class="flex items-center text-xs text-muted-foreground mt-1">
            <TrendingUp v-if="costTrend.isIncrease" class="h-3 w-3 mr-1 text-red-500" />
            <TrendingDown v-else class="h-3 w-3 mr-1 text-green-500" />
            <span :class="costTrend.isIncrease ? 'text-red-500' : 'text-green-500'">
              {{ costTrend.value }}%
            </span>
            <span class="ml-1">vs 上期</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">计算成本</CardTitle>
          <Server class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ summary ? formatCurrency(summary.totalCompute, summary.currency) : '-' }}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">存储成本</CardTitle>
          <HardDrive class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ summary ? formatCurrency(summary.totalStorage, summary.currency) : '-' }}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">网络成本</CardTitle>
          <Network class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ summary ? formatCurrency(summary.totalNetwork, summary.currency) : '-' }}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">数据库成本</CardTitle>
          <Database class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ summary ? formatCurrency(summary.totalDatabase, summary.currency) : '-' }}
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && !hasCosts" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 图表 -->
    <div v-else-if="hasCosts" class="grid gap-6 md:grid-cols-2">
      <!-- 成本趋势图 -->
      <Card>
        <CardHeader>
          <CardTitle>成本趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <VisXYContainer :data="trendData" :height="400">
            <VisArea :x="x" :y="y" color="#3b82f6" :opacity="0.3" />
            <VisLine :x="x" :y="y" color="#3b82f6" />
            <VisAxis type="x" :tickFormat="(d: Date) => d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })" />
            <VisAxis type="y" :tickFormat="(d: number) => `$${d.toFixed(0)}`" label="成本 (USD)" />
            <VisTooltip />
          </VisXYContainer>
        </CardContent>
      </Card>

      <!-- 成本分类图 -->
      <Card>
        <CardHeader>
          <CardTitle>成本分类</CardTitle>
        </CardHeader>
        <CardContent>
          <VisSingleContainer :data="categoryData" :height="400">
            <VisDonut
              :value="(d: any) => d.value"
              :arcLabel="(d: any) => `${d.category}\n$${d.value.toFixed(2)}`"
              :color="(d: any) => d.color"
              :centralLabel="`总计\n$${summary?.grandTotal.toFixed(2) || '0'}`"
              :centralSubLabel="summary?.currency || 'USD'"
            />
            <VisTooltip />
          </VisSingleContainer>
        </CardContent>
      </Card>
    </div>

    <!-- 空状态 -->
    <Card v-else>
      <CardContent class="flex flex-col items-center justify-center py-12">
        <DollarSign class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无成本数据</h3>
        <p class="text-sm text-muted-foreground">选择的时间范围内没有成本记录</p>
      </CardContent>
    </Card>
  </PageContainer>
</template>
