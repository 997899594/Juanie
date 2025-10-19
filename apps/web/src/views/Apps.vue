<template>
  <div class="space-y-6">
    <!-- 页面标题和操作 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">我的应用</h1>
        <p class="text-muted-foreground">管理和部署您的应用程序</p>
      </div>
      <Button @click="showCreateDialog = true" class="flex items-center space-x-2">
        <Plus class="h-4 w-4" />
        <span>创建应用</span>
      </Button>
    </div>

    <!-- 应用列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card v-for="app in apps" :key="app.id" class="hover:shadow-md transition-shadow">
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GitBranch class="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 class="font-semibold text-foreground">{{ app.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ app.repository }}</p>
              </div>
            </div>
            <Badge :variant="app.status === 'running' ? 'default' : app.status === 'stopped' ? 'secondary' : 'destructive'">
              {{ getStatusText(app.status) }}
            </Badge>
          </div>
          
          <p class="text-sm text-muted-foreground mb-4">{{ app.description }}</p>
          
          <div class="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <span>最后部署: {{ formatDate(app.lastDeploy) }}</span>
            <span>{{ app.branch }}</span>
          </div>
          
          <div class="flex space-x-2">
            <Button variant="outline" size="sm" class="flex-1">
              <ExternalLink class="h-3 w-3 mr-1" />
              访问
            </Button>
            <Button variant="outline" size="sm" class="flex-1">
              <Settings class="h-3 w-3 mr-1" />
              设置
            </Button>
          </div>
        </div>
      </Card>
      
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
import { ref, onMounted } from 'vue'
import {
  Button,
  Card,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label
} from '@juanie/ui'
import {
  Plus,
  GitBranch,
  ExternalLink,
  Settings
} from 'lucide-vue-next'

// 应用数据
const apps = ref([
  {
    id: 1,
    name: 'Web Dashboard',
    repository: 'gitlab.com/company/web-dashboard',
    description: '管理后台前端应用',
    status: 'running',
    lastDeploy: new Date('2024-01-15'),
    branch: 'main'
  },
  {
    id: 2,
    name: 'API Service',
    repository: 'gitlab.com/company/api-service',
    description: '核心 API 服务',
    status: 'stopped',
    lastDeploy: new Date('2024-01-14'),
    branch: 'develop'
  }
])

// 创建应用对话框
const showCreateDialog = ref(false)
const selectedRepository = ref('')
const newAppName = ref('')
const newAppDescription = ref('')

// GitLab 仓库列表
const gitlabRepositories = ref([
  { id: 1, name: 'web-frontend', fullName: 'company/web-frontend' },
  { id: 2, name: 'mobile-app', fullName: 'company/mobile-app' },
  { id: 3, name: 'data-service', fullName: 'company/data-service' },
  { id: 4, name: 'notification-service', fullName: 'company/notification-service' }
])

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
    day: 'numeric'
  })
}

// 创建应用
const createApp = () => {
  if (!selectedRepository.value || !newAppName.value) return
  
  const selectedRepo = gitlabRepositories.value.find(repo => repo.id.toString() === selectedRepository.value)
  if (!selectedRepo) return
  
  const newApp = {
    id: Date.now(),
    name: newAppName.value,
    repository: `gitlab.com/${selectedRepo.fullName}`,
    description: newAppDescription.value || '新创建的应用',
    status: 'stopped',
    lastDeploy: new Date(),
    branch: 'main'
  }
  
  apps.value.push(newApp)
  
  // 重置表单
  showCreateDialog.value = false
  selectedRepository.value = ''
  newAppName.value = ''
  newAppDescription.value = ''
}

// 组件挂载时加载数据
onMounted(() => {
  // 这里可以添加从 API 加载数据的逻辑
  console.log('应用列表页面已加载')
})
</script>