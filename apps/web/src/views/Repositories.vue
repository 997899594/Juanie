<template>
  <PageContainer title="仓库管理" description="查看和管理项目的代码仓库">

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <Card v-else-if="repositories.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <GitBranch class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无仓库</h3>
        <p class="text-sm text-muted-foreground">
          项目创建时会自动关联 Git 仓库
        </p>
      </CardContent>
    </Card>

    <!-- Repository Grid -->
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="repo in repositories"
        :key="repo.id"
        class="hover:shadow-lg transition-shadow"
      >
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2">
              <component
                :is="repo.provider === 'github' ? Github : Gitlab"
                class="h-5 w-5"
              />
              <CardTitle class="text-lg">{{ repo.name }}</CardTitle>
            </div>
            <div class="flex items-center gap-2">
              <Badge :variant="repo.status === 'success' ? 'default' : 'secondary'">
                {{ getSyncStatusText(repo.status) }}
              </Badge>
              <!-- Flux 状态已移至 gitops_resources 表，需要单独查询 -->
            </div>
          </div>
          <CardDescription>{{ repo.url }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">提供商</span>
              <Badge variant="outline">{{ repo.provider }}</Badge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">默认分支</span>
              <span class="font-mono">{{ repo.defaultBranch || 'main' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">最后同步</span>
              <span>{{ formatDate(repo.lastSyncAt) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">GitOps</span>
              <Button
                variant="ghost"
                size="sm"
                @click="openGitOpsConfig(repo)"
              >
                <Settings class="h-4 w-4 mr-1" />
                {{ repo.gitopsConfig?.enabled ? '已启用' : '配置' }}
              </Button>
            </div>
            <div v-if="repo.gitopsConfig?.enabled && repo.fluxLastSyncTime" class="flex items-center justify-between">
              <span class="text-muted-foreground">Flux 同步</span>
              <span>{{ formatDate(repo.fluxLastSyncTime) }}</span>
            </div>
          </div>
        </CardContent>

      </Card>
    </div>

    <!-- GitOps Config Dialog -->
    <RepositoryGitOpsConfig
      v-model:open="showGitOpsConfig"
      :repository="selectedRepository"
      @saved="handleGitOpsConfigSaved"
    />


  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRepositories } from '@/composables/useRepositories'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@juanie/ui'
import {
  GitBranch,
  Github,
  Gitlab,
  Loader2,
  Settings,
} from 'lucide-vue-next'
import RepositoryGitOpsConfig from '@/components/RepositoryGitOpsConfig.vue'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const {
  repositories,
  isLoading,
  fetchRepositories,
} = useRepositories()

// 组件挂载时获取仓库列表
onMounted(() => {
  if (projectId.value) {
    fetchRepositories(projectId.value)
  }
})

const showGitOpsConfig = ref(false)
const selectedRepository = ref<any>(null)

const getSyncStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    success: '已同步',
    syncing: '同步中',
    failed: '同步失败',
    pending: '待同步',
  }
  return statusMap[status] || status
}

const formatDate = (date: string | null) => {
  if (!date) return '从未同步'
  return new Date(date).toLocaleString('zh-CN')
}

// 打开GitOps配置对话框
const openGitOpsConfig = (repo: any) => {
  selectedRepository.value = repo
  showGitOpsConfig.value = true
}

// GitOps配置保存后刷新列表
const handleGitOpsConfigSaved = async () => {
  if (projectId.value) {
    await fetchRepositories(projectId.value)
  }
}
</script>
