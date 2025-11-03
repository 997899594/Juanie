<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMotion } from '@vueuse/motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Activity, BarChart3, FileText } from 'lucide-vue-next'

// 时间范围选项
const timeRanges = [
  { value: '5m', label: '最近 5 分钟' },
  { value: '15m', label: '最近 15 分钟' },
  { value: '30m', label: '最近 30 分钟' },
  { value: '1h', label: '最近 1 小时' },
  { value: '3h', label: '最近 3 小时' },
  { value: '6h', label: '最近 6 小时' },
  { value: '12h', label: '最近 12 小时' },
  { value: '24h', label: '最近 24 小时' },
  { value: '7d', label: '最近 7 天' },
]

const selectedTimeRange = ref('1h')
const activeTab = ref('metrics')

// Grafana 和 Jaeger 的 URL
const grafanaUrl = computed(() => {
  const baseUrl = import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000'
  const from = `now-${selectedTimeRange.value}`
  const to = 'now'
  return `${baseUrl}/d/api-overview?from=${from}&to=${to}&refresh=30s&kiosk`
})

const jaegerUrl = computed(() => {
  const baseUrl = import.meta.env.VITE_JAEGER_URL || 'http://localhost:16686'
  // 计算时间范围（微秒）
  const now = Date.now() * 1000
  const lookback = getLookbackMicroseconds(selectedTimeRange.value)
  const start = now - lookback
  return `${baseUrl}/search?service=api-gateway&start=${start}&end=${now}&limit=20`
})

// 将时间范围转换为微秒
function getLookbackMicroseconds(range: string): number {
  const value = Number.parseInt(range.slice(0, -1))
  const unit = range.slice(-1)
  
  const multipliers: Record<string, number> = {
    'm': 60 * 1000 * 1000, // 分钟
    'h': 60 * 60 * 1000 * 1000, // 小时
    'd': 24 * 60 * 60 * 1000 * 1000, // 天
  }
  
  return value * (multipliers[unit] ?? multipliers['h']!)
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
        <h1 class="text-3xl font-bold tracking-tight">可观测性</h1>
        <p class="text-muted-foreground mt-2">
          查看系统指标、分布式追踪和日志
        </p>
      </div>
      
      <!-- 时间范围选择器 -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">时间范围:</span>
        <Select v-model="selectedTimeRange">
          <SelectTrigger class="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="range in timeRanges"
              :key="range.value"
              :value="range.value"
            >
              {{ range.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- 标签页 -->
    <Tabs v-model="activeTab" class="space-y-4">
      <TabsList class="grid w-full grid-cols-3">
        <TabsTrigger value="metrics" class="flex items-center gap-2">
          <BarChart3 class="h-4 w-4" />
          指标 (Metrics)
        </TabsTrigger>
        <TabsTrigger value="traces" class="flex items-center gap-2">
          <Activity class="h-4 w-4" />
          追踪 (Traces)
        </TabsTrigger>
        <TabsTrigger value="logs" class="flex items-center gap-2">
          <FileText class="h-4 w-4" />
          日志 (Logs)
        </TabsTrigger>
      </TabsList>

      <!-- Metrics 标签页 -->
      <TabsContent value="metrics" class="space-y-4">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Grafana 仪表板</CardTitle>
                <CardDescription>
                  查看 HTTP 请求指标、数据库性能和业务指标
                </CardDescription>
              </div>
              <Badge variant="outline" class="flex items-center gap-1">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                实时更新
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div class="relative w-full" style="height: calc(100vh - 300px); min-height: 600px;">
              <iframe
                :src="grafanaUrl"
                class="w-full h-full border-0 rounded-lg"
                title="Grafana Dashboard"
              />
            </div>
            <div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                显示最近 {{ timeRanges.find(r => r.value === selectedTimeRange)?.label || selectedTimeRange }} 的数据
              </p>
              <a
                :href="grafanaUrl.replace('&kiosk', '')"
                target="_blank"
                class="text-primary hover:underline"
              >
                在新窗口中打开 →
              </a>
            </div>
          </CardContent>
        </Card>

        <!-- 快速指标卡片 -->
        <div class="grid gap-4 md:grid-cols-3">
          <Card
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { duration: 300, delay: 150 } }"
            class="transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">请求速率</CardTitle>
              <BarChart3 class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">--</div>
              <p class="text-xs text-muted-foreground">
                请求/秒
              </p>
            </CardContent>
          </Card>

          <Card
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { duration: 300, delay: 200 } }"
            class="transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">错误率</CardTitle>
              <Activity class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">--</div>
              <p class="text-xs text-muted-foreground">
                5xx 错误百分比
              </p>
            </CardContent>
          </Card>

          <Card
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { duration: 300, delay: 250 } }"
            class="transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">P95 延迟</CardTitle>
              <FileText class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">--</div>
              <p class="text-xs text-muted-foreground">
                毫秒
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- Traces 标签页 -->
      <TabsContent value="traces" class="space-y-4">
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle>Jaeger 分布式追踪</CardTitle>
                <CardDescription>
                  查看请求链路追踪和性能瓶颈分析
                </CardDescription>
              </div>
              <Badge variant="outline">api-gateway</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div class="relative w-full" style="height: calc(100vh - 300px); min-height: 600px;">
              <iframe
                :src="jaegerUrl"
                class="w-full h-full border-0 rounded-lg"
                title="Jaeger Tracing"
              />
            </div>
            <div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                显示 api-gateway 服务最近 {{ timeRanges.find(r => r.value === selectedTimeRange)?.label || selectedTimeRange }} 的追踪
              </p>
              <a
                :href="jaegerUrl"
                target="_blank"
                class="text-primary hover:underline"
              >
                在新窗口中打开 →
              </a>
            </div>
          </CardContent>
        </Card>

        <!-- 追踪统计 -->
        <div class="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle class="text-sm font-medium">追踪分析</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">总追踪数</span>
                <span class="text-sm font-medium">--</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">平均 Span 数</span>
                <span class="text-sm font-medium">--</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">错误追踪</span>
                <span class="text-sm font-medium text-destructive">--</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle class="text-sm font-medium">服务依赖</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="flex items-center gap-2">
                <Badge variant="secondary">api-gateway</Badge>
                <span class="text-sm text-muted-foreground">→</span>
                <Badge variant="outline">postgres</Badge>
              </div>
              <div class="flex items-center gap-2">
                <Badge variant="secondary">api-gateway</Badge>
                <span class="text-sm text-muted-foreground">→</span>
                <Badge variant="outline">redis</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- Logs 标签页 -->
      <TabsContent value="logs" class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>日志查询</CardTitle>
            <CardDescription>
              使用 Loki 查询和分析应用日志（需要配置 Loki）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-center h-[400px] border-2 border-dashed rounded-lg">
              <div class="text-center space-y-2">
                <FileText class="h-12 w-12 mx-auto text-muted-foreground" />
                <p class="text-sm text-muted-foreground">
                  日志聚合功能需要配置 Loki
                </p>
                <p class="text-xs text-muted-foreground">
                  请参考文档配置 Loki 和日志驱动
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
