<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>Git 平台同步</CardTitle>
          <CardDescription>组织与 Git 平台的同步状态</CardDescription>
        </div>
        <Badge v-if="organization.gitSyncEnabled" variant="default">
          <CheckCircle2 class="mr-1 h-3 w-3" />
          已启用
        </Badge>
        <Badge v-else variant="secondary">
          <XCircle class="mr-1 h-3 w-3" />
          未启用
        </Badge>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- 未启用状态 -->
      <div v-if="!organization.gitSyncEnabled" class="text-center py-8">
        <GitBranch class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 class="text-lg font-semibold mb-2">Git 同步未启用</h3>
        <p class="text-sm text-muted-foreground mb-4">
          启用 Git 同步后，组织成员将自动同步到 Git 平台
        </p>
        <Button @click="$emit('enable-sync')">
          <Settings class="mr-2 h-4 w-4" />
          启用同步
        </Button>
      </div>

      <!-- 已启用状态 -->
      <template v-else>
        <!-- Git 平台信息 -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Git 平台</span>
            <div class="flex items-center">
              <component
                :is="organization.gitProvider === 'github' ? Github : Gitlab"
                class="h-4 w-4 mr-2"
              />
              <span class="text-sm">
                {{ organization.gitProvider === 'github' ? 'GitHub' : 'GitLab' }}
              </span>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Git 组织</span>
            <a
              v-if="organization.gitOrgUrl"
              :href="organization.gitOrgUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-primary hover:underline flex items-center"
            >
              {{ organization.gitOrgName }}
              <ExternalLink class="ml-1 h-3 w-3" />
            </a>
            <span v-else class="text-sm">{{ organization.gitOrgName }}</span>
          </div>

          <div v-if="organization.gitLastSyncAt" class="flex items-center justify-between">
            <span class="text-sm font-medium">最后同步</span>
            <span class="text-sm text-muted-foreground">
              {{ formatDate(organization.gitLastSyncAt) }}
            </span>
          </div>
        </div>

        <!-- 同步操作 -->
        <div class="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            @click="$emit('sync-now')"
            :disabled="syncing"
          >
            <Loader2 v-if="syncing" class="mr-2 h-4 w-4 animate-spin" />
            <RefreshCw v-else class="mr-2 h-4 w-4" />
            立即同步
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="$emit('view-logs')"
          >
            <FileText class="mr-2 h-4 w-4" />
            查看日志
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="$emit('configure')"
          >
            <Settings class="mr-2 h-4 w-4" />
            配置
          </Button>
        </div>

        <!-- 同步统计 -->
        <div v-if="syncStats" class="grid grid-cols-3 gap-4 pt-4 border-t">
          <div class="text-center">
            <div class="text-2xl font-bold">{{ syncStats.totalMembers }}</div>
            <div class="text-xs text-muted-foreground">总成员数</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{{ syncStats.syncedMembers }}</div>
            <div class="text-xs text-muted-foreground">已同步</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-600">{{ syncStats.failedMembers }}</div>
            <div class="text-xs text-muted-foreground">失败</div>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from '@juanie/ui'
import {
  CheckCircle2,
  XCircle,
  GitBranch,
  Github,
  Gitlab,
  ExternalLink,
  RefreshCw,
  FileText,
  Settings,
  Loader2,
} from 'lucide-vue-next'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Organization {
  id: string
  name: string
  gitSyncEnabled?: boolean
  gitProvider?: string | null
  gitOrgId?: string | null
  gitOrgName?: string | null
  gitOrgUrl?: string | null
  gitLastSyncAt?: string | null
}

interface SyncStats {
  totalMembers: number
  syncedMembers: number
  failedMembers: number
}

interface Props {
  organization: Organization
  syncing?: boolean
  syncStats?: SyncStats | null
}

const props = withDefaults(defineProps<Props>(), {
  syncing: false,
  syncStats: null,
})

const emit = defineEmits<{
  'enable-sync': []
  'sync-now': []
  'view-logs': []
  'configure': []
}>()

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm', { locale: zhCN })
}
</script>
