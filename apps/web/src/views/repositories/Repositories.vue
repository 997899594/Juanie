<template>
  <div class="container mx-auto py-6 space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">代码仓库</h1>
        <p class="text-muted-foreground mt-2">
          管理您的 GitHub 和 GitLab 仓库
        </p>
      </div>
      <Button @click="showConnectDialog = true">
        <Plus class="mr-2 h-4 w-4" />
        连接仓库
      </Button>
    </div>

    <!-- 仓库列表 -->
    <div v-if="repositories.length > 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="repo in repositories" :key="repo.id" class="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2">
              <component 
                :is="repo.provider === 'github' ? Github : Gitlab" 
                class="h-5 w-5"
              />
              <CardTitle class="text-lg">{{ repo.fullName }}</CardTitle>
            </div>
            <Badge :variant="repo.visibility === 'private' ? 'secondary' : 'outline'">
              {{ repo.visibility === 'private' ? '私有' : '公开' }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-2 text-sm">
            <div class="flex items-center text-muted-foreground">
              <GitBranch class="mr-2 h-4 w-4" />
              <span>{{ repo.defaultBranch }}</span>
            </div>
            <div class="flex items-center text-muted-foreground">
              <Clock class="mr-2 h-4 w-4" />
              <span>{{ formatDate(repo.createdAt) }}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="flex justify-between">
          <Button variant="outline" size="sm" @click="viewRepository(repo)">
            查看详情
          </Button>
          <Button variant="ghost" size="sm" @click="disconnectRepository(repo)">
            断开连接
          </Button>
        </CardFooter>
      </Card>
    </div>

    <!-- 空状态 -->
    <Card v-else class="flex flex-col items-center justify-center py-12">
      <CardContent class="text-center space-y-4">
        <div class="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <GitBranch class="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h3 class="text-lg font-semibold">还没有连接仓库</h3>
          <p class="text-sm text-muted-foreground mt-1">
            连接您的 GitHub 或 GitLab 仓库开始使用
          </p>
        </div>
        <Button @click="showConnectDialog = true">
          <Plus class="mr-2 h-4 w-4" />
          连接第一个仓库
        </Button>
      </CardContent>
    </Card>

    <!-- 连接仓库对话框 -->
    <Dialog v-model:open="showConnectDialog">
      <DialogContent class="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>连接代码仓库</DialogTitle>
          <DialogDescription>
            选择要连接的 Git 平台并授权访问您的仓库
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- 选择项目 -->
          <div class="space-y-2">
            <Label>选择项目</Label>
            <Select v-model="selectedProjectId">
              <SelectTrigger>
                <SelectValue placeholder="选择一个项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem 
                  v-for="project in projects" 
                  :key="project.id" 
                  :value="project.id"
                >
                  {{ project.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 选择平台 -->
          <div class="space-y-2">
            <Label>选择平台</Label>
            <div class="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                :class="{ 'border-primary': selectedProvider === 'github' }"
                @click="selectProvider('github')"
              >
                <Github class="mr-2 h-4 w-4" />
                GitHub
              </Button>
              <Button
                variant="outline"
                :class="{ 'border-primary': selectedProvider === 'gitlab' }"
                @click="selectProvider('gitlab')"
              >
                <Gitlab class="mr-2 h-4 w-4" />
                GitLab
              </Button>
            </div>
          </div>

          <!-- 仓库列表 -->
          <div v-if="selectedProvider && userRepositories.length > 0" class="space-y-2">
            <Label>选择仓库</Label>
            <div class="max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2">
              <div
                v-for="repo in userRepositories"
                :key="repo.id"
                class="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                :class="{ 'bg-muted': selectedRepository?.id === repo.id }"
                @click="selectedRepository = repo"
              >
                <div class="flex items-center space-x-3">
                  <component :is="selectedProvider === 'github' ? Github : Gitlab" class="h-4 w-4" />
                  <div>
                    <p class="font-medium text-sm">{{ repo.fullName }}</p>
                    <p class="text-xs text-muted-foreground">{{ repo.url }}</p>
                  </div>
                </div>
                <Badge variant="outline" size="sm">
                  {{ repo.private ? '私有' : '公开' }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="isLoadingRepos" class="flex items-center justify-center py-8">
            <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
            <span class="ml-2 text-sm text-muted-foreground">加载仓库列表...</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showConnectDialog = false">
            取消
          </Button>
          <Button 
            @click="connectRepository" 
            :disabled="!selectedProjectId || !selectedRepository || isConnecting"
          >
            <Loader2 v-if="isConnecting" class="mr-2 h-4 w-4 animate-spin" />
            连接仓库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'
import { 
  Button, 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge
} from '@juanie/ui'
import { 
  Plus, 
  Github, 
  Gitlab, 
  GitBranch, 
  Clock,
  Loader2
} from 'lucide-vue-next'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const toast = useToast()

// 状态
const repositories = ref<any[]>([])
const projects = ref<any[]>([])
const userRepositories = ref<any[]>([])
const showConnectDialog = ref(false)
const selectedProjectId = ref('')
const selectedProvider = ref<'github' | 'gitlab' | null>(null)
const selectedRepository = ref<any>(null)
const isLoadingRepos = ref(false)
const isConnecting = ref(false)

// 格式化日期
const formatDate = (date: string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN })
}

// 加载数据
onMounted(async () => {
  await loadProjects()
})

// 加载项目列表
const loadProjects = async () => {
  try {
    // TODO: 获取用户的组织列表，然后获取项目
    // 这里简化处理，假设有一个默认组织
    projects.value = []
  } catch (error) {
    console.error('加载项目失败:', error)
    toast.error('加载失败', '无法加载项目列表')
  }
}

// 选择平台
const selectProvider = async (provider: 'github' | 'gitlab') => {
  selectedProvider.value = provider
  selectedRepository.value = null
  await loadUserRepositories()
}

// 加载用户仓库列表
const loadUserRepositories = async () => {
  if (!selectedProvider.value) return

  isLoadingRepos.value = true
  try {
    const result = await trpc.repositories.listUserRepositories.query({
      provider: selectedProvider.value,
      accessToken: '__USE_OAUTH__' // 特殊标记，后端会自动获取 OAuth token
    })

    userRepositories.value = result
  } catch (error: any) {
    console.error('加载仓库列表失败:', error)
    
    if (error.message?.includes('未找到') || error.message?.includes('OAuth')) {
      toast.error('未连接账户', `请先在设置中连接您的 ${selectedProvider.value === 'github' ? 'GitHub' : 'GitLab'} 账户`)
    } else {
      toast.error('加载失败', '无法加载仓库列表')
    }
    
    userRepositories.value = []
  } finally {
    isLoadingRepos.value = false
  }
}

// 连接仓库
const connectRepository = async () => {
  if (!selectedProjectId.value || !selectedRepository.value) return

  isConnecting.value = true
  try {
    await trpc.repositories.connect.mutate({
      projectId: selectedProjectId.value,
      provider: selectedProvider.value!,
      fullName: selectedRepository.value.fullName,
      cloneUrl: selectedRepository.value.url,
      defaultBranch: 'main'
    })

    toast.success('连接成功', '仓库已成功连接到项目')
    showConnectDialog.value = false
    
    // 重新加载仓库列表
    await loadRepositories()
  } catch (error: any) {
    console.error('连接仓库失败:', error)
    toast.error('连接失败', error.message || '无法连接仓库')
  } finally {
    isConnecting.value = false
  }
}

// 加载已连接的仓库
const loadRepositories = async () => {
  if (!selectedProjectId.value) return

  try {
    repositories.value = await trpc.repositories.list.query({
      projectId: selectedProjectId.value
    })
  } catch (error) {
    log.error('加载仓库失败:', error)
  }
}

// 查看仓库详情
const viewRepository = (repo: any) => {
  // TODO: 导航到仓库详情页
  log.info('查看仓库:', repo)
}

// 断开仓库连接
const disconnectRepository = async (repo: any) => {
  if (!confirm(`确定要断开与 ${repo.fullName} 的连接吗？`)) return

  try {
    await trpc.repositories.disconnect.mutate({
      repositoryId: repo.id
    })

    toast.success('断开成功', '仓库连接已断开')
    await loadRepositories()
  } catch (error: any) {
    log.error('断开连接失败:', error)
    toast.error('操作失败', error.message || '无法断开连接')
  }
}

// 监听项目选择变化
watch(selectedProjectId, () => {
  if (selectedProjectId.value) {
    loadRepositories()
  }
})
</script>
