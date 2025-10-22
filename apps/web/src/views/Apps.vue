<template>
  <div class="flex flex-col h-full">
    <!-- 页面头部 -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
      <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">我的应用</h1>
        <p class="text-sm text-muted-foreground">
          管理和部署你的应用程序
        </p>
      </div>
      <Button @click="showCreateDialog = true" class="gap-2 shadow-sm self-start lg:self-auto">
        <Plus class="h-4 w-4" />
        创建应用
      </Button>
    </div>

    <!-- 应用统计卡片 -->
    <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-8">
      <Card class="group border-border/40 hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle class="text-sm font-medium text-muted-foreground">总应用数</CardTitle>
          <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <GitBranch class="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <div class="text-2xl font-bold text-foreground">{{ apps.length }}</div>
          <p class="text-xs text-muted-foreground mt-1">
            +2 较上月
          </p>
        </CardContent>
      </Card>
      
      <Card class="group border-border/40 hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle class="text-sm font-medium text-muted-foreground">运行中</CardTitle>
          <div class="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <Activity class="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <div class="text-2xl font-bold text-green-600">{{ runningApps }}</div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ Math.round((runningApps / apps.length) * 100) || 0 }}% 运行率
          </p>
        </CardContent>
      </Card>
      
      <Card class="group border-border/40 hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle class="text-sm font-medium text-muted-foreground">部署次数</CardTitle>
          <div class="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Rocket class="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <div class="text-2xl font-bold text-foreground">127</div>
          <p class="text-xs text-muted-foreground mt-1">
            +12 本周
          </p>
        </CardContent>
      </Card>
      
      <Card class="group border-border/40 hover:border-primary/30 hover:shadow-md transition-all duration-200">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle class="text-sm font-medium text-muted-foreground">成功率</CardTitle>
          <div class="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp class="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <div class="text-2xl font-bold text-emerald-600">98.5%</div>
          <p class="text-xs text-muted-foreground mt-1">
            +0.3% 较上周
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- 应用列表 -->
    <div class="flex-1 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-foreground">应用列表</h2>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Input
            v-model="searchQuery"
            placeholder="搜索应用..."
            class="w-full sm:w-64"
          />
          <Select v-model="statusFilter">
            <SelectTrigger class="w-full sm:w-32">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="stopped">已停止</SelectItem>
              <SelectItem value="error">错误</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- 应用卡片布局 -->
      <div v-if="filteredApps.length > 0" class="flex flex-wrap -mx-2">
        <div 
        v-for="app in filteredApps" 
        :key="app.id"
        class="w-full sm:w-1/2 lg:w-1/3 xl:w-1/4 px-2 mb-4"
      >
        <Card 
        class="h-full group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer border-border/40 hover:border-primary/30 hover:-translate-y-0.5"
        @click="$router.push(`/apps/${app.id}`)"
      >
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10 shrink-0">
                <GitBranch class="h-4 w-4 text-primary" />
              </div>
              <div class="min-w-0 flex-1">
                <CardTitle class="text-base font-semibold truncate text-foreground">{{ app.name }}</CardTitle>
                <CardDescription class="text-sm text-muted-foreground line-clamp-1 mt-2">{{ app.description }}</CardDescription>
              </div>
            </div>
            <Badge :variant="getStatusVariant(app.status)" class="text-xs shrink-0">
              {{ getStatusText(app.status) }}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent class="space-y-2.5 pb-3">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ app.repository }}</span>
          </div>
          
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar class="h-4 w-4 shrink-0" />
            <span>{{ formatDate(app.updatedAt) }}</span>
          </div>
          
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe class="h-4 w-4 shrink-0" />
            <span v-if="app.url" class="truncate">
              <a :href="app.url" target="_blank" class="text-primary hover:underline" @click.stop>
                {{ app.url }}
              </a>
            </span>
            <span v-else>未部署</span>
          </div>
        </CardContent>
        
        <CardFooter class="pt-0 pb-4">
          <div class="flex w-full items-center justify-between">
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0 hover:bg-primary/10" @click.stop="deployApp(app)">
                <Rocket class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0 hover:bg-primary/10" @click.stop="viewLogs(app)">
                <FileText class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0 hover:bg-primary/10" @click.stop="openSettings(app)">
                <Settings class="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" @click.stop="$router.push(`/apps/${app.id}`)">
              <ExternalLink class="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
      </div>
    </div>
      
      <!-- 空状态 -->
      <Card v-if="apps.length === 0" class="col-span-full">
        <div class="p-12 text-center">
          <GitBranch class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 class="text-lg font-semibold text-foreground mb-2">还没有应用</h3>
          <p class="text-muted-foreground mb-4">创建您的第一个应用开始使用 DevOps 平台</p>
          <Button @click="showCreateDialog = true">
            <Plus class="h-4 w-4 mr-2" />
            创建应用
          </Button>
        </div>
      </Card>
    </div>

    <!-- 创建应用对话框 -->
    <Dialog v-model:open="showCreateDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建新应用</DialogTitle>
          <DialogDescription>
            从 GitLab 仓库选择一个项目来创建应用
          </DialogDescription>
        </DialogHeader>
        
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="repository">选择仓库</Label>
            <Select v-model="selectedRepository">
              <SelectTrigger>
                <SelectValue placeholder="选择一个 GitLab 仓库" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="repo in gitlabRepositories" :key="repo.id" :value="repo.id.toString()">
                  <div class="flex items-center space-x-2">
                    <GitBranch class="h-4 w-4" />
                    <span>{{ repo.name }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div class="space-y-2">
            <Label for="appName">应用名称</Label>
            <Input
              id="appName"
              v-model="newAppName"
              placeholder="输入应用名称"
            />
          </div>
          
          <div class="space-y-2">
            <Label for="description">描述 (可选)</Label>
            <Input
              id="description"
              v-model="newAppDescription"
              placeholder="应用描述"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">
            取消
          </Button>
          <Button @click="createApp" :disabled="!selectedRepository || !newAppName">
            创建应用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@juanie/ui'
import {
  Activity,
  AppWindow,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Plus,
  Rocket,
  Settings,
  TrendingUp,
} from 'lucide-vue-next'

// 模拟应用数据
const apps = ref([
  {
    id: '1',
    name: 'Web Dashboard',
    description: 'Juanie 管理后台前端应用',
    repository: 'juanie/web-dashboard',
    status: 'running',
    url: 'https://dashboard.juanie.com',
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'API Service',
    description: 'Juanie 核心 API 服务',
    repository: 'juanie/api-service',
    status: 'running',
    url: 'https://api.juanie.com',
    updatedAt: new Date('2024-01-14'),
  },
  {
    id: '3',
    name: 'User Service',
    description: '用户管理微服务',
    repository: 'juanie/user-service',
    status: 'stopped',
    url: null,
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '4',
    name: 'Payment Service',
    description: '支付处理微服务',
    repository: 'juanie/payment-service',
    status: 'running',
    url: 'https://payment.juanie.com',
    updatedAt: new Date('2024-01-12'),
  },
  {
    id: '5',
    name: 'Notification Service',
    description: '消息通知服务',
    repository: 'juanie/notification-service',
    status: 'running',
    url: null,
    updatedAt: new Date('2024-01-11'),
  },
  {
    id: '6',
    name: 'File Storage',
    description: '文件存储服务',
    repository: 'juanie/file-storage',
    status: 'error',
    url: null,
    updatedAt: new Date('2024-01-09'),
  },
])

const router = useRouter()

// 响应式数据
const searchQuery = ref('')
const statusFilter = ref('all')
const showCreateDialog = ref(false)

// 新应用表单数据
const newAppName = ref('')
const newAppDescription = ref('')
const selectedRepository = ref('')

// 模拟 GitLab 仓库数据
const gitlabRepositories = ref([
  { id: 1, name: 'web-app', path_with_namespace: 'juanie/web-app' },
  { id: 2, name: 'mobile-app', path_with_namespace: 'juanie/mobile-app' },
  { id: 3, name: 'api-gateway', path_with_namespace: 'juanie/api-gateway' },
  { id: 4, name: 'user-service', path_with_namespace: 'juanie/user-service' },
])

// 计算属性
const runningApps = computed(() => {
  return apps.value.filter(app => app.status === 'running').length
})

const filteredApps = computed(() => {
  let filtered = apps.value
  
  // 按搜索关键词过滤
  if (searchQuery.value) {
    filtered = filtered.filter(app => 
      app.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      app.repository.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  
  // 按状态过滤
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(app => app.status === statusFilter.value)
  }
  
  return filtered
})

const canCreateApp = computed(() => {
  return newAppName.value && selectedRepository.value
})

// 获取状态变体
const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
  const variants = {
    running: 'default' as const,
    stopped: 'secondary' as const,
    error: 'destructive' as const,
  }
  return variants[status as keyof typeof variants] || 'secondary'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap = {
    running: '运行中',
    stopped: '已停止',
    error: '错误'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

// 格式化日期
const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const deployApp = (app: any) => {
  console.log('Deploy app:', app.name)
  // TODO: 实现部署逻辑
}

const viewLogs = (app: any) => {
  console.log('View logs for:', app.name)
  router.push(`/apps/${app.id}/logs`)
}

const openSettings = (app: any) => {
  console.log('Open settings for:', app.name)
  router.push(`/apps/${app.id}/settings`)
}

const createApp = () => {
  // TODO: 实现创建应用逻辑
  const app = {
    id: Date.now().toString(),
    name: newAppName.value,
    description: newAppDescription.value,
    repository: selectedRepository.value,
    status: 'stopped',
    url: null,
    updatedAt: new Date(),
  }
  
  apps.value.push(app)
  
  // 重置表单
  newAppName.value = ''
  newAppDescription.value = ''
  selectedRepository.value = ''
  
  showCreateDialog.value = false
  
  // 跳转到新创建的应用
  router.push(`/apps/${app.id}`)
}

// 生命周期
onMounted(() => {
  // TODO: 从 API 加载应用数据和 GitLab 仓库
})
</script>