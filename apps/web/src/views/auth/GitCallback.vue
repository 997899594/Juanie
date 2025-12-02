<template>
  <div class="flex min-h-screen items-center justify-center">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle>Git 账号关联</CardTitle>
        <CardDescription>
          {{ statusMessage }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center space-y-4">
        <Loader2 v-if="processing" class="h-12 w-12 animate-spin text-primary" />
        <CheckCircle v-else-if="success" class="h-12 w-12 text-green-600" />
        <XCircle v-else-if="error" class="h-12 w-12 text-red-600" />

        <p v-if="error" class="text-sm text-red-600">
          {{ error }}
        </p>

        <Button
          v-if="!processing"
          @click="handleRedirect"
          class="w-full"
        >
          {{ success ? '返回设置' : '重试' }}
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import { CheckCircle, Loader2, XCircle } from 'lucide-vue-next'
import { useGitSync } from '@/composables/useGitSync'

const router = useRouter()
const route = useRoute()
const { linkGitAccount } = useGitSync()

const processing = ref(true)
const success = ref(false)
const error = ref<string | null>(null)
const statusMessage = ref('正在处理授权...')

/**
 * 处理 OAuth 回调
 */
async function handleCallback() {
  try {
    // 从 URL 获取授权码
    const code = route.query.code as string
    const state = route.query.state as string

    if (!code) {
      throw new Error('未收到授权码')
    }

    // 从 localStorage 获取 provider
    const provider = localStorage.getItem('git_oauth_provider') as 'github' | 'gitlab'

    if (!provider) {
      throw new Error('未找到 Git 平台信息')
    }

    // 调用关联 API
    await linkGitAccount(provider, code, state)

    // 清理 localStorage
    localStorage.removeItem('git_oauth_provider')

    success.value = true
    statusMessage.value = '账号关联成功！'
  } catch (err: any) {
    error.value = err.message || '关联失败，请重试'
    statusMessage.value = '关联失败'
  } finally {
    processing.value = false
  }
}

/**
 * 处理重定向
 */
function handleRedirect() {
  if (success.value) {
    // 成功后返回用户设置页
    router.push('/settings/git-accounts')
  } else {
    // 失败后返回设置页重试
    router.push('/settings/git-accounts')
  }
}

// 初始化
onMounted(() => {
  handleCallback()
})
</script>
