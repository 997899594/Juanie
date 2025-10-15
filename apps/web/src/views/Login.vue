<template>
  <div class="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle>登录到 Juanie</CardTitle>
        <CardDescription>使用 GitLab 进行安全登录</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <Button class="w-full" :disabled="loading" @click="loginWithGitLab">
            <span v-if="!loading">使用 GitLab 登录</span>
            <span v-else>正在跳转 GitLab…</span>
          </Button>

          <p v-if="error" class="text-sm text-destructive">
            {{ error }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { trpc } from '@/lib/trpc'

const router = useRouter()
const loading = ref(false)
const error = ref<string | null>(null)

// 如果已登录，则直接跳回首页
onMounted(async () => {
  try {
    // 调用受保护的 me，如果返回用户信息则认为已登录
    // 未登录会抛出错误，继续显示登录页
    const user = await trpc.auth.me.query()
    if (user) {
      router.replace({ name: 'Home' })
    }
  } catch {
    // 未登录，忽略错误
  }
})

async function loginWithGitLab() {
  loading.value = true
  error.value = null
  try {
    const url = await trpc.auth.getGitLabLoginUrl.query()
    if (!url) {
      throw new Error('未获取到 GitLab 登录地址')
    }
    // 跳转到 OAuth 授权页
    window.location.href = url
  } catch (e) {
    const msg = e instanceof Error ? e.message : '获取登录地址失败'
    error.value = msg
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
</style>