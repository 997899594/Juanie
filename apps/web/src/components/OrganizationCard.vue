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
            class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl"
          >
            {{ getInitials(organization.name) }}
          </div>
          <div>
            <CardTitle class="text-lg">{{ organization.displayName || organization.name }}</CardTitle>
            <CardDescription>@{{ organization.slug }}</CardDescription>
          </div>
        </div>
        <Badge :variant="getRoleBadgeVariant(organization.role)">
          {{ getRoleLabel(organization.role) }}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="flex items-center space-x-2 text-muted-foreground">
          <Users class="h-4 w-4" />
          <span>{{ memberCount }} 成员</span>
        </div>
        <div class="flex items-center space-x-2 text-muted-foreground">
          <FolderOpen class="h-4 w-4" />
          <span>{{ projectCount }} 项目</span>
        </div>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <span class="text-xs text-muted-foreground">
          创建于 {{ formatDate(organization.createdAt) }}
        </span>
        <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            @click.stop="$emit('edit', organization)"
          >
            <Edit class="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            @click.stop="$emit('delete', organization)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@juanie/ui'
import { Users, FolderOpen, Edit, Trash2 } from 'lucide-vue-next'
import { format } from 'date-fns'

interface Organization {
  id: string
  name: string
  slug: string
  displayName: string | null
  role: string
  createdAt: string
  quotas?: any
}

interface Props {
  organization: Organization
  index?: number
  memberCount?: number
  projectCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  memberCount: 0,
  projectCount: 0,
})

defineEmits<{
  click: []
  edit: [organization: Organization]
  delete: [organization: Organization]
}>()

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: '所有者',
    admin: '管理员',
    member: '成员',
  }
  return labels[role] || role
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'owner') return 'default'
  if (role === 'admin') return 'secondary'
  return 'outline'
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'yyyy-MM-dd')
}
</script>
