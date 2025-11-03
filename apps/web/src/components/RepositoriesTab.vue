<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">代码仓库</h3>
        <p class="text-sm text-muted-foreground">
          管理项目的代码仓库连接
        </p>
      </div>
      <Button @click="showConnectDialog = true" size="sm">
        <Plus class="mr-2 h-4 w-4" />
        连接仓库
      </Button>
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
        <p class="text-sm text-muted-foreground mb-4">
          连接 GitHub 或 GitLab 仓库以开始使用
        </p>
        <Button @click="showConnectDialog = true" size="sm">
          <Plus class="mr-2 h-4 w-4" />
          连接仓库
        </Button>
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
        <CardFooter class="flex justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="isSyncing"
            @click="handleSync(repo.id)"
          >
            <RefreshCw :class="['h-3 w-3 mr-1', isSyncing && 'animate-spin']" />
            同步
          </Button>
          <Button
            variant="destructive"
            size="sm"
            :disabled="isDisconnecting"
            @click="handleDisconnect(repo.id)"
          >
            <Unplug class="h-3 w-3 mr-1" />
            断开
          </Button>
        </CardFooter>
      </Card>
    </div>

    <!-- Connect Repository Dialog -->
    <Dialog v-model:open="showConnectDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>连接仓库</DialogTitle>
          <DialogDescription>
            连接 GitHub 或 GitLab 仓库到当前项目
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleConnect" class="space-y-4">
          <div class="space-y-2">
            <Label for="provider">提供商</Label>
            <Select v-model="connectForm.provider">
              <SelectTrigger id="provider">
                <SelectValue placeholder="选择提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">
                  <div class="flex items-center">
                    <Github class="mr-2 h-4 w-4" />
                    GitHub
                  </div>
                </SelectItem>
                <SelectItem value="gitlab">
                  <div class="flex items-center">
                    <Gitlab class="mr-2 h-4 w-4" />
                    GitLab
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="url">仓库 URL</Label>
            <Input
              id="url"
              v-model="connectForm.url"
              placeholder="https://github.com/username/repo"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="accessToken">访问令牌</Label>
            <Input
              id="accessToken"
              v-model="connectForm.accessToken"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              required
            />
            <p class="text-xs text-muted-foreground">
              需要具有读取仓库权限的个人访问令牌
            </p>
          </div>

          <div class="space-y-2">
            <Label for="defaultBranch">默认分支（可选）</Label>
            <Input
              id="defaultBranch"
              v-model="connectForm.defaultBranch"
              placeholder="main"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="showConnectDialog = false"
            >
              取消
            </Button>
            <Button type="submit" :disabled="isConnecting">
              <Loader2 v-if="isConnecting" class="mr-2 h-4 w-4 animate-spin" />
              连接
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
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
  Plus,
  GitBranch,
  Github,
  Gitlab,
  RefreshCw,
  Unplug,
  Loader2,
} from 'lucide-vue-next'

const props = defineProps<{
  projectId: string
}>()

const projectIdRef = computed(() => props.projectId)

const {
  repositories,
  isLoading,
  connect,
  sync,
  disconnect,
  isConnecting,
  isSyncing,
  isDisconnecting,
} = useRepositories(projectIdRef)

const showConnectDialog = ref(false)
const connectForm = ref({
  projectId: props.projectId,
  provider: 'github' as 'github' | 'gitlab',
  url: '',
  accessToken: '',
  defaultBranch: '',
})

const handleConnect = () => {
  connect({
    ...connectForm.value,
    projectId: props.projectId,
  })
  showConnectDialog.value = false
  connectForm.value = {
    projectId: props.projectId,
    provider: 'github',
    url: '',
    accessToken: '',
    defaultBranch: '',
  }
}

const handleSync = (repositoryId: string) => {
  sync({ repositoryId })
}

const handleDisconnect = (repositoryId: string) => {
  if (confirm('确定要断开此仓库连接吗？')) {
    disconnect({ repositoryId })
  }
}

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
