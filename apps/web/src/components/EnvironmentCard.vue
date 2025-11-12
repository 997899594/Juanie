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
          <span class="text-muted-foreground">URL</span>
          <a
            v-if="environment.url"
            :href="environment.url"
            target="_blank"
            class="text-primary hover:underline flex items-center"
          >
            {{ truncateUrl(environment.url) }}
            <ExternalLink class="ml-1 h-3 w-3" />
          </a>
          <span v-else class="text-muted-foreground">-</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">创建时间</span>
          <span>{{ formatDate(environment.createdAt) }}</span>
        </div>
        <div v-if="environment.config?.gitops?.enabled" class="pt-2 border-t">
          <div class="flex items-center justify-between text-sm mb-2">
            <span class="text-muted-foreground flex items-center gap-1">
              <GitBranch class="h-3 w-3" />
              GitOps
            </span>
            <Badge variant="default" class="text-xs">
              已启用
            </Badge>
          </div>
          <div class="space-y-1 text-xs text-muted-foreground">
            <div class="flex items-center justify-between">
              <span>分支:</span>
              <code class="font-mono">{{ environment.config.gitops.gitBranch }}</code>
            </div>
            <div class="flex items-center justify-between">
              <span>路径:</span>
              <code class="font-mono">{{ environment.config.gitops.gitPath }}</code>
            </div>
            <div class="flex items-center justify-between">
              <span>同步:</span>
              <span>{{ environment.config.gitops.autoSync ? '自动' : '手动' }} ({{ environment.config.gitops.syncInterval }})</span>
            </div>
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

interface Environment {
  id: string
  name: string
  description?: string
  type: string
  status: string
  url?: string
  createdAt: string
  config?: {
    gitops?: {
      enabled: boolean
      gitBranch: string
      gitPath: string
      syncInterval: string
      autoSync: boolean
    }
  }
}

defineProps<{
  environment: Environment
}>()

defineEmits<{
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
