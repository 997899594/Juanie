<template>
  <div class="space-y-6">
    <!-- 页面头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">成本跟踪</h1>
        <p class="text-muted-foreground">
          AI 驱动的智能成本分析与优化建议
        </p>
      </div>
      <div class="flex space-x-2">
        <Button variant="outline">
          <Download class="mr-2 h-4 w-4" />
          导出报告
        </Button>
        <Button>
          <Settings class="mr-2 h-4 w-4" />
          成本配置
        </Button>
      </div>
    </div>

    <!-- 成本概览 -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">本月支出</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">¥24,567</div>
          <p class="text-xs text-muted-foreground">
            <span class="text-red-600">+12.3%</span> 较上月
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">预算使用率</CardTitle>
          <Target class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">73.2%</div>
          <p class="text-xs text-muted-foreground">
            预算剩余 ¥8,933
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">优化潜力</CardTitle>
          <TrendingDown class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-green-600">¥3,245</div>
          <p class="text-xs text-muted-foreground">
            可节省 13.2%
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">碳足迹</CardTitle>
          <Leaf class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">2.4t</div>
          <p class="text-xs text-muted-foreground">
            <span class="text-green-600">-8.1%</span> CO₂ 排放
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- 成本分析图表 -->
    <div class="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>成本趋势</CardTitle>
          <CardDescription>过去 6 个月的支出变化</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-[300px] flex items-center justify-center text-muted-foreground">
            <div class="text-center">
              <BarChart3 class="h-12 w-12 mx-auto mb-2" />
              <p>成本趋势图表</p>
              <p class="text-xs">集成 ECharts 或其他图表库</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>服务分布</CardTitle>
          <CardDescription>各服务成本占比</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div v-for="service in costBreakdown" :key="service.name" class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: service.color }"></div>
                <span class="text-sm font-medium">{{ service.name }}</span>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium">¥{{ service.cost.toLocaleString() }}</div>
                <div class="text-xs text-muted-foreground">{{ service.percentage }}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- AI 优化建议 -->
    <Card>
      <CardHeader>
        <CardTitle>AI 优化建议</CardTitle>
        <CardDescription>基于使用模式的智能成本优化建议</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div v-for="recommendation in aiRecommendations" :key="recommendation.id" class="flex items-start space-x-4 p-4 border rounded-lg">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg" 
                 :class="recommendation.impact === 'high' ? 'bg-green-100 text-green-600' : 
                         recommendation.impact === 'medium' ? 'bg-blue-100 text-blue-600' : 
                         'bg-yellow-100 text-yellow-600'">
              <component :is="recommendation.icon" class="h-5 w-5" />
            </div>
            <div class="flex-1">
              <h3 class="font-medium">{{ recommendation.title }}</h3>
              <p class="text-sm text-muted-foreground mt-1">{{ recommendation.description }}</p>
              <div class="flex items-center space-x-4 mt-2">
                <span class="text-xs text-muted-foreground">预计节省: ¥{{ recommendation.savings.toLocaleString() }}/月</span>
                <span class="text-xs text-muted-foreground">实施难度: {{ recommendation.difficulty }}</span>
              </div>
            </div>
            <div class="flex space-x-2">
              <Badge :variant="recommendation.impact === 'high' ? 'default' : 'secondary'">
                {{ recommendation.impact === 'high' ? '高影响' : recommendation.impact === 'medium' ? '中影响' : '低影响' }}
              </Badge>
              <Button variant="outline" size="sm">
                应用建议
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 资源使用详情 -->
    <Card>
      <CardHeader>
        <CardTitle>资源使用详情</CardTitle>
        <CardDescription>各项资源的使用情况和成本分析</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div v-for="resource in resourceUsage" :key="resource.name" class="flex items-center justify-between p-3 border rounded">
            <div class="flex items-center space-x-3">
              <component :is="resource.icon" class="h-5 w-5 text-muted-foreground" />
              <div>
                <p class="font-medium">{{ resource.name }}</p>
                <p class="text-sm text-muted-foreground">{{ resource.description }}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-medium">¥{{ resource.cost.toLocaleString() }}</p>
              <p class="text-sm text-muted-foreground">{{ resource.usage }}% 使用率</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { 
  DollarSign, Target, TrendingDown, Leaf, BarChart3, Settings, Download,
  Server, Database, Globe, Cpu, HardDrive, Zap, Clock, ArrowRight
} from 'lucide-vue-next'

// 成本分布
const costBreakdown = ref([
  { name: '计算实例', cost: 12500, percentage: 51, color: '#3b82f6' },
  { name: '存储服务', cost: 4800, percentage: 20, color: '#10b981' },
  { name: '网络流量', cost: 3200, percentage: 13, color: '#f59e0b' },
  { name: '数据库', cost: 2800, percentage: 11, color: '#ef4444' },
  { name: '其他服务', cost: 1267, percentage: 5, color: '#8b5cf6' }
])

// AI 优化建议
const aiRecommendations = ref([
  {
    id: 1,
    title: '调整实例规格',
    description: '检测到 3 台服务器 CPU 使用率长期低于 20%，建议降级到更小规格',
    savings: 1850,
    difficulty: '简单',
    impact: 'high',
    icon: Server
  },
  {
    id: 2,
    title: '启用自动扩缩容',
    description: '为 Web 服务启用自动扩缩容，根据流量动态调整实例数量',
    savings: 980,
    difficulty: '中等',
    impact: 'medium',
    icon: Zap
  },
  {
    id: 3,
    title: '优化存储策略',
    description: '将冷数据迁移到低成本存储，可节省 30% 存储费用',
    savings: 720,
    difficulty: '简单',
    impact: 'medium',
    icon: HardDrive
  },
  {
    id: 4,
    title: '使用预留实例',
    description: '对稳定运行的服务使用预留实例，可获得显著折扣',
    savings: 2100,
    difficulty: '简单',
    impact: 'high',
    icon: Clock
  }
])

// 资源使用情况
const resourceUsage = ref([
  {
    name: 'Web 服务器',
    description: '4 台实例，平均 CPU 使用率',
    cost: 8500,
    usage: 45,
    icon: Server
  },
  {
    name: '数据库集群',
    description: '主从架构，包含备份和监控',
    cost: 2800,
    usage: 78,
    icon: Database
  },
  {
    name: 'CDN 服务',
    description: '全球内容分发网络',
    cost: 1200,
    usage: 62,
    icon: Globe
  },
  {
    name: '负载均衡器',
    description: '高可用负载均衡服务',
    cost: 450,
    usage: 35,
    icon: ArrowRight
  }
])
</script>