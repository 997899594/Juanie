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
      :message="error"
      @retry="fetchDeployments"
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
                </div>
                <p class="text-sm text-muted-foreground">
                  部署到 {{ deployment.environmentId }} · {{ formatDate(deployment.createdAt) }}
                </p>
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
import { ref, onMounted, watch } from 'vue'
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
import { Rocket, ChevronRight } from 'lucide-vue-next'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

const router = useRouter()
const { deployments, loading, error, fetchDeployments } = useDeployments()

const selectedEnvironment = ref('all')

onMounted(async () => {
  await fetchDeployments()
})

watch(selectedEnvironment, async (newValue) => {
  const filters: any = {}
  if (newValue !== 'all') {
    filters.environmentId = newValue
  }
  await fetchDeployments(filters)
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}
</script>
