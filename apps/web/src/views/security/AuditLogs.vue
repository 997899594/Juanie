<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { useAuditLogs, type AuditLogFilters } from '@/composables/useAuditLogs'
import PageContainer from '@/components/PageContainer.vue'
import { Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue , log } from '@juanie/ui'
import { FileSearch, Loader2, Download, Search, Filter, X } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const organizationId = route.params.orgId as string

const {
  logs,
  loading,
  hasLogs,
  totalCount,
  fetchLogs,
  searchLogs,
  exportLogs,
  clearFilters,
} = useAuditLogs()

// 搜索和筛选状态
const searchQuery = ref('')
const selectedAction = ref('all')
const selectedResourceType = ref('all')
const startDate = ref('')
const endDate = ref('')
const showFilters = ref(false)

// 操作类型选项
const actionTypes = [
  { value: 'all', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'read', label: '读取' },
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
]

// 资源类型选项
const resourceTypes = [
  { value: 'all', label: '全部资源' },
  { value: 'project', label: '项目' },
  { value: 'deployment', label: '部署' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'environment', label: '环境' },
  { value: 'user', label: '用户' },
  { value: 'organization', label: '组织' },
]

// 从 URL 初始化筛选条件
const initializeFromURL = () => {
  const query = route.query
  if (query.search) searchQuery.value = query.search as string
  if (query.action) selectedAction.value = query.action as string
  if (query.resourceType) selectedResourceType.value = query.resourceType as string
  if (query.startDate) startDate.value = query.startDate as string
  if (query.endDate) endDate.value = query.endDate as string
  if (query.showFilters === 'true') showFilters.value = true
}

// 更新 URL 参数
const updateURLParams = () => {
  const query: Record<string, string> = {}
  
  if (searchQuery.value) query.search = searchQuery.value
  if (selectedAction.value !== 'all') query.action = selectedAction.value
  if (selectedResourceType.value !== 'all') query.resourceType = selectedResourceType.value
  if (startDate.value) query.startDate = startDate.value
  if (endDate.value) query.endDate = endDate.value
  if (showFilters.value) query.showFilters = 'true'
  
  router.replace({ query })
}

// 加载日志
onMounted(async () => {
  initializeFromURL()
  await fetchLogs(buildFilters())
})

// 监听筛选条件变化，更新 URL
watch([searchQuery, selectedAction, selectedResourceType, startDate, endDate, showFilters], () => {
  updateURLParams()
})

// 使用防抖优化搜索性能
const debouncedSearch = useDebounceFn(async () => {
  if (searchQuery.value.trim()) {
    await searchLogs(searchQuery.value, buildFilters())
  } else {
    await applyFilters()
  }
}, 300)

// 处理搜索
const handleSearch = async () => {
  await debouncedSearch()
}

// 构建筛选条件
const buildFilters = (): AuditLogFilters => {
  const filters: AuditLogFilters = { organizationId }
  
  if (selectedAction.value !== 'all') {
    filters.action = selectedAction.value
  }
  
  if (selectedResourceType.value !== 'all') {
    filters.resourceType = selectedResourceType.value
  }
  
  if (startDate.value) {
    filters.startDate = startDate.value
  }
  
  if (endDate.value) {
    filters.endDate = endDate.value
  }
  
  return filters
}

// 应用筛选
const applyFilters = async () => {
  await fetchLogs(buildFilters())
}

// 清除所有筛选
const handleClearFilters = async () => {
  searchQuery.value = ''
  selectedAction.value = 'all'
  selectedResourceType.value = 'all'
  startDate.value = ''
  endDate.value = ''
  showFilters.value = false
  await clearFilters(organizationId)
  updateURLParams()
}

// 导出日志
const handleExport = async (format: 'csv' | 'json') => {
  try {
    await exportLogs(format, buildFilters())
  } catch (error) {
    log.error('导出日志失败:', error)
  }
}

// 获取操作类型标签
const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' => {
  if (action === 'delete') return 'destructive'
  if (action === 'create') return 'default'
  return 'secondary'
}

// 格式化日期时间
const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 格式化操作名称
const formatAction = (action: string) => {
  const actionMap: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    read: '读取',
    login: '登录',
    logout: '登出',
  }
  return actionMap[action] || action
}

// 格式化资源类型
const formatResourceType = (type: string) => {
  const typeMap: Record<string, string> = {
    project: '项目',
    deployment: '部署',
    pipeline: 'Pipeline',
    environment: '环境',
    user: '用户',
    organization: '组织',
  }
  return typeMap[type] || type
}
</script>

<template>
  <PageContainer title="审计日志" description="查看所有操作的审计日志">
    <template #actions>
      <div class="flex gap-2">
        <Button variant="outline" @click="handleExport('csv')" :disabled="!hasLogs || loading">
          <Download class="mr-2 h-4 w-4" />
          导出 CSV
        </Button>
        <Button variant="outline" @click="handleExport('json')" :disabled="!hasLogs || loading">
          <Download class="mr-2 h-4 w-4" />
          导出 JSON
        </Button>
      </div>
    </template>

    <!-- 统计卡片 -->
    <div class="grid gap-4 md:grid-cols-3 mb-6">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">总日志数</CardTitle>
          <FileSearch class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ totalCount }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">当前显示</CardTitle>
          <Filter class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ logs.length }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">筛选状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-sm">
            <Badge v-if="selectedAction !== 'all' || selectedResourceType !== 'all' || startDate || endDate" variant="default">
              已筛选
            </Badge>
            <Badge v-else variant="secondary">
              全部
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 搜索和筛选 -->
    <Card class="mb-6">
      <CardContent class="pt-6">
        <div class="space-y-4">
          <!-- 搜索栏 -->
          <div class="flex gap-2">
            <div class="relative flex-1">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="searchQuery"
                placeholder="搜索日志..."
                class="pl-9"
                @input="debouncedSearch"
                @keyup.enter="handleSearch"
              />
            </div>
            <Button @click="handleSearch" :disabled="loading">
              <Search class="mr-2 h-4 w-4" />
              搜索
            </Button>
            <Button variant="outline" @click="showFilters = !showFilters">
              <Filter class="mr-2 h-4 w-4" />
              {{ showFilters ? '隐藏筛选' : '显示筛选' }}
            </Button>
            <Button variant="outline" @click="handleClearFilters" :disabled="loading">
              <X class="mr-2 h-4 w-4" />
              清除
            </Button>
          </div>

          <!-- 高级筛选 -->
          <div v-if="showFilters" class="grid gap-4 md:grid-cols-4 pt-4 border-t">
            <div class="space-y-2">
              <label class="text-sm font-medium">操作类型</label>
              <Select v-model="selectedAction" @update:model-value="applyFilters">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="action in actionTypes" :key="action.value" :value="action.value">
                    {{ action.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">资源类型</label>
              <Select v-model="selectedResourceType" @update:model-value="applyFilters">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="type in resourceTypes" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">开始日期</label>
              <Input
                v-model="startDate"
                type="datetime-local"
                @change="applyFilters"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">结束日期</label>
              <Input
                v-model="endDate"
                type="datetime-local"
                @change="applyFilters"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 加载状态 -->
    <div v-if="loading && !hasLogs" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 空状态 -->
    <Card v-else-if="!hasLogs">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <FileSearch class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无审计日志</h3>
        <p class="text-sm text-muted-foreground">没有找到符合条件的审计日志</p>
      </CardContent>
    </Card>

    <!-- 日志列表 -->
    <Card v-else>
      <CardHeader>
        <CardTitle>日志列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>资源类型</TableHead>
                <TableHead>资源 ID</TableHead>
                <TableHead>IP 地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="log in logs" :key="log.id">
                <TableCell class="font-mono text-xs">
                  {{ formatDateTime(log.createdAt) }}
                </TableCell>
                <TableCell>
                  <div class="font-medium">{{ log.userName || log.userId }}</div>
                </TableCell>
                <TableCell>
                  <Badge :variant="getActionBadgeVariant(log.action)">
                    {{ formatAction(log.action) }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {{ formatResourceType(log.resourceType) }}
                  </Badge>
                </TableCell>
                <TableCell class="font-mono text-xs">
                  {{ log.resourceId.substring(0, 8) }}...
                </TableCell>
                <TableCell class="font-mono text-xs">
                  {{ log.ipAddress || '-' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </PageContainer>
</template>
