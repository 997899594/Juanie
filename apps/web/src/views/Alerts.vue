<script setup lang="ts">
import { ref, computed } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Button } from '@juanie/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@juanie/ui'
import { Input } from '@juanie/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@juanie/ui'
import { AlertCircle, AlertTriangle, Bell, BellOff, CheckCircle, Info, Search } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

// 告警类型
type AlertSeverity = 'critical' | 'warning' | 'info'
type AlertStatus = 'firing' | 'resolved' | 'silenced'

interface Alert {
  id: string
  name: string
  severity: AlertSeverity
  status: AlertStatus
  component: string
  summary: string
  description: string
  startsAt: string
  endsAt?: string
  labels: Record<string, string>
}

// 模拟告警数据（实际应该从 Prometheus Alertmanager API 获取）
const mockAlerts: Alert[] = [
  {
    id: '1',
    name: 'HighErrorRate',
    severity: 'critical',
    status: 'firing',
    component: 'api',
    summary: 'API 错误率过高',
    description: 'API 错误率为 8.5%，超过 5% 阈值',
    startsAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    labels: { job: 'api-gateway', instance: 'api-gateway:3001' },
  },
  {
    id: '2',
    name: 'HighLatency',
    severity: 'warning',
    status: 'firing',
    component: 'api',
    summary: 'API 响应延迟过高',
    description: 'API P95 延迟为 1.2s，超过 1s 阈值',
    startsAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    labels: { job: 'api-gateway' },
  },
  {
    id: '3',
    name: 'HighMemoryUsage',
    severity: 'warning',
    status: 'firing',
    component: 'system',
    summary: '内存使用率过高',
    description: '实例 api-gateway 内存使用率为 87%，超过 85%',
    startsAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    labels: { instance: 'api-gateway' },
  },
  {
    id: '4',
    name: 'HighDatabaseConnections',
    severity: 'warning',
    status: 'silenced',
    component: 'database',
    summary: '数据库连接数过高',
    description: '数据库 devops_prod 当前连接数为 85，接近上限',
    startsAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    labels: { datname: 'devops_prod' },
  },
  {
    id: '5',
    name: 'APIServiceDown',
    severity: 'critical',
    status: 'resolved',
    component: 'api',
    summary: 'API Gateway 服务宕机',
    description: 'API Gateway (api-gateway:3001) 已宕机超过 1 分钟',
    startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    labels: { job: 'api-gateway', instance: 'api-gateway:3001' },
  },
]

const alerts = ref<Alert[]>(mockAlerts)
const searchQuery = ref('')
const selectedSeverity = ref<string>('all')
const selectedStatus = ref<string>('all')
const selectedAlert = ref<Alert | null>(null)
const showSilenceDialog = ref(false)
const showAcknowledgeDialog = ref(false)
const silenceDuration = ref('1h')

// 筛选后的告警
const filteredAlerts = computed(() => {
  return alerts.value.filter((alert) => {
    const matchesSearch =
      searchQuery.value === '' ||
      alert.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      alert.summary.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesSeverity =
      selectedSeverity.value === 'all' || alert.severity === selectedSeverity.value

    const matchesStatus =
      selectedStatus.value === 'all' || alert.status === selectedStatus.value

    return matchesSearch && matchesSeverity && matchesStatus
  })
})

// 统计数据
const stats = computed(() => {
  const firing = alerts.value.filter((a) => a.status === 'firing').length
  const critical = alerts.value.filter((a) => a.severity === 'critical' && a.status === 'firing').length
  const warning = alerts.value.filter((a) => a.severity === 'warning' && a.status === 'firing').length
  const silenced = alerts.value.filter((a) => a.status === 'silenced').length

  return { firing, critical, warning, silenced }
})

// 获取严重程度图标
function getSeverityIcon(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    case 'info':
      return Info
  }
}

// 获取严重程度变体
function getSeverityVariant(severity: AlertSeverity): 'destructive' | 'default' | 'secondary' {
  switch (severity) {
    case 'critical':
      return 'destructive'
    case 'warning':
      return 'default'
    case 'info':
      return 'secondary'
  }
}

// 获取状态变体
function getStatusVariant(status: AlertStatus): 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'firing':
      return 'destructive'
    case 'silenced':
      return 'secondary'
    case 'resolved':
      return 'outline'
  }
}

// 格式化时间
function formatTime(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} 天前`
  if (hours > 0) return `${hours} 小时前`
  if (minutes > 0) return `${minutes} 分钟前`
  return '刚刚'
}

// 静默告警
function openSilenceDialog(alert: Alert) {
  selectedAlert.value = alert
  showSilenceDialog.value = true
}

function silenceAlert() {
  if (!selectedAlert.value) return

  const alert = alerts.value.find((a) => a.id === selectedAlert.value!.id)
  if (alert) {
    alert.status = 'silenced'
    toast.success('告警已静默', `${alert.name} 将在 ${silenceDuration.value} 后恢复`)
  }

  showSilenceDialog.value = false
  selectedAlert.value = null
}

// 确认告警
function openAcknowledgeDialog(alert: Alert) {
  selectedAlert.value = alert
  showAcknowledgeDialog.value = true
}

function acknowledgeAlert() {
  if (!selectedAlert.value) return

  const alert = alerts.value.find((a) => a.id === selectedAlert.value!.id)
  if (alert) {
    alert.status = 'resolved'
    alert.endsAt = new Date().toISOString()
    toast.success('告警已确认', `${alert.name} 已标记为已解决`)
  }

  showAcknowledgeDialog.value = false
  selectedAlert.value = null
}

// 刷新告警
function refreshAlerts() {
  toast.info('刷新告警', '正在从 Prometheus 获取最新告警...')
  // 实际应该调用 Prometheus Alertmanager API
  // 这里只是模拟刷新
  setTimeout(() => {
    toast.success('刷新成功', '告警列表已更新')
  }, 1000)
}
</script>

<template>
  <div 
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300, ease: 'easeOut' } }"
    class="container mx-auto p-6 space-y-6"
  >
    <!-- 页面标题 -->
    <div 
      v-motion
      :initial="{ opacity: 0, x: -20 }"
      :enter="{ opacity: 1, x: 0, transition: { duration: 300, delay: 100 } }"
      class="flex items-center justify-between"
    >
      <div>
        <h1 class="text-3xl font-bold tracking-tight">监控告警</h1>
        <p class="text-muted-foreground mt-2">
          查看和管理 Prometheus 告警
        </p>
      </div>
      <Button @click="refreshAlerts">
        刷新告警
      </Button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid gap-4 md:grid-cols-4">
      <Card
        v-motion
        :initial="{ opacity: 0, scale: 0.9 }"
        :enter="{ opacity: 1, scale: 1, transition: { duration: 300, delay: 150 } }"
        class="transition-all hover:shadow-lg hover:scale-[1.02]"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">触发中</CardTitle>
          <Bell class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.firing }}</div>
          <p class="text-xs text-muted-foreground">
            当前触发的告警
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">严重告警</CardTitle>
          <AlertCircle class="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-destructive">{{ stats.critical }}</div>
          <p class="text-xs text-muted-foreground">
            需要立即处理
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">警告告警</CardTitle>
          <AlertTriangle class="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-yellow-600">{{ stats.warning }}</div>
          <p class="text-xs text-muted-foreground">
            需要关注
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">已静默</CardTitle>
          <BellOff class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.silenced }}</div>
          <p class="text-xs text-muted-foreground">
            暂时静默的告警
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- 筛选和搜索 -->
    <Card>
      <CardHeader>
        <CardTitle>告警列表</CardTitle>
        <CardDescription>
          查看和管理所有告警
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex gap-4">
          <div class="relative flex-1">
            <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="搜索告警名称或描述..."
              class="pl-8"
            />
          </div>
          <Select v-model="selectedSeverity">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="严重程度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="critical">严重</SelectItem>
              <SelectItem value="warning">警告</SelectItem>
              <SelectItem value="info">信息</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="selectedStatus">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="firing">触发中</SelectItem>
              <SelectItem value="silenced">已静默</SelectItem>
              <SelectItem value="resolved">已解决</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 告警表格 -->
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>严重程度</TableHead>
                <TableHead>告警名称</TableHead>
                <TableHead>组件</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>触发时间</TableHead>
                <TableHead class="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="filteredAlerts.length === 0">
                <TableCell colspan="6" class="text-center text-muted-foreground">
                  没有找到告警
                </TableCell>
              </TableRow>
              <TableRow v-for="alert in filteredAlerts" :key="alert.id">
                <TableCell>
                  <Badge :variant="getSeverityVariant(alert.severity)" class="flex items-center gap-1 w-fit">
                    <component :is="getSeverityIcon(alert.severity)" class="h-3 w-3" />
                    {{ alert.severity === 'critical' ? '严重' : alert.severity === 'warning' ? '警告' : '信息' }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div class="font-medium">{{ alert.name }}</div>
                    <div class="text-sm text-muted-foreground">{{ alert.summary }}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ alert.component }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge :variant="getStatusVariant(alert.status)">
                    {{ alert.status === 'firing' ? '触发中' : alert.status === 'silenced' ? '已静默' : '已解决' }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div class="text-sm">{{ formatTime(alert.startsAt) }}</div>
                  <div v-if="alert.endsAt" class="text-xs text-muted-foreground">
                    持续 {{ formatTime(alert.endsAt) }}
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-2">
                    <Button
                      v-if="alert.status === 'firing'"
                      variant="outline"
                      size="sm"
                      @click="openSilenceDialog(alert)"
                    >
                      <BellOff class="h-4 w-4 mr-1" />
                      静默
                    </Button>
                    <Button
                      v-if="alert.status === 'firing'"
                      variant="outline"
                      size="sm"
                      @click="openAcknowledgeDialog(alert)"
                    >
                      <CheckCircle class="h-4 w-4 mr-1" />
                      确认
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <!-- 静默对话框 -->
    <Dialog v-model:open="showSilenceDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>静默告警</DialogTitle>
          <DialogDescription>
            选择静默时长，在此期间不会收到此告警的通知
          </DialogDescription>
        </DialogHeader>
        <div v-if="selectedAlert" class="space-y-4">
          <div>
            <p class="text-sm font-medium">{{ selectedAlert.name }}</p>
            <p class="text-sm text-muted-foreground">{{ selectedAlert.summary }}</p>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">静默时长</label>
            <Select v-model="silenceDuration">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">15 分钟</SelectItem>
                <SelectItem value="30m">30 分钟</SelectItem>
                <SelectItem value="1h">1 小时</SelectItem>
                <SelectItem value="2h">2 小时</SelectItem>
                <SelectItem value="6h">6 小时</SelectItem>
                <SelectItem value="12h">12 小时</SelectItem>
                <SelectItem value="24h">24 小时</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showSilenceDialog = false">
            取消
          </Button>
          <Button @click="silenceAlert">
            确认静默
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 确认对话框 -->
    <Dialog v-model:open="showAcknowledgeDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认告警</DialogTitle>
          <DialogDescription>
            确认此告警已被处理并解决
          </DialogDescription>
        </DialogHeader>
        <div v-if="selectedAlert" class="space-y-4">
          <div>
            <p class="text-sm font-medium">{{ selectedAlert.name }}</p>
            <p class="text-sm text-muted-foreground">{{ selectedAlert.summary }}</p>
            <p class="text-sm text-muted-foreground mt-2">{{ selectedAlert.description }}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAcknowledgeDialog = false">
            取消
          </Button>
          <Button @click="acknowledgeAlert">
            确认已解决
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
