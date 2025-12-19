<template>
  <Card
    class="group cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300, delay: index * 50 } }"
    @click="$emit('click')"
  >
    <CardHeader>
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-3">
          <div
            class="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl"
          >
            {{ getInitials(project.name) }}
          </div>
          <div>
            <CardTitle class="text-lg">{{ project.name }}</CardTitle>
            <CardDescription>@{{ project.slug }}</CardDescription>
          </div>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <p class="text-sm text-muted-foreground line-clamp-2 mb-4">
        {{ project.description || '暂无描述' }}
      </p>

      <!-- 项目配置标签 -->
      <div class="flex flex-wrap gap-2 mb-4">
        <Badge v-if="project.config?.enableCiCd" variant="secondary" class="text-xs">
          <GitBranch class="h-3 w-3 mr-1" />
          CI/CD
        </Badge>
        <Badge v-if="project.config?.enableAi" variant="secondary" class="text-xs">
          <Bot class="h-3 w-3 mr-1" />
          AI
        </Badge>
        <Badge v-if="project.config?.defaultBranch" variant="outline" class="text-xs">
          {{ project.config.defaultBranch }}
        </Badge>
      </div>

      <!-- 项目统计 -->
      <div class="grid grid-cols-3 gap-4 text-center text-sm">
        <div>
          <div class="text-muted-foreground">环境</div>
          <div class="font-semibold">{{ environmentCount }}</div>
        </div>
        <div>
          <div class="text-muted-foreground">部署</div>
          <div class="font-semibold">{{ deploymentCount }}</div>
        </div>
        <div>
          <div class="text-muted-foreground">成员</div>
          <div class="font-semibold">{{ memberCount }}</div>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <span class="text-xs text-muted-foreground">
          更新于 {{ formatDate(project.updatedAt) }}
        </span>
        <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" @click.stop="$emit('edit', project)">
            <Edit class="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" @click.stop="$emit('delete', project)">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@juanie/ui'
import { GitBranch, Bot, Edit, Trash2 } from 'lucide-vue-next'
import { format } from 'date-fns'

interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  config: {
    defaultBranch?: string
    enableCiCd?: boolean
    enableAi?: boolean
  } | null
  updatedAt: string
}

interface Props {
  project: Project
  index?: number
  environmentCount?: number
  deploymentCount?: number
  memberCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  environmentCount: 0,
  deploymentCount: 0,
  memberCount: 0,
})

const emit = defineEmits<{
  click: []
  edit: [project: Project]
  delete: [project: Project]
}>()

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'yyyy-MM-dd')
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
