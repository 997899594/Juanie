<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">代码仓库</h3>
        <p class="text-sm text-muted-foreground">
          查看和管理项目的代码仓库
        </p>
      </div>
    </div>

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
    <div v-else class="grid gap-4 md:grid-cols-2">
      <Card
        v-for="repo in repositories"
        :key="repo.id"
        class="hover:shadow-md transition-shadow"
      >
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2">
              <component
                :is="repo.provider === 'github' ? Github : Gitlab"
                class="h-5 w-5"
              />
              <CardTitle class="text-base">{{ repo.name }}</CardTitle>
            </div>
            <Badge :variant="repo.syncStatus === 'synced' ? 'default' : 'secondary'">
              {{ getSyncStatusText(repo.syncStatus) }}
            </Badge>
          </div>
          <CardDescription class="text-xs">{{ repo.url }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">提供商</span>
              <Badge variant="outline" class="text-xs">{{ repo.provider }}</Badge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">默认分支</span>
              <span class="font-mono text-xs">{{ repo.defaultBranch || 'main' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">最后同步</span>
              <span class="text-xs">{{ formatDate(repo.lastSyncAt) }}</span>
            </div>
          </div>
        </CardContent>

      </Card>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRepositories } from '@/composables/useRepositories'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@juanie/ui'
import {
  GitBranch,
  Github,
  Gitlab,
  Loader2,
} from 'lucide-vue-next'

const props = defineProps<{
  projectId: string
}>()

const {
  repositories,
  isLoading,
  fetchRepositories,
} = useRepositories()

// 组件挂载时获取仓库列表
onMounted(() => {
  if (props.projectId) {
    fetchRepositories(props.projectId)
  }
})

const getSyncStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    synced: '已同步',
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
</script>
