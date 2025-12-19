<template>
  <PageContainer title="部署记录" description="查看和管理所有部署记录">
    <template #actions>
      <Select v-model="selectedEnvironment">
        <SelectTrigger class="w-40">
          <SelectValue placeholder="筛选环境" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">所有环境</SelectItem>
          <SelectItem value="development">开发环境</SelectItem>
          <SelectItem value="staging">测试环境</SelectItem>
          <SelectItem value="production">生产环境</SelectItem>
        </SelectContent>
      </Select>
    </template>

    <!-- 错误状态 -->
    <ErrorState
      v-if="error && !loading"
      title="加载失败"
      :message="error?.message"
    />

    <!-- 加载状态 -->
    <LoadingState v-else-if="loading" message="加载部署记录中..." />

    <!-- 空状态 -->
    <EmptyState
      v-else-if="deployments.length === 0 && !error"
      :icon="Rocket"
      title="暂无部署记录"
      description="开始第一次部署"
    />

    <Card v-else>
      <CardHeader>
        <CardTitle>部署列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-3">
          <div
            v-for="deployment in deployments"
            :key="deployment.id"
            class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
            @click="router.push(`/deployments/${deployment.id}`)"
          >
            <div class="flex items-center space-x-4 flex-1">
              <Rocket class="h-5 w-5 text-muted-foreground" />
              <div class="flex-1">
                <div class="flex items-center space-x-2">
                  <h3 class="font-semibold">{{ deployment.version }}</h3>
                  <DeploymentStatusBadge :status="deployment.status" />
                  <Badge 
                    v-if="deployment.deploymentMethod"
                    :variant="getDeploymentMethodVariant(deployment.deploymentMethod)"
                  >
                    {{ getDeploymentMethodText(deployment.deploymentMethod) }}
                  </Badge>
                </div>
                <p class="text-sm text-muted-foreground">
                  部署到 {{ deployment.environmentId }} · {{ formatDate(deployment.createdAt) }}
                </p>
                <div 
                  v-if="deployment.commitHash && deployment.deploymentMethod === 'gitops'"
                  class="flex items-center gap-2 mt-1"
                >
                  <GitCommit class="h-3 w-3 text-muted-foreground" />
                  <code class="text-xs text-muted-foreground font-mono">
                    {{ deployment.commitHash.slice(0, 7) }}
                  </code>
                  <!-- TODO: 需要从项目的 git 配置中构建 commit URL -->
                  <!-- <a 
                    v-if="deployment.commitHash"
                    :href="`https://github.com/org/repo/commit/${deployment.commitHash}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    @click.stop
                  >
                    <ExternalLink class="h-3 w-3" />
                    查看提交
                  </a> -->
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDeployments } from '@/composables/useDeployments'
import DeploymentStatusBadge from '@/components/DeploymentStatusBadge.vue'
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
} from '@juanie/ui'
import { Rocket, ChevronRight, GitCommit } from 'lucide-vue-next'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

const router = useRouter()
const selectedEnvironment = ref('all')

// 使用 TanStack Query - 自动获取数据并响应 filters 变化
const filters = computed(() => {
  const f: any = {}
  if (selectedEnvironment.value !== 'all') {
    f.environmentId = selectedEnvironment.value
  }
  return f
})

const { deployments, loading, error } = useDeployments(filters.value)

// TanStack Query 会自动响应 filters 的变化并重新获取数据
// 不需要手动 watch 或 onMounted

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

const getDeploymentMethodText = (method: string) => {
  const methodMap: Record<string, string> = {
    manual: '手动部署',
    'gitops-ui': 'GitOps (UI)',
    'gitops-git': 'GitOps (Git)',
    pipeline: '流水线',
  }
  return methodMap[method] || method
}

const getDeploymentMethodVariant = (method: string): 'default' | 'secondary' | 'outline' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
    manual: 'outline',
    'gitops-ui': 'default',
    'gitops-git': 'default',
    pipeline: 'secondary',
  }
  return variantMap[method] || 'outline'
}
</script>
