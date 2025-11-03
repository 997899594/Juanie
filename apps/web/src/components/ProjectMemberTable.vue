<template>
  <div class="space-y-4">
    <!-- 表格头部 -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">成员列表</h3>
        <p class="text-sm text-muted-foreground">管理项目成员和权限</p>
      </div>
      <Button @click="$emit('add')" size="sm">
        <UserPlus class="mr-2 h-4 w-4" />
        添加成员
      </Button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center h-32">
      <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!-- 空状态 -->
    <Card v-else-if="members.length === 0">
      <CardContent class="flex flex-col items-center justify-center h-32 text-center">
        <Users class="h-12 w-12 text-muted-foreground mb-2" />
        <p class="text-muted-foreground">还没有成员</p>
      </CardContent>
    </Card>

    <!-- 成员表格 -->
    <Card v-else>
      <CardContent class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="border-b bg-muted/50">
              <tr>
                <th class="px-4 py-3 text-left text-sm font-medium">成员</th>
                <th class="px-4 py-3 text-left text-sm font-medium">角色</th>
                <th class="px-4 py-3 text-left text-sm font-medium">加入时间</th>
                <th class="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="member in members"
                :key="member.id"
                class="hover:bg-muted/50 transition-colors"
              >
                <!-- 成员信息 -->
                <td class="px-4 py-3">
                  <div class="flex items-center space-x-3">
                    <div
                      class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold"
                    >
                      {{ getInitials(member.user.displayName || member.user.username || member.user.email) }}
                    </div>
                    <div>
                      <div class="font-medium">
                        {{ member.user.displayName || member.user.username || '未命名' }}
                      </div>
                      <div class="text-sm text-muted-foreground">
                        {{ member.user.email }}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- 角色 -->
                <td class="px-4 py-3">
                  <Select
                    v-if="canEditRole(member)"
                    :model-value="member.role"
                    @update:model-value="(value) => value && $emit('update-role', member.id, value as string)"
                  >
                    <SelectTrigger class="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理员</SelectItem>
                      <SelectItem value="developer">开发者</SelectItem>
                      <SelectItem value="viewer">查看者</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge v-else :variant="getRoleBadgeVariant(member.role)">
                    {{ getRoleLabel(member.role) }}
                  </Badge>
                </td>

                <!-- 加入时间 -->
                <td class="px-4 py-3 text-sm text-muted-foreground">
                  {{ formatDate(member.joinedAt) }}
                </td>

                <!-- 操作 -->
                <td class="px-4 py-3 text-right">
                  <Button
                    v-if="canRemove(member)"
                    size="sm"
                    variant="ghost"
                    @click="$emit('remove', member.id)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import {
  Button,
  Card,
  CardContent,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@juanie/ui'
import { UserPlus, Users, Loader2, Trash2 } from 'lucide-vue-next'
import { format } from 'date-fns'

interface Member {
  id: string
  role: string
  joinedAt: string
  user: {
    id: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
    email: string
  }
}

interface Props {
  members: Member[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{
  add: []
  'update-role': [memberId: string, role: string]
  remove: [memberId: string]
}>()

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: '管理员',
    developer: '开发者',
    viewer: '查看者',
  }
  return labels[role] || role
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'admin') return 'default'
  if (role === 'developer') return 'secondary'
  return 'outline'
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm')
}

function canEditRole(member: Member): boolean {
  // 简化版本：允许编辑所有成员角色
  return true
}

function canRemove(member: Member): boolean {
  // 简化版本：允许移除所有成员
  return true
}
</script>
