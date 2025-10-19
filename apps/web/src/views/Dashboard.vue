<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- 导航栏 -->
    <nav class="border-b bg-card">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold">Juanie Dashboard</h1>
          </div>
          <div class="flex items-center space-x-4">
            <div v-if="authStore.user" class="flex items-center space-x-3">
              <img 
                v-if="authStore.user.image" 
                :src="authStore.user.image" 
                :alt="authStore.user.name"
                class="w-8 h-8 rounded-full"
              >
              <span class="text-sm font-medium">{{ authStore.user.name }}</span>
            </div>
            <Button variant="outline" size="sm" @click="handleLogout" :disabled="authStore.loading">
              登出
            </Button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <!-- 欢迎卡片 -->
        <Card class="mb-6">
          <CardHeader>
            <CardTitle>欢迎回来！</CardTitle>
            <CardDescription v-if="authStore.user">
              你好，{{ authStore.user.name }}，欢迎使用 Juanie 系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="text-center p-4 bg-muted rounded-lg">
                <h3 class="font-semibold">文档管理</h3>
                <p class="text-sm text-muted-foreground mt-1">管理和搜索文档</p>
                <Button class="mt-3" size="sm" @click="$router.push('/documents')">
                  进入文档
                </Button>
              </div>
              <div class="text-center p-4 bg-muted rounded-lg">
                <h3 class="font-semibold">组件演示</h3>
                <p class="text-sm text-muted-foreground mt-1">查看 UI 组件库</p>
                <Button class="mt-3" size="sm" variant="outline" @click="$router.push('/demo')">
                  查看演示
                </Button>
              </div>
              <div class="text-center p-4 bg-muted rounded-lg">
                <h3 class="font-semibold">系统设置</h3>
                <p class="text-sm text-muted-foreground mt-1">个人设置和偏好</p>
                <Button class="mt-3" size="sm" variant="outline" disabled>
                  即将推出
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 用户信息卡片 -->
        <Card v-if="authStore.user">
          <CardHeader>
            <CardTitle>用户信息</CardTitle>
            <CardDescription>当前登录用户的详细信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <div class="flex items-center space-x-3">
                <span class="text-sm font-medium w-16">用户ID:</span>
                <span class="text-sm text-muted-foreground">{{ authStore.user.id }}</span>
              </div>
              <div class="flex items-center space-x-3">
                <span class="text-sm font-medium w-16">邮箱:</span>
                <span class="text-sm text-muted-foreground">{{ authStore.user.email }}</span>
              </div>
              <div class="flex items-center space-x-3">
                <span class="text-sm font-medium w-16">姓名:</span>
                <span class="text-sm text-muted-foreground">{{ authStore.user.name }}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  // 初始化认证状态
  await authStore.initialize()
  
  // 如果未登录，跳转到登录页
  if (!authStore.isAuthenticated) {
    router.replace({ name: 'Login' })
  }
})

async function handleLogout() {
  try {
    await authStore.logout()
    router.push({ name: 'Login' })
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>