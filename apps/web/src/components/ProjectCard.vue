<template>
  <Card 
    class="cursor-pointer hover:shadow-md transition-shadow relative"
    @click="$emit('click')"
  >
    <!-- 项目头部 -->
    <CardHeader class="flex flex-row items-start justify-between space-y-0 pb-2">
      <div class="flex items-start space-x-3 flex-1">
        <Avatar class="flex-shrink-0">
          <AvatarImage v-if="project.avatar" :src="project.avatar" :alt="project.name" />
          <AvatarFallback>
            <Folder class="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-foreground truncate">{{ project.name }}</h3>
          <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ project.description || '暂无描述' }}</p>
        </div>
      </div>
      
      <!-- 项目操作菜单 -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child @click.stop>
          <Button variant="ghost" size="icon-sm" class="flex-shrink-0">
            <MoreVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="$emit('edit', project)">
            <Edit class="h-4 w-4 mr-2" />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('delete', project)" class="text-destructive">
            <Trash2 class="h-4 w-4 mr-2" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- 项目标签 -->
      <div class="flex flex-wrap gap-2">
        <Badge v-if="project.isPublic" variant="secondary" class="text-xs">
          <Globe class="h-3 w-3 mr-1" />
          公开
        </Badge>
        <Badge v-else variant="outline" class="text-xs">
          <Lock class="h-3 w-3 mr-1" />
          私有
        </Badge>
        
        <Badge v-if="project.gitlabProjectId" variant="outline" class="text-xs">
          <GitBranch class="h-3 w-3 mr-1" />
          GitLab
        </Badge>
      </div>

      <!-- 项目统计 -->
      <div class="grid grid-cols-3 gap-4 py-3 border-t border-b">
        <div class="text-center">
          <span class="block text-xs text-muted-foreground mb-1">环境</span>
          <span class="block text-lg font-semibold text-foreground">{{ project.environmentsCount || 0 }}</span>
        </div>
        <div class="text-center">
          <span class="block text-xs text-muted-foreground mb-1">部署</span>
          <span class="block text-lg font-semibold text-foreground">{{ project.deploymentsCount || 0 }}</span>
        </div>
        <div class="text-center">
          <span class="block text-xs text-muted-foreground mb-1">成员</span>
          <span class="block text-lg font-semibold text-foreground">{{ project.membersCount || 1 }}</span>
        </div>
      </div>

      <!-- 最近部署状态 -->
      <div v-if="project.lastDeployment">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="flex items-center mr-2">
              <div 
                :class="[
                  'w-2 h-2 rounded-full mr-2',
                  {
                    'bg-green-500': project.lastDeployment.status === 'success',
                    'bg-red-500': project.lastDeployment.status === 'failed',
                    'bg-blue-500': project.lastDeployment.status === 'running',
                    'bg-yellow-500': project.lastDeployment.status === 'pending'
                  }
                ]"
              />
              <span class="text-sm text-muted-foreground">
                {{ getStatusText(project.lastDeployment.status) }}
              </span>
            </div>
          </div>
          <span class="text-xs text-muted-foreground">
            {{ formatTime(project.lastDeployment.createdAt) }}
          </span>
        </div>
      </div>
    </CardContent>

    <CardFooter class="flex items-center justify-between text-sm text-muted-foreground pt-4">
      <div class="flex items-center">
        <Avatar v-if="project.owner?.avatar" class="w-6 h-6 mr-2">
          <AvatarImage :src="project.owner.avatar" :alt="project.owner.name" />
          <AvatarFallback class="text-xs">{{ project.owner.name?.charAt(0) }}</AvatarFallback>
        </Avatar>
        <div v-else class="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center mr-2 font-medium">
          {{ project.owner?.name?.charAt(0) || 'U' }}
        </div>
        <span class="truncate">{{ project.owner?.name || '未知用户' }}</span>
      </div>
      <span class="text-xs">
        {{ formatTime(project.updatedAt) }}
      </span>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader,
  Badge,
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@juanie/ui'
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Globe, 
  Lock, 
  GitBranch, 
  Folder 
} from 'lucide-vue-next'

interface Project {
  id: number
  name: string
  description?: string
  avatar?: string
  isPublic: boolean
  gitlabProjectId?: number
  environmentsCount?: number
  deploymentsCount?: number
  membersCount?: number
  lastDeployment?: {
    status: 'success' | 'failed' | 'running' | 'pending'
    createdAt: string
  }
  owner?: {
    name: string
    avatar?: string
  }
  updatedAt: string
}

defineProps<{
  project: Project
}>()

defineEmits<{
  click: []
  edit: [project: Project]
  delete: [project: Project]
}>()

// 格式化时间
const formatTime = (dateString: string) => {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: zhCN
  })
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap = {
    success: '部署成功',
    failed: '部署失败',
    running: '部署中',
    pending: '等待部署'
  }
  return statusMap[status] || status
}
</script>

<style scoped>
/* 使用UI库组件，无需自定义样式 */

/* 多行文本截断 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>