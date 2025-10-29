<template>
  <Card 
    class="cursor-pointer hover:shadow-md transition-shadow relative"
    @click="$emit('click')"
  >
    <!-- 项目头部 -->
    <CardHeader class="flex flex-row items-start justify-between space-y-0 pb-2">
      <div class="flex items-start space-x-3 flex-1">
        <Avatar class="flex-shrink-0">
          <AvatarImage :src="''" :alt="project.displayName || project.name" />
          <AvatarFallback>{{ (project.displayName || project.name)?.charAt(0) || 'P' }}</AvatarFallback>
        </Avatar>
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-foreground truncate">{{ project.displayName }}</h3>
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
        <Badge v-if="project.visibility === 'public'" variant="secondary" class="text-xs">
          <Globe class="h-3 w-3 mr-1" />
          公开
        </Badge>
        <Badge v-else variant="outline" class="text-xs">
          <Lock class="h-3 w-3 mr-1" />
          私有
        </Badge>
        
        <Badge v-if="project.repositoryUrl" variant="outline" class="text-xs">
          <GitBranch class="h-3 w-3 mr-1" />
          代码仓库
        </Badge>
      </div>

      <!-- 项目统计 -->
      <div class="grid grid-cols-3 gap-4 py-3 border-t border-b">
        <div class="text-center">
          <span class="block text-xs text-muted-foreground mb-1">环境</span>
          <span class="block text-lg font-semibold text-foreground">0</span>
        </div>
        <div class="text-center">
          <span class="block text-xs text-muted-foreground mb-1">部署</span>
          <span class="block text-lg font-semibold text-foreground">0</span>
        </div>
        <div class="text-center">
          <span class="block text-xs text-muted-foreground mb-1">成员</span>
          <span class="block text-lg font-semibold text-foreground">1</span>
        </div>
      </div>

      <!-- 项目信息 -->
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">
            0 次部署
          </Badge>
          <span>•</span>
          <span>{{ formatTime(project.updatedAt) }}</span>
        </div>
    </CardContent>

    <CardFooter class="flex items-center justify-between text-sm text-muted-foreground pt-4">
        <div class="flex items-center">
          <Avatar class="h-6 w-6 mr-2">
            <AvatarImage :src="''" :alt="'项目所有者'" />
            <AvatarFallback class="text-xs">P</AvatarFallback>
          </Avatar>
          <span>项目所有者</span>
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
import { trpc } from '@/lib/trpc'
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

// 使用后端实际实现的 getOrganizationProjects API 的返回类型
type Project = Awaited<ReturnType<typeof trpc.projects.getOrganizationProjects.query>>['projects'][0]

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
const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
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