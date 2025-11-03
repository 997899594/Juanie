<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">部署记录</h3>
        <p class="text-sm text-muted-foreground">查看项目的部署历史</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <Card v-else-if="deployments.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Rocket class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无部署记录</h3>
        <p class="text-sm text-muted-foreground">开始第一次部署</p>
      </CardContent>
    </Card>

    <div v-else class="space-y-3">
      <div
        v-for="deployment in deployments"
        :key="deployment.id"
        class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
      >
        <div class="flex items-center space-x-4 flex-1">
          <Rocket class="h-5 w-5 text-muted-foreground" />
          <div class="flex-1">
            <div class="flex items-center space-x-2">
              <h3 class="font-semibold text-sm">{{ deployment.version }}</h3>
              <DeploymentStatusBadge :status="deployment.status" />
            </div>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(deployment.createdAt) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useDeployments } from '@/composables/useDeployments'
import DeploymentStatusBadge from '@/components/DeploymentStatusBadge.vue'
import { Card, CardContent } from '@juanie/ui'
import { Rocket, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  projectId: string
}>()

const { deployments, loading, fetchDeployments } = useDeployments()

onMounted(async () => {
  await fetchDeployments({ projectId: props.projectId })
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}
</script>
