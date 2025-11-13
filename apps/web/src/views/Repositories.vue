<template>
  <PageContainer title="仓库管理" description="管理项目的代码仓库连接">
    <template #actions>
      <Button @click="showConnectDialog = true">
        <Plus class="mr-2 h-4 w-4" />
        连接仓库
      </Button>
    </template>

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
        <Button @click="showConnectDialog = true">
          <Plus class="mr-2 h-4 w-4" />
          连接仓库
        </Button>
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
              <Badge :variant="repo.syncStatus === 'synced' ? 'default' : 'secondary'">
                {{ getSyncStatusText(repo.syncStatus) }}
              </Badge>
              <Badge 
                v-if="repo.gitopsConfig?.enabled && repo.fluxSyncStatus"
                :variant="getFluxStatusVariant(repo.fluxSyncStatus)"
              >
                Flux: {{ getFluxStatusText(repo.fluxSyncStatus) }}
              </Badge>
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
            <div v-if="repo.gitopsConfig?.enabled" class="flex items-center justify-between">
              <span class="text-muted-foreground">GitOps</span>
              <div class="flex items-center gap-2">
                <Switch 
                  :checked="repo.gitopsConfig.enabled" 
                  @update:checked="(val: boolean) => toggleGitOps(repo.id, val)"
                  :disabled="isTogglingGitOps"
                />
                <span class="text-xs">{{ repo.gitopsConfig.enabled ? '已启用' : '已禁用' }}</span>
              </div>
            </div>
            <div v-if="repo.gitopsConfig?.enabled && repo.fluxLastSyncTime" class="flex items-center justify-between">
              <span class="text-muted-foreground">Flux 同步</span>
              <span>{{ formatDate(repo.fluxLastSyncTime) }}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="flex justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="isLoading"
            @click="handleSync(repo.id)"
          >
            <RefreshCw :class="['h-4 w-4 mr-2', isLoading && 'animate-spin']" />
            同步
          </Button>
          <Button
            variant="destructive"
            size="sm"
            :disabled="isLoading"
            @click="handleDisconnect(repo.id)"
          >
            <Unplug class="h-4 w-4 mr-2" />
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
            <Button type="submit" :disabled="isLoading">
              <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
              连接
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
import { Switch } from '@juanie/ui'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const {
  repositories,
  isLoading,
  fetchRepositories,
  connect,
  sync,
  disconnect,
} = useRepositories()

// 组件挂载时获取仓库列表
onMounted(() => {
  if (projectId.value) {
    fetchRepositories(projectId.value)
  }
})

const showConnectDialog = ref(false)
const connectForm = ref({
  provider: 'github' as 'github' | 'gitlab',
  url: '',
  defaultBranch: '',
})

// 解析仓库 URL
const parseRepoUrl = (url: string) => {
  const match = url.match(/(?:https?:\/\/|git@)?(?:github|gitlab)\.com[:/](.+?)(?:\.git)?$/)
  return match ? match[1] : ''
}

const handleConnect = async () => {
  try {
    const fullName = parseRepoUrl(connectForm.value.url)
    if (!fullName) {
      throw new Error('无效的仓库 URL')
    }
    
    await connect({
      projectId: projectId.value,
      provider: connectForm.value.provider,
      fullName,
      cloneUrl: connectForm.value.url,
      defaultBranch: connectForm.value.defaultBranch || undefined,
    })
    showConnectDialog.value = false
    connectForm.value = {
      provider: 'github',
      url: '',
      defaultBranch: '',
    }
    // 重新获取仓库列表
    await fetchRepositories(projectId.value)
  } catch (error) {
    console.error('Failed to connect repository:', error)
  }
}

const handleSync = async (repositoryId: string) => {
  try {
    await sync({ repositoryId })
    // 重新获取仓库列表
    await fetchRepositories(projectId.value)
  } catch (error) {
    console.error('Failed to sync repository:', error)
  }
}

const handleDisconnect = async (repositoryId: string) => {
  if (confirm('确定要断开此仓库连接吗？')) {
    try {
      await disconnect({ repositoryId })
      // 重新获取仓库列表
      await fetchRepositories(projectId.value)
    } catch (error) {
      console.error('Failed to disconnect repository:', error)
    }
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

const getFluxStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    ready: '就绪',
    reconciling: '同步中',
    failed: '失败',
  }
  return statusMap[status] || status
}

const getFluxStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive'> = {
    ready: 'default',
    reconciling: 'secondary',
    failed: 'destructive',
  }
  return variantMap[status] || 'secondary'
}

const isTogglingGitOps = ref(false)
const toggleGitOps = async (repositoryId: string, enabled: boolean) => {
  isTogglingGitOps.value = true
  try {
    // TODO: Implement GitOps toggle API call
    // await trpc.repositories.toggleGitOps.mutate({ repositoryId, enabled })
    console.log('Toggle GitOps:', repositoryId, enabled)
  } catch (error) {
    console.error('Failed to toggle GitOps:', error)
  } finally {
    isTogglingGitOps.value = false
  }
}
</script>
