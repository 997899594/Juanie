<template>
  <div class="space-y-8">
    <!-- 导航栏 -->
    <nav class="border-b bg-card">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold">Juanie Dashboard</h1>
          </div>
          <div class="flex items-center space-x-4">
            <div v-if="authStore.user" class="flex items-center space-x-3">
              <Avatar class="h-8 w-8">
                <AvatarImage
                  v-if="authStore.user?.avatarUrl"
                  :src="authStore.user.avatarUrl"
                  :alt="authStore.user.displayName || authStore.user.username || '用户头像'"
                />
                <AvatarFallback>{{ (authStore.user?.displayName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <span class="text-sm font-medium">{{ authStore.user?.displayName || authStore.user?.username || '未知用户' }}</span>
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
        <!-- 主要内容 -->
        <div class="space-y-6">
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight">仪表盘</h1>
            <p class="text-muted-foreground">
              欢迎回来！这里是您的应用概览。
            </p>
          </div>

          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">总应用数</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">12</div>
                <p class="text-xs text-muted-foreground">
                  +2 较上月
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">运行中应用</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">8</div>
                <p class="text-xs text-muted-foreground">
                  66.7% 运行率
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">本月部署</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="text-2xl font-bold">24</div>
                <p class="text-xs text-muted-foreground">
                  +12 较上月
                </p>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>用户信息</CardTitle>
                <CardDescription>当前登录用户的基本信息</CardDescription>
              </CardHeader>
              <CardContent>
                <div class="space-y-2">
                  <p><strong>用户名:</strong> {{ authStore.user?.displayName || authStore.user?.username || '未知用户' }}</p>
                  <p><strong>邮箱:</strong> {{ authStore.user?.email || '未知邮箱' }}</p>
                  <p><strong>登录状态:</strong> 
                    <span class="text-green-600">已登录</span>
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
                <CardDescription>常用功能快捷入口</CardDescription>
              </CardHeader>
              <CardContent>
                <div class="space-y-2">
                  <Button class="w-full" @click="$router.push('/apps')">
                    管理应用
                  </Button>
                  <Button variant="outline" class="w-full">
                    查看日志
                  </Button>
                  <Button variant="outline" class="w-full">
                    系统设置
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- 添加更多内容来测试滚动效果 -->
          <div class="space-y-6">
            <h2 class="text-2xl font-bold tracking-tight">最近活动</h2>
            
            <div class="space-y-4">
              <Card v-for="i in 10" :key="i">
                <CardHeader>
                  <CardTitle class="text-lg">活动 {{ i }}</CardTitle>
                  <CardDescription>{{ new Date().toLocaleDateString() }}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p class="text-sm text-muted-foreground">
                    这是第 {{ i }} 个活动的详细描述。这里可以显示应用部署、更新、错误等各种活动信息。
                    为了测试滚动效果，我们添加了更多的内容来确保页面有足够的高度。
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <!-- 更多测试内容 -->
          <div class="space-y-6">
            <h2 class="text-2xl font-bold tracking-tight">系统监控</h2>
            
            <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card v-for="metric in ['CPU使用率', '内存使用率', '磁盘使用率', '网络流量']" :key="metric">
                <CardHeader class="pb-2">
                  <CardTitle class="text-sm font-medium">{{ metric }}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="text-2xl font-bold">{{ Math.floor(Math.random() * 100) }}%</div>
                  <div class="h-2 bg-muted rounded-full mt-2">
                    <div class="h-2 bg-primary rounded-full" :style="{ width: Math.floor(Math.random() * 100) + '%' }"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <!-- 底部内容 -->
          <div class="space-y-6 pb-20">
            <h2 class="text-2xl font-bold tracking-tight">应用列表</h2>
            
            <div class="space-y-4">
              <Card v-for="app in ['Web应用', 'API服务', '数据库', '缓存服务', '消息队列']" :key="app">
                <CardHeader>
                  <CardTitle class="text-lg">{{ app }}</CardTitle>
                  <CardDescription>运行状态：正常</CardDescription>
                </CardHeader>
                <CardContent>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-muted-foreground">最后更新：{{ new Date().toLocaleString() }}</span>
                    <Button size="sm" variant="outline">查看详情</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Avatar, AvatarImage, AvatarFallback } from '@juanie/ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = async () => {
  await authStore.logout()
  router.push({ name: 'Login' })
}

onMounted(async () => {
  // 初始化认证状态
  await authStore.initialize()
  
  // 如果未登录，跳转到登录页
  if (!authStore.isAuthenticated) {
    router.replace({ name: 'Login' })
  }
})
</script>