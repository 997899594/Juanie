<template>
  <Card>
    <CardHeader>
      <CardTitle>Git 账号关联</CardTitle>
      <CardDescription>
        关联您的 GitHub 或 GitLab 账号以启用自动权限同步
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- 已关联账号列表 -->
      <div v-if="accounts.length > 0" class="space-y-3">
        <div
          v-for="account in accounts"
          :key="account.id"
          class="flex items-center justify-between rounded-lg border p-3"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full"
              :class="account.provider === 'github' ? 'bg-gray-900' : 'bg-orange-500'"
            >
              <Github v-if="account.provider === 'github'" class="h-5 w-5 text-white" />
              <Gitlab v-else class="h-5 w-5 text-white" />
            </div>
            <div>
              <p class="text-sm font-medium">{{ account.gitUsername }}</p>
              <p class="text-xs text-muted-foreground">
                {{ account.provider === 'github' ? 'GitHub' : 'GitLab' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Badge :variant="getSyncStatusVariant(account.syncStatus)">
              {{ getSyncStatusLabel(account.syncStatus) }}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              @click="handleUnlink(account.id)"
              :disabled="unlinking === account.id"
            >
              <Loader2 v-if="unlinking === account.id" class="h-4 w-4 animate-spin" />
              <Unlink v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-6">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Link2 class="h-6 w-6 text-muted-foreground" />
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          暂未关联任何 Git 账号
        </p>
      </div>

      <!-- 关联按钮 -->
      <div class="flex gap-2 pt-2">
        <Button
          variant="outline"
          class="flex-1"
          @click="handleLink('github')"
          :disabled="linking !== null"
        >
          <Github class="mr-2 h-4 w-4" />
          <Loader2 v-if="linking === 'github'" class="mr-2 h-4 w-4 animate-spin" />
          关联 GitHub
        </Button>
        <Button
          variant="outline"
          class="flex-1"
          @click="handleLink('gitlab')"
          :disabled="linking !== null"
        >
          <Gitlab class="mr-2 h-4 w-4" />
          <Loader2 v-if="linking === 'gitlab'" class="mr-2 h-4 w-4 animate-spin" />
          关联 GitLab
        </Button>
      </div>

      <!-- 说明文字 -->
      <div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p class="text-xs text-blue-700">
          <strong>提示：</strong>关联 Git 账号后，当您被添加到项目时，系统会自动将您添加为 Git 仓库的协作者，无需手动配置权限。
        </p>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import { Github, Gitlab, Link2, Loader2, Unlink } from 'lucide-vue-next'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const accounts = ref<any[]>([])
const linking = ref<'github' | 'gitlab' | null>(null)
const unlinking = ref<string | null>(null)
const loading = ref(false)

/**
 * 加载已关联的账号
 */
async function loadAccounts() {
  loading.value = true
  try {
    const result = await trpc.gitSync.getGitAccountStatus.query({})
    accounts.value = result.accounts
  } catch (error: any) {
    toast.error('加载失败', error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 关联 Git 账号
 */
async function handleLink(provider: 'github' | 'gitlab') {
  linking.value = provider

  try {
    // 获取 OAuth 授权 URL
    const result = await trpc.gitSync.getOAuthUrl.query({
      provider,
      redirectUri: `${window.location.origin}/auth/git-callback`,
    })

    // 保存 provider 到 localStorage，回调时使用
    localStorage.setItem('git_oauth_provider', provider)

    // 跳转到 OAuth 授权页面
    window.location.href = result.authUrl
  } catch (error: any) {
    toast.error('获取授权链接失败', error.message)
    linking.value = null
  }
}

/**
 * 取消关联 Git 账号
 */
async function handleUnlink(accountId: string) {
  unlinking.value = accountId

  try {
    await trpc.gitSync.unlinkGitAccount.mutate({ accountId })

    toast.success('取消关联成功', 'Git 账号已取消关联')

    // 重新加载账号列表
    await loadAccounts()
  } catch (error: any) {
    toast.error('取消关联失败', error.message)
  } finally {
    unlinking.value = null
  }
}

/**
 * 获取同步状态的 Badge 样式
 */
function getSyncStatusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'default'
    case 'inactive':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'outline'
  }
}

/**
 * 获取同步状态的文本
 */
function getSyncStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return '正常'
    case 'inactive':
      return '未激活'
    case 'error':
      return '错误'
    default:
      return '未知'
  }
}

// 初始加载
onMounted(() => {
  loadAccounts()
})
</script>
