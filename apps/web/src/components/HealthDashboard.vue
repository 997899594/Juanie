<template>
  <div class="space-y-4">
    <!-- 健康度概览卡片 -->
    <Card v-if="health">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>健康度评分</CardTitle>
            <CardDescription>基于部署成功率、GitOps 状态和 Pod 健康状态的综合评分</CardDescription>
          </div>
          <Badge 
            :variant="getHealthVariant(health.status)"
            class="text-lg px-4 py-2"
          >
            {{ getHealthLabel(health.status) }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div class="flex items-center gap-6">
          <!-- 圆形进度条 -->
          <div class="flex-shrink-0">
            <div class="relative w-32 h-32">
              <svg class="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  stroke-width="8"
                  fill="none"
                  class="text-secondary"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  stroke-width="8"
                  fill="none"
                  :class="getHealthBarColor(health.status)"
                  :stroke-dasharray="`${(health.score / 100) * 351.86} 351.86`"
                  class="transition-all duration-500"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center">
                  <div class="text-3xl font-bold">{{ health.score }}</div>
                  <div class="text-xs text-muted-foreground">/ 100</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 健康度因素 -->
          <div class="flex-1 space-y-4">
            <div v-if="health.factors" class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">部署成功率</span>
                  <span class="font-semibold">{{ Math.round(health.factors.deploymentSuccessRate * 100) }}%</span>
                </div>
                <div class="w-full bg-secondary rounded-full h-2">
                  <div 
                    class="h-2 rounded-full bg-blue-500 transition-all"
                    :style="{ width: `${health.factors.deploymentSuccessRate * 100}%` }"
                  />
                </div>
              </div>
              
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">GitOps 同步</span>
                  <Badge :variant="getGitOpsStatusVariant(health.factors.gitopsSyncStatus)">
                    {{ getGitOpsStatusLabel(health.factors.gitopsSyncStatus) }}
                  </Badge>
                </div>
              </div>
              
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">Pod 健康状态</span>
                  <Badge :variant="getPodStatusVariant(health.factors.podHealthStatus)">
                    {{ getPodStatusLabel(health.factors.podHealthStatus) }}
                  </Badge>
                </div>
              </div>
              
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-muted-foreground">最后部署</span>
                  <span class="font-semibold">{{ health.factors.lastDeploymentAge }} 天前</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 健康度指标详情 -->
    <div v-if="health?.factors" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="text-base flex items-center gap-2">
            <TrendingUp class="h-4 w-4 text-blue-500" />
            部署成功率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold">{{ Math.round(health.factors.deploymentSuccessRate * 100) }}</span>
              <span class="text-sm text-muted-foreground">%</span>
            </div>
            <div class="w-full bg-secondary rounded-full h-2">
              <div 
                class="h-2 rounded-full bg-blue-500 transition-all"
                :style="{ width: `${health.factors.deploymentSuccessRate * 100}%` }"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              基于最近 10 次部署的成功率
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="text-base flex items-center gap-2">
            <GitBranch class="h-4 w-4 text-green-500" />
            GitOps 同步
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            <Badge 
              :variant="getGitOpsStatusVariant(health.factors.gitopsSyncStatus)"
              class="text-lg px-3 py-1"
            >
              {{ getGitOpsStatusLabel(health.factors.gitopsSyncStatus) }}
            </Badge>
            <p class="text-xs text-muted-foreground">
              所有 GitOps 资源的同步状态
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="text-base flex items-center gap-2">
            <Server class="h-4 w-4 text-purple-500" />
            Pod 健康
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            <Badge 
              :variant="getPodStatusVariant(health.factors.podHealthStatus)"
              class="text-lg px-3 py-1"
            >
              {{ getPodStatusLabel(health.factors.podHealthStatus) }}
            </Badge>
            <p class="text-xs text-muted-foreground">
              所有 Pod 的运行健康状态
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 问题列表 -->
    <Card v-if="health?.issues && health.issues.length > 0">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>发现的问题</CardTitle>
            <CardDescription>需要关注的问题和建议的解决方案</CardDescription>
          </div>
          <Badge variant="destructive">{{ health.issues.length }} 个问题</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div class="space-y-3">
          <div 
            v-for="(issue, index) in health.issues" 
            :key="index"
            class="flex items-start gap-3 p-4 rounded-lg border transition-colors hover:bg-accent"
            :class="{
              'border-red-200 bg-red-50': issue.severity === 'critical',
              'border-yellow-200 bg-yellow-50': issue.severity === 'warning',
              'border-blue-200 bg-blue-50': issue.severity === 'info'
            }"
          >
            <AlertCircle 
              class="h-5 w-5 flex-shrink-0 mt-0.5"
              :class="{
                'text-red-600': issue.severity === 'critical',
                'text-yellow-600': issue.severity === 'warning',
                'text-blue-600': issue.severity === 'info'
              }"
            />
            <div class="flex-1 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <Badge 
                    :variant="issue.severity === 'critical' ? 'destructive' : issue.severity === 'warning' ? 'secondary' : 'default'"
                    class="text-xs mb-1"
                  >
                    {{ getSeverityLabel(issue.severity) }}
                  </Badge>
                  <Badge variant="outline" class="text-xs mb-1 ml-1">
                    {{ getCategoryLabel(issue.category) }}
                  </Badge>
                  <p class="text-sm font-medium mt-1">{{ issue.message }}</p>
                </div>
              </div>
              <div v-if="issue.affectedResources && issue.affectedResources.length" class="text-xs text-muted-foreground">
                <span class="font-medium">影响资源:</span> {{ issue.affectedResources.join(', ') }}
              </div>
              <div v-if="issue.suggestedAction" class="flex items-start gap-2 p-2 rounded bg-background/50">
                <Lightbulb class="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div class="text-sm">
                  <span class="font-medium">建议操作:</span> {{ issue.suggestedAction }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 无问题状态 -->
    <Card v-else-if="health && (!health.issues || health.issues.length === 0)">
      <CardContent class="py-12">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle class="h-8 w-8 text-green-600" />
          </div>
          <h3 class="text-lg font-semibold mb-2">项目运行良好</h3>
          <p class="text-sm text-muted-foreground">
            未发现任何问题，继续保持！
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- 优化建议 -->
    <Card v-if="health?.recommendations && health.recommendations.length > 0">
      <CardHeader>
        <div class="flex items-center gap-2">
          <Lightbulb class="h-5 w-5 text-yellow-600" />
          <CardTitle>优化建议</CardTitle>
        </div>
        <CardDescription>提升项目健康度的建议</CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="space-y-3">
          <li 
            v-for="(recommendation, index) in health.recommendations" 
            :key="index"
            class="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
          >
            <div class="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span class="text-xs font-semibold text-primary">{{ index + 1 }}</span>
            </div>
            <span class="text-sm">{{ recommendation }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- 健康度趋势图表占位符 -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <TrendingUp class="h-5 w-5 text-blue-500" />
          <CardTitle>健康度趋势</CardTitle>
        </div>
        <CardDescription>最近 7 天的健康度变化</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div class="flex gap-3">
            <Activity class="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div class="space-y-1">
              <p class="text-sm font-medium text-blue-900">趋势图表</p>
              <p class="text-sm text-blue-700">
                健康度趋势图表功能将在后续版本中实现，用于展示项目健康度的历史变化。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 加载状态 -->
    <div v-if="!health" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@juanie/ui'
import {
  AlertCircle,
  TrendingUp,
  GitBranch,
  Server,
  Lightbulb,
  CheckCircle,
  Activity,
  Loader2,
} from 'lucide-vue-next'

interface Props {
  health: any
}

defineProps<Props>()

function getHealthVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'warning':
      return 'secondary'
    case 'critical':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getHealthLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '健康'
    case 'warning':
      return '警告'
    case 'critical':
      return '严重'
    default:
      return '未知'
  }
}

function getHealthBarColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'text-green-500'
    case 'warning':
      return 'text-yellow-500'
    case 'critical':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

function getGitOpsStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'degraded':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getGitOpsStatusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '正常'
    case 'degraded':
      return '降级'
    case 'failed':
      return '失败'
    default:
      return '未知'
  }
}

function getPodStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'degraded':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getPodStatusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '健康'
    case 'degraded':
      return '部分异常'
    case 'failed':
      return '异常'
    default:
      return '未知'
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'critical':
      return '严重'
    case 'warning':
      return '警告'
    case 'info':
      return '信息'
    default:
      return severity
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'deployment':
      return '部署'
    case 'gitops':
      return 'GitOps'
    case 'resource':
      return '资源'
    case 'security':
      return '安全'
    default:
      return category
  }
}
</script>
