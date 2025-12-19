<template>
  <Card class="hover:shadow-md transition-shadow">
    <CardHeader>
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-2">
          <Server class="h-5 w-5 text-muted-foreground" />
          <CardTitle class="text-lg">{{ environment.name }}</CardTitle>
        </div>
        <Badge :variant="getTypeVariant(environment.type)">
          {{ getTypeText(environment.type) }}
        </Badge>
      </div>
      <CardDescription>{{ environment.description || '暂无描述' }}</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">状态</span>
          <Badge :variant="getStatusVariant(environment.status)">
            {{ getStatusText(environment.status) }}
          </Badge>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">健康检查</span>
          <a
            v-if="environment.healthCheckUrl"
            :href="environment.healthCheckUrl"
            target="_blank"
            class="text-primary hover:underline flex items-center"
          >
            {{ truncateUrl(environment.healthCheckUrl) }}
            <ExternalLink class="ml-1 h-3 w-3" />
          </a>
          <span v-else class="text-muted-foreground">-</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">创建时间</span>
          <span>{{ formatDate(environment.createdAt) }}</span>
        </div>
        <div v-if="environment.config?.approvalRequired" class="pt-2 border-t">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">部署审批</span>
            <Badge variant="secondary" class="text-xs">
              需要 {{ environment.config.minApprovals }} 人审批
            </Badge>
          </div>
        </div>
      </div>
    </CardContent>
    <CardFooter class="flex justify-end space-x-2">
      <Button variant="outline" size="sm" @click="$emit('edit', environment)">
        <Edit class="h-3 w-3 mr-1" />
        编辑
      </Button>
      <Button variant="destructive" size="sm" @click="$emit('delete', environment.id)">
        <Trash2 class="h-3 w-3 mr-1" />
        删除
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from '@juanie/ui'
import { Server, ExternalLink, Edit, Trash2, GitBranch } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'

// 从 tRPC 推断类型
type Environment = Awaited<ReturnType<typeof trpc.environments.list.query>>[number]

const props = defineProps<{
  environment: Environment
}>()

const emit = defineEmits<{
  edit: [environment: Environment]
  delete: [id: string]
}>()

const getTypeText = (type: string) => {
  const typeMap: Record<string, string> = {
    development: '开发',
    staging: '测试',
    production: '生产',
  }
  return typeMap[type] || type
}

const getTypeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    development: 'secondary',
    staging: 'default',
    production: 'destructive',
  }
  return variantMap[type] || 'outline'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    active: '活跃',
    inactive: '停用',
    deploying: '部署中',
    error: '错误',
  }
  return statusMap[status] || status
}

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    inactive: 'secondary',
    deploying: 'default',
    error: 'destructive',
  }
  return variantMap[status] || 'outline'
}

const truncateUrl = (url: string) => {
  if (url.length > 30) {
    return url.substring(0, 27) + '...'
  }
  return url
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN')
}
</script>
