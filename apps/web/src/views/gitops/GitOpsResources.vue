<template>
  <PageContainer title="GitOps 资源" description="管理项目的 GitOps 资源和同步状态">
    <template #actions>
      <div class="flex gap-3">
        <Select v-model="selectedProject">
          <SelectTrigger class="w-48">
            <SelectValue placeholder="选择项目" />
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
        <Button @click="loadResources" :disabled="loading">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          刷新
        </Button>
      </div>
    </template>

    <!-- 错误状态 -->
    <ErrorState
      v-if="error && !loading"
      title="加载失败"
      :message="error"
      @retry="loadResources"
    />

    <!-- 加载状态 -->
    <LoadingState v-else-if="loading" message="加载 GitOps 资源中..." />

    <!-- 空状态 -->
    <EmptyState
      v-else-if="resources.length === 0 && !error"
      :icon="GitBranch"
      title="暂无 GitOps 资源"
      description="创建第一个 GitOps 资源以开始自动化部署"
    />

    <!-- 资源列表 -->
    <div v-else class="space-y-4">
      <!-- 统计卡片 -->
      <div class="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              总资源数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ resources.length }}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              运行正常
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-green-600">
              {{ readyCount }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              同步中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-blue-600">
              {{ reconcilingCount }}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium text-muted-foreground">
              失败
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-red-600">
              {{ failedCount }}
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 资源列表卡片 -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>资源列表</CardTitle>
              <CardDescription>
                显示所有 GitOps 资源的状态和同步信息
              </CardDescription>
            </div>
            <div v-if="selectedResources.size > 0" class="flex gap-2">
              <Badge variant="secondary">已选择 {{ selectedResources.size }} 项</Badge>
              <Button size="sm" @click="batchSync" :disabled="syncingResources.size > 0">
                <RefreshCw class="mr-2 h-4 w-4" />
                批量同步
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            <!-- 全选 -->
            <div v-if="resources.length > 0" class="flex items-center gap-2 pb-2 border-b">
              <input
                type="checkbox"
                v-model="selectAll"
                @change="toggleSelectAll"
                class="h-4 w-4 rounded border-gray-300"
              />
              <span class="text-sm text-muted-foreground">全选</span>
            </div>

            <div
              v-for="resource in resources"
              :key="resource.id"
              class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <!-- 复选框 -->
              <input
                type="checkbox"
                :checked="selectedResources.has(resource.id)"
                @change="toggleSelect(resource.id)"
                class="h-4 w-4 rounded border-gray-300 mr-4"
              />
              
              <!-- 左侧：资源信息 -->
              <div class="flex items-center space-x-4 flex-1">
                <!-- 状态指示器 -->
                <div
                  :class="[
                    'h-3 w-3 rounded-full',
                    getStatusColor(resource.status)
                  ]"
                />
                
                <!-- 资源详情 -->
                <div class="flex-1">
                  <div class="flex items-center space-x-2">
                    <h3 class="font-semibold">{{ resource.name }}</h3>
                    <Badge variant="outline" class="text-xs">
                      {{ resource.type }}
                    </Badge>
                    <Badge :variant="getStatusVariant(resource.status)">
                      {{ getStatusText(resource.status) }}
                    </Badge>
                  </div>
                  <div class="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                    <span class="flex items-center">
                      <FolderGit2 class="mr-1 h-3 w-3" />
                      {{ resource.namespace }}
                    </span>
                    <span v-if="resource.lastSyncTime" class="flex items-center">
                      <Clock class="mr-1 h-3 w-3" />
                      {{ formatRelativeTime(resource.lastSyncTime) }}
                    </span>
                    <span v-if="resource.lastAppliedRevision" class="flex items-center">
                      <GitCommit class="mr-1 h-3 w-3" />
                      {{ resource.lastAppliedRevision.substring(0, 7) }}
                    </span>
                  </div>
                  <!-- 错误信息 -->
                  <div
                    v-if="resource.errorMessage"
                    class="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded"
                  >
                    {{ resource.errorMessage }}
                  </div>
                </div>
              </div>

              <!-- 右侧：操作按钮 -->
              <div class="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  @click="handleSyncResource(resource)"
                  :disabled="syncingResources.has(resource.id)"
                >
                  <RefreshCw
                    class="h-4 w-4"
                    :class="{ 'animate-spin': syncingResources.has(resource.id) }"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="handleViewDetails(resource)"
                >
                  <ChevronRight class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 资源详情对话框 -->
    <Dialog v-model:open="showDetailsDialog">
      <DialogContent class="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>资源详情</DialogTitle>
          <DialogDescription v-if="selectedResource">
            {{ selectedResource.name }} ({{ selectedResource.type }})
          </DialogDescription>
        </DialogHeader>
        
        <div v-if="selectedResource" class="space-y-4">
          <!-- 基本信息 -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <Label class="text-sm font-medium">名称</Label>
              <p class="text-sm text-muted-foreground">{{ selectedResource.name }}</p>
            </div>
            <div>
              <Label class="text-sm font-medium">类型</Label>
              <Badge variant="outline">{{ selectedResource.type }}</Badge>
            </div>
            <div>
              <Label class="text-sm font-medium">命名空间</Label>
              <p class="text-sm text-muted-foreground">{{ selectedResource.namespace }}</p>
            </div>
            <div>
              <Label class="text-sm font-medium">状态</Label>
              <Badge :variant="getStatusVariant(selectedResource.status)">
                {{ getStatusText(selectedResource.status) }}
              </Badge>
            </div>
          </div>

          <Separator />

          <!-- 同步信息 -->
          <div>
            <Label class="text-sm font-medium mb-2 block">同步信息</Label>
            <div class="space-y-2 text-sm">
              <div v-if="selectedResource.lastSyncTime" class="flex justify-between">
                <span class="text-muted-foreground">最后同步时间:</span>
                <span>{{ formatRelativeTime(selectedResource.lastSyncTime) }}</span>
              </div>
              <div v-if="selectedResource.lastAppliedRevision" class="flex justify-between">
                <span class="text-muted-foreground">应用版本:</span>
                <code class="text-xs bg-muted px-2 py-1 rounded">
                  {{ selectedResource.lastAppliedRevision }}
                </code>
              </div>
            </div>
          </div>

          <Separator />

          <!-- 配置信息 -->
          <div>
            <Label class="text-sm font-medium mb-2 block">配置</Label>
            <pre class="text-xs bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selectedResource.config || {}, null, 2) }}</pre>
          </div>

          <!-- 错误信息 -->
          <div v-if="selectedResource.errorMessage" class="bg-red-50 dark:bg-red-950 p-3 rounded">
            <Label class="text-sm font-medium text-red-600 mb-2 block">错误信息</Label>
            <p class="text-sm text-red-600">{{ selectedResource.errorMessage }}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showDetailsDialog = false">关闭</Button>
          <Button @click="selectedResource && handleSyncResource(selectedResource)">
            <RefreshCw class="mr-2 h-4 w-4" />
            手动同步
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useGitOps } from '@/composables/useGitOps'
import { useProjects } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'
import PageContainer from '@/components/PageContainer.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
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
  Separator,
} from '@juanie/ui'
import {
  ChevronRight,
  Clock,
  FolderGit2,
  GitBranch,
  GitCommit,
  RefreshCw,
} from 'lucide-vue-next'

const appStore = useAppStore()
const { projects, fetchProjects } = useProjects()
const { loading, resources, listGitOpsResources, triggerSync } = useGitOps()

// 状态
const error = ref<string | null>(null)
const selectedProject = ref<string>('')
const syncingResources = ref(new Set<string>())

// 批量操作
const selectedResources = ref(new Set<string>())
const selectAll = ref(false)

// 资源详情
const showDetailsDialog = ref(false)
const selectedResource = ref<any>(null)

// 计算属性
const readyCount = computed(() => 
  resources.value.filter(r => r.status === 'ready').length
)

const reconcilingCount = computed(() => 
  resources.value.filter(r => r.status === 'reconciling').length
)

const failedCount = computed(() => 
  resources.value.filter(r => r.status === 'failed').length
)

// 加载资源列表
async function loadResources() {
  if (!selectedProject.value) {
    resources.value = []
    return
  }

  error.value = null
  try {
    await listGitOpsResources(selectedProject.value)
  } catch (err: any) {
    error.value = err.message || '加载 GitOps 资源失败'
    log.error('Failed to load GitOps resources:', err)
  }
}

// 手动同步资源
async function handleSyncResource(resource: any) {
  syncingResources.value.add(resource.id)
  try {
    await triggerSync({
      kind: resource.type === 'kustomization' ? 'Kustomization' : 'HelmRelease',
      name: resource.name,
      namespace: resource.namespace,
    })
    // 等待一会儿后刷新状态
    setTimeout(() => {
      loadResources()
    }, 2000)
  } catch (err: any) {
    log.error('Failed to sync resource:', err)
  } finally {
    syncingResources.value.delete(resource.id)
  }
}

// 查看资源详情
function handleViewDetails(resource: any) {
  selectedResource.value = resource
  showDetailsDialog.value = true
}

// 切换全选
function toggleSelectAll() {
  if (selectAll.value) {
    resources.value.forEach(r => selectedResources.value.add(r.id))
  } else {
    selectedResources.value.clear()
  }
}

// 切换单个选择
function toggleSelect(resourceId: string) {
  if (selectedResources.value.has(resourceId)) {
    selectedResources.value.delete(resourceId)
  } else {
    selectedResources.value.add(resourceId)
  }
  selectAll.value = selectedResources.value.size === resources.value.length
}

// 批量同步
async function batchSync() {
  const promises = Array.from(selectedResources.value).map(async (resourceId) => {
    const resource = resources.value.find(r => r.id === resourceId)
    if (resource) {
      await handleSyncResource(resource)
    }
  })
  
  await Promise.all(promises)
  selectedResources.value.clear()
  selectAll.value = false
}

// 获取状态颜色
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ready: 'bg-green-500',
    reconciling: 'bg-blue-500',
    failed: 'bg-red-500',
    pending: 'bg-yellow-500',
  }
  return colors[status] || 'bg-gray-500'
}

// 获取状态变体
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, any> = {
    ready: 'default',
    reconciling: 'secondary',
    failed: 'destructive',
    pending: 'outline',
  }
  return variants[status] || 'outline'
}

// 获取状态文本
function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    ready: '就绪',
    reconciling: '同步中',
    failed: '失败',
    pending: '等待中',
  }
  return texts[status] || status
}

// 格式化相对时间
function formatRelativeTime(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`
  
  return past.toLocaleDateString('zh-CN')
}

// 监听项目变化
watch(selectedProject, () => {
  loadResources()
})

// 初始化
onMounted(async () => {
  // 获取当前组织的项目列表
  if (appStore.currentOrganizationId) {
    await fetchProjects(appStore.currentOrganizationId)
    
    // 从 URL 参数获取项目 ID
    const urlParams = new URLSearchParams(window.location.search)
    const projectIdFromUrl = urlParams.get('project')
    
    if (projectIdFromUrl && projects.value.some(p => p.id === projectIdFromUrl)) {
      selectedProject.value = projectIdFromUrl
    } else {
      // 选择第一个项目
      const firstProject = projects.value[0]
      if (firstProject) {
        selectedProject.value = firstProject.id
      }
    }
  }
})
</script>
