<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">部署记录</h3>
        <p class="text-sm text-muted-foreground">查看项目的部署历史</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="showGitOpsDeployDialog = true">
          <GitBranch class="mr-2 h-4 w-4" />
          GitOps 部署
        </Button>
        <Button @click="showDeployDialog = true">
          <Rocket class="mr-2 h-4 w-4" />
          新建部署
        </Button>
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

    <!-- GitOps 部署对话框 -->
    <GitOpsDeployDialog
      v-if="selectedEnvironmentId"
      :open="showGitOpsDeployDialog"
      :project-id="projectId"
      :environment-id="selectedEnvironmentId"
      @update:open="showGitOpsDeployDialog = $event"
      @deploy="handleGitOpsDeploy"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDeployments } from '@/composables/useDeployments'
import { useEnvironments } from '@/composables/useEnvironments'
import DeploymentStatusBadge from '@/components/DeploymentStatusBadge.vue'
import GitOpsDeployDialog from '@/components/GitOpsDeployDialog.vue'
import { Card, CardContent, Button } from '@juanie/ui'
import { Rocket, Loader2, GitBranch } from 'lucide-vue-next'

const props = defineProps<{
  projectId: string
}>()

const { deployments, loading, fetchDeployments } = useDeployments()
const { environments, fetchEnvironments } = useEnvironments()

const showGitOpsDeployDialog = ref(false)
const showDeployDialog = ref(false)
const selectedEnvironmentId = ref<string>('')

onMounted(async () => {
  await Promise.all([
    fetchDeployments({ projectId: props.projectId }),
    fetchEnvironments(props.projectId)
  ])
  
  // 选择第一个环境
  if (environments.value.length > 0) {
    selectedEnvironmentId.value = environments.value[0].id
  }
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

const handleGitOpsDeploy = async (result: any) => {
  showGitOpsDeployDialog.value = false
  // 刷新部署列表
  await fetchDeployments({ projectId: props.projectId })
}
</script>
