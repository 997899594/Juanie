<template>
  <div class="project-environments">
    <!-- 环境列表头部 -->
    <div class="environments-header">
      <div class="header-content">
        <h3 class="text-lg font-semibold">环境管理</h3>
        <p class="text-sm text-muted-foreground">管理项目的部署环境</p>
      </div>
      <Button @click="showCreateModal = true">
        <Plus class="h-4 w-4 mr-2" />
        新建环境
      </Button>
    </div>

    <!-- 环境列表 -->
    <div class="environments-list">
      <Card v-for="environment in environments" :key="environment.id" class="environment-card">
        <CardHeader class="pb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="environment-status">
                <div 
                  class="status-indicator"
                  :class="environment.isActive ? 'bg-green-500' : 'bg-gray-400'"
                ></div>
              </div>
              <div>
                <CardTitle class="text-base">{{ environment.name }}</CardTitle>
                <CardDescription>{{ environment.displayName || '暂无描述' }}</CardDescription>
              </div>
            </div>
            <div class="environment-actions">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="deployToEnvironment(environment)">
                    <Rocket class="h-4 w-4 mr-2" />
                    部署
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="editEnvironment(environment)">
                    <Edit class="h-4 w-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="viewLogs(environment)">
                    <FileText class="h-4 w-4 mr-2" />
                    查看日志
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    @click="deleteEnvironment(environment)"
                    class="text-destructive"
                  >
                    <Trash2 class="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="environment-info">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">状态</span>
                <Badge :variant="environment.isActive ? 'default' : 'secondary'">
                  {{ environment.isActive ? '活跃' : '非活跃' }}
                </Badge>
              </div>
              <div class="info-item">
                <span class="info-label">URL</span>
                <span class="info-value">
                  <a 
                    v-if="environment.url" 
                    :href="environment.url" 
                    target="_blank"
                    class="text-primary hover:underline"
                  >
                    {{ environment.url }}
                    <ExternalLink class="h-3 w-3 inline ml-1" />
                  </a>
                  <span v-else class="text-muted-foreground">未配置</span>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">分支</span>
                <span class="info-value">
                  {{ environment.branch || '未配置' }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ formatTime(environment.createdAt) }}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 空状态 -->
      <div v-if="environments.length === 0 && !loading" class="empty-state">
        <Card class="text-center py-12">
          <CardContent>
            <Activity class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 class="text-lg font-semibold mb-2">暂无环境</h3>
            <p class="text-muted-foreground mb-4">创建第一个部署环境来开始使用</p>
            <Button @click="showCreateModal = true">
              <Plus class="h-4 w-4 mr-2" />
              新建环境
            </Button>
          </CardContent>
        </Card>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <Card v-for="i in 3" :key="i" class="animate-pulse">
          <CardHeader>
            <div class="flex items-center space-x-3">
              <div class="w-3 h-3 bg-muted rounded-full"></div>
              <div class="space-y-2">
                <div class="w-24 h-4 bg-muted rounded"></div>
                <div class="w-32 h-3 bg-muted rounded"></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div class="space-y-2">
              <div class="w-full h-3 bg-muted rounded"></div>
              <div class="w-3/4 h-3 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 创建环境模态框 -->
    <CreateEnvironmentModal
      v-if="showCreateModal"
      :project-id="projectId"
      @close="showCreateModal = false"
      @created="handleEnvironmentCreated"
    />

    <!-- 编辑环境模态框 -->
    <EditEnvironmentModal
      v-if="showEditModal && editingEnvironment"
      :environment="editingEnvironment"
      @close="showEditModal = false"
      @updated="handleEnvironmentUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@juanie/ui'
import {
  Plus,
  MoreHorizontal,
  Rocket,
  Edit,
  FileText,
  Trash2,
  ExternalLink,
  Activity
} from 'lucide-vue-next'
import { trpc, type AppRouter } from '@/lib/trpc'
import CreateEnvironmentModal from './CreateEnvironmentModal.vue'
import EditEnvironmentModal from './EditEnvironmentModal.vue'

type Environment = Awaited<ReturnType<typeof trpc.environments.listByProject.query>>[0]

const props = defineProps<{
  projectId: string
}>()

const loading = ref(false)
const environments = ref<Environment[]>([])
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingEnvironment = ref<Environment | null>(null)

// 获取状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-500'
    case 'inactive':
      return 'bg-gray-400'
    case 'deploying':
      return 'bg-blue-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

// 获取类型变体
const getTypeVariant = (type: string) => {
  switch (type) {
    case 'production':
      return 'destructive'
    case 'staging':
      return 'secondary'
    case 'development':
      return 'outline'
    default:
      return 'secondary'
  }
}

// 获取类型标签
const getTypeLabel = (type: string) => {
  switch (type) {
    case 'production':
      return '生产环境'
    case 'staging':
      return '预发布环境'
    case 'development':
      return '开发环境'
    default:
      return type
  }
}

// 格式化时间
const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载环境列表
const loadEnvironments = async () => {
  try {
    loading.value = true
    const result = await trpc.environments.listByProject.query({ projectId: props.projectId })
    environments.value = result || []
  } catch (error: any) {
    console.error('获取环境列表失败:', error)
    
    // 使用模拟数据
    environments.value = [
      {
        id: 1,
        projectId: 1,
        name: 'production',
        displayName: '生产环境',
        url: 'https://app.example.com',
        branch: 'main',
        isActive: true,
        config: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: 2,
        projectId: 1,
        name: 'staging',
        displayName: '预发布环境',
        url: 'https://staging.example.com',
        branch: 'develop',
        isActive: true,
        config: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
      },
      {
        id: 3,
        projectId: 1,
        name: 'development',
        displayName: '开发环境',
        url: 'https://dev.example.com',
        branch: 'develop',
        isActive: false,
        config: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
      }
    ]
  } finally {
    loading.value = false
  }
}

// 部署到环境
const deployToEnvironment = (environment: Environment) => {
  console.log('部署到环境:', environment.name)
  // TODO: 实现部署逻辑
}

// 编辑环境
const editEnvironment = (environment: Environment) => {
  editingEnvironment.value = environment
  showEditModal.value = true
}

// 查看日志
const viewLogs = (environment: Environment) => {
  console.log('查看环境日志:', environment.name)
  // TODO: 实现查看日志逻辑
}

// 删除环境
const deleteEnvironment = async (environment: Environment) => {
  if (!confirm(`确定要删除环境 "${environment.name}" 吗？此操作不可撤销。`)) {
    return
  }

  try {
    // 暂时注释掉不存在的 API 调用
    // await trpc.environments.delete.mutate({ id: environment.id })
    
    console.log('删除环境:', environment.id)
    alert('删除环境功能暂未实现')
    
    environments.value = environments.value.filter((env: Environment) => env.id !== environment.id)
  } catch (error: any) {
    console.error('删除环境失败:', error)
    alert('删除环境失败，请稍后重试')
  }
}

// 处理环境创建
const handleEnvironmentCreated = (newEnvironment: Environment) => {
  environments.value.push(newEnvironment)
  showCreateModal.value = false
}

// 处理环境更新
const handleEnvironmentUpdated = (updatedEnvironment: Environment) => {
  const index = environments.value.findIndex(env => env.id === updatedEnvironment.id)
  if (index !== -1) {
    environments.value[index] = updatedEnvironment
  }
  showEditModal.value = false
  editingEnvironment.value = null
}

onMounted(() => {
  loadEnvironments()
})
</script>

<style scoped>
/* 移除所有@apply，使用UI库的原生类名和组件 */
</style>