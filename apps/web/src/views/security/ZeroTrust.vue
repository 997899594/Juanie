<template>
  <div class="space-y-6">
    <!-- 页面头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">零信任安全策略</h1>
        <p class="text-muted-foreground">
          基于 AI 的动态风险评估和自适应访问控制系统
        </p>
      </div>
      <div class="flex space-x-2">
        <Button variant="outline">
          <Settings class="mr-2 h-4 w-4" />
          策略配置
        </Button>
        <Button>
          <Plus class="mr-2 h-4 w-4" />
          新建策略
        </Button>
      </div>
    </div>

    <!-- 安全概览 -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">信任评分</CardTitle>
          <Shield class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-green-600">94.2</div>
          <p class="text-xs text-muted-foreground">
            +2.1% 较上周
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">活跃策略</CardTitle>
          <Lock class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">23</div>
          <p class="text-xs text-muted-foreground">
            5 个策略待审核
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">风险事件</CardTitle>
          <AlertTriangle class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-orange-600">7</div>
          <p class="text-xs text-muted-foreground">
            2 个高风险待处理
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">访问请求</CardTitle>
          <Users class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">1,247</div>
          <p class="text-xs text-muted-foreground">
            98.3% 自动批准
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- 策略列表 -->
    <Card>
      <CardHeader>
        <CardTitle>安全策略</CardTitle>
        <CardDescription>当前生效的零信任安全策略</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div v-for="policy in securityPolicies" :key="policy.id" class="flex items-center justify-between p-4 border rounded-lg">
            <div class="flex items-center space-x-4">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <component :is="policy.icon" class="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 class="font-medium">{{ policy.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ policy.description }}</p>
                <div class="flex items-center space-x-4 mt-1">
                  <span class="text-xs text-muted-foreground">风险级别: {{ policy.riskLevel }}</span>
                  <span class="text-xs text-muted-foreground">覆盖范围: {{ policy.coverage }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <Badge :variant="policy.status === 'active' ? 'default' : 'secondary'">
                {{ policy.status === 'active' ? '生效中' : '已暂停' }}
              </Badge>
              <Button variant="ghost" size="sm">
                <MoreHorizontal class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 实时监控 -->
    <div class="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>实时威胁检测</CardTitle>
          <CardDescription>AI 驱动的异常行为检测</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div v-for="threat in realtimeThreats" :key="threat.id" class="flex items-start space-x-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-full" 
                   :class="threat.severity === 'high' ? 'bg-red-100 text-red-600' : 
                           threat.severity === 'medium' ? 'bg-orange-100 text-orange-600' : 
                           'bg-yellow-100 text-yellow-600'">
                <AlertTriangle class="h-4 w-4" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">{{ threat.title }}</p>
                <p class="text-xs text-muted-foreground">{{ threat.description }}</p>
                <p class="text-xs text-muted-foreground">{{ threat.timestamp }}</p>
              </div>
              <Badge :variant="threat.severity === 'high' ? 'destructive' : 'secondary'">
                {{ threat.severity === 'high' ? '高风险' : threat.severity === 'medium' ? '中风险' : '低风险' }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>访问控制日志</CardTitle>
          <CardDescription>最近的访问决策记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div v-for="log in accessLogs" :key="log.id" class="flex items-start space-x-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-full" 
                   :class="log.decision === 'allow' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'">
                <component :is="log.decision === 'allow' ? CheckCircle : XCircle" class="h-4 w-4" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">{{ log.user }} → {{ log.resource }}</p>
                <p class="text-xs text-muted-foreground">信任评分: {{ log.trustScore }}</p>
                <p class="text-xs text-muted-foreground">{{ log.timestamp }}</p>
              </div>
              <Badge :variant="log.decision === 'allow' ? 'default' : 'destructive'">
                {{ log.decision === 'allow' ? '允许' : '拒绝' }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@juanie/ui'
import { Badge } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { 
  Shield, Lock, AlertTriangle, Users, Settings, Plus, 
  MoreHorizontal, CheckCircle, XCircle, Eye, Fingerprint, Globe 
} from 'lucide-vue-next'

// 安全策略
const securityPolicies = ref([
  {
    id: 1,
    name: '多因素身份验证',
    description: '要求所有用户启用 MFA，基于设备信任度动态调整验证强度',
    icon: Fingerprint,
    status: 'active',
    riskLevel: '低',
    coverage: '100%'
  },
  {
    id: 2,
    name: '设备信任评估',
    description: '持续评估设备安全状态，检测异常行为和潜在威胁',
    icon: Shield,
    status: 'active',
    riskLevel: '中',
    coverage: '95%'
  },
  {
    id: 3,
    name: '网络访问控制',
    description: '基于用户身份和设备状态，动态控制网络资源访问权限',
    icon: Globe,
    status: 'active',
    riskLevel: '高',
    coverage: '88%'
  },
  {
    id: 4,
    name: '数据访问监控',
    description: '实时监控敏感数据访问，检测异常访问模式',
    icon: Eye,
    status: 'paused',
    riskLevel: '高',
    coverage: '76%'
  }
])

// 实时威胁
const realtimeThreats = ref([
  {
    id: 1,
    title: '异常登录尝试',
    description: '检测到来自新设备的多次登录失败',
    timestamp: '2分钟前',
    severity: 'high'
  },
  {
    id: 2,
    title: '权限提升请求',
    description: '用户尝试访问超出权限范围的资源',
    timestamp: '5分钟前',
    severity: 'medium'
  },
  {
    id: 3,
    title: '异常数据传输',
    description: '检测到大量数据下载行为',
    timestamp: '8分钟前',
    severity: 'low'
  }
])

// 访问控制日志
const accessLogs = ref([
  {
    id: 1,
    user: 'john.doe@company.com',
    resource: 'production-database',
    decision: 'allow',
    trustScore: '92.5',
    timestamp: '1分钟前'
  },
  {
    id: 2,
    user: 'jane.smith@company.com',
    resource: 'admin-panel',
    decision: 'deny',
    trustScore: '45.2',
    timestamp: '3分钟前'
  },
  {
    id: 3,
    user: 'mike.wilson@company.com',
    resource: 'api-gateway',
    decision: 'allow',
    trustScore: '87.1',
    timestamp: '5分钟前'
  }
])
</script>