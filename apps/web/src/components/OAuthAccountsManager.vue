<template>
  <Card>
    <CardHeader>
      <CardTitle>已连接账户</CardTitle>
      <CardDescription>
        管理你的 GitHub 和 GitLab OAuth 连接
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- 加载状态 -->
      <div v-if="isLoading && accounts.length === 0" class="flex items-center justify-center py-8">
        <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <!-- 账户列表 -->
      <div v-else-if="accounts.length > 0" class="space-y-3">
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex items-center justify-between p-4 border rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <component
              :is="account.provider === 'github' ? Github : Gitlab"
              class="h-6 w-6"
            />
            <div>
              <p class="font-medium">
                {{ account.provider === 'github' ? 'GitHub' : 'GitLab' }}
              </p>
              <p class="text-sm text-muted-foreground">
                账户ID: {{ account.providerAccountId }}
              </p>
              <p class="text-xs text-muted-foreground">
                连接时间: {{ formatDate(account.createdAt) }}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            :disabled="isLoading"
            @click="handleDisconnect(account.provider)"
          >
            <Unplug class="h-4 w-4 mr-2" />
            断开连接
          </Button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-8">
        <p class="text-sm text-muted-foreground mb-4">
          暂未连接任何 OAuth 账户
        </p>
      </div>

      <!-- 连接新账户 -->
      <div class="pt-4 border-t space-y-2">
        <p class="text-sm font-medium mb-3">连接新账户</p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            class="flex-1"
            :disabled="isLoading || hasGithub"
            @click="handleConnect('github')"
          >
            <Github class="h-4 w-4 mr-2" />
            {{ hasGithub ? '已连接 GitHub' : '连接 GitHub' }}
          </Button>
          <Button
            variant="outline"
            class="flex-1"
            :disabled="isLoading || hasGitlab"
            @click="handleConnect('gitlab')"
          >
            <Gitlab class="h-4 w-4 mr-2" />
            {{ hasGitlab ? '已连接 GitLab' : '连接 GitLab' }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useOAuth } from '@/composables/useOAuth'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import { Github, Gitlab, Loader2, Unplug } from 'lucide-vue-next'
import { format } from 'date-fns'

const { accounts, isLoading, listAccounts, disconnect, connect } = useOAuth()

// 检查是否已连接特定提供商
const hasGithub = computed(() => 
  accounts.value.some(acc => acc.provider === 'github')
)
const hasGitlab = computed(() => 
  accounts.value.some(acc => acc.provider === 'gitlab')
)

// 格式化日期
const formatDate = (date: string) => {
  return format(new Date(date), 'yyyy-MM-dd HH:mm')
}

// 连接账户
const handleConnect = (provider: 'github' | 'gitlab') => {
  connect(provider)
}

// 断开连接
const handleDisconnect = async (provider: 'github' | 'gitlab') => {
  if (confirm(`确定要断开与 ${provider === 'github' ? 'GitHub' : 'GitLab'} 的连接吗？`)) {
    await disconnect(provider)
  }
}

// 组件挂载时加载账户列表
onMounted(() => {
  listAccounts()
})
</script>
