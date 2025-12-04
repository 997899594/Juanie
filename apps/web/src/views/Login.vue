<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
    <!-- 背景装饰元素 -->
    <div class="absolute inset-0">
      <div class="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div class="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
    </div>

    <!-- 主要内容区域 -->
    <div class="relative z-10 min-h-screen flex">
      <!-- 左侧品牌介绍区域 -->
      <div class="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16">
        <div class="max-w-md">
          <!-- 品牌Logo和标题 -->
          <div class="mb-8">
            <div class="flex items-center mb-6">
              <div class="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                J
              </div>
              <h1 class="ml-4 text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Juanie
              </h1>
            </div>
            <p class="text-xl text-gray-600 leading-relaxed">
              现代化的开发者协作平台，让团队协作更高效
            </p>
          </div>

          <!-- 产品特色 -->
          <div class="space-y-6">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">快速集成</h3>
                <p class="text-gray-600 text-sm">支持 GitHub 和 GitLab，一键连接你的代码仓库</p>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">安全可靠</h3>
                <p class="text-gray-600 text-sm">企业级安全保障，保护你的代码和数据安全</p>
              </div>
            </div>

            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">团队协作</h3>
                <p class="text-gray-600 text-sm">实时协作工具，让团队沟通更顺畅</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单区域 -->
      <div class="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div 
          class="w-full max-w-md"
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :enter="{ opacity: 1, y: 0, transition: { duration: 500, delay: 200 } }"
        >
          <!-- 玻璃拟态登录卡片 -->
          <div class="backdrop-blur-xl bg-white/30 border border-white/20 rounded-2xl shadow-xl p-8">
            <!-- 移动端品牌标题 -->
            <div class="lg:hidden text-center mb-8">
              <div class="flex items-center justify-center mb-4">
                <div class="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  J
                </div>
                <h1 class="ml-3 text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Juanie
                </h1>
              </div>
              <p class="text-gray-600">欢迎回来</p>
            </div>

            <!-- 桌面端简洁标题 -->
            <div class="hidden lg:block text-center mb-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-2">欢迎回来</h2>
              <p class="text-gray-600">选择你的登录方式</p>
            </div>
            
            <!-- 登录表单 -->
            <LoginForm 
              @github-login="handleGitHubLogin"
              @gitlab-login="handleGitLabLogin"
            />
            
            <!-- 加载状态 -->
            <div v-if="isLoading" class="mt-4 text-center">
              <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-blue-500 hover:bg-blue-400 transition ease-in-out duration-150 cursor-not-allowed">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在跳转...
              </div>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="error" class="mt-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {{ error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载状态覆盖层 -->
    <div v-if="isLoading" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="bg-white/90 backdrop-blur-xl rounded-2xl p-8 flex flex-col items-center space-y-4 shadow-2xl border border-white/20">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span class="text-gray-700 font-medium">正在跳转到认证页面...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { log } from '@juanie/ui'
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { trpc } from '@/lib/trpc'
import LoginForm from '@/components/LoginForm.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref('')

// 处理 OAuth 回调
onMounted(async () => {
  const { code, state } = route.query
  
  if (code && state) {
    isLoading.value = true
    const { useToast } = await import('@/composables/useToast')
    const toast = useToast()
    
    try {
      // 使用统一的 oauthCallback，后端自动判断 provider
      const result = await trpc.auth.oauthCallback.mutate({
        code: code as string,
        state: state as string
      })
      
      // Cookie-only：只设置用户信息，不保存 sessionId
      authStore.setUser(result.user)
      
      // 获取用户的组织列表，自动设置第一个组织为当前组织
      const { useAppStore } = await import('@/stores/app')
      const appStore = useAppStore()
      
      try {
        const orgs = await trpc.organizations.list.query()
        if (orgs && orgs.length > 0 && !appStore.currentOrganizationId) {
          appStore.setCurrentOrganization(orgs[0]!.id)
        }
      } catch (orgErr) {
        log.warn('获取组织列表失败:', orgErr)
      }
      
      toast.success('登录成功', '欢迎回来！')
      
      const redirectTo = route.query.redirect as string || '/'
      router.push(redirectTo)
    } catch (err) {
      log.error('OAuth 回调处理失败:', err)
      error.value = '登录失败，请重试'
      toast.error('登录失败', '请重试或联系管理员')
    } finally {
      isLoading.value = false
    }
  }
})

const handleGitHubLogin = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    // 获取 GitHub OAuth 授权 URL
    const result = await trpc.auth.githubAuthUrl.query()
    
    // 跳转到 GitHub 授权页面
    window.location.href = result.url
  } catch (err) {
    log.error('获取 GitHub 授权 URL 失败:', err)
    error.value = '获取登录链接失败，请重试'
    isLoading.value = false
    
    // 使用 toast 显示错误
    const { useToast } = await import('@/composables/useToast')
    const toast = useToast()
    toast.error('登录失败', '获取登录链接失败，请重试')
  }
}

const handleGitLabLogin = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    // 获取GitLab OAuth授权URL
    const result = await trpc.auth.gitlabAuthUrl.query()
    
    // 跳转到GitLab授权页面
    window.location.href = result.url
  } catch (err) {
    log.error('获取GitLab授权URL失败:', err)
    error.value = '获取登录链接失败，请重试'
    isLoading.value = false
    
    // 使用 toast 显示错误
    const { useToast } = await import('@/composables/useToast')
    const toast = useToast()
    toast.error('登录失败', '获取登录链接失败，请重试')
  }
}
</script>

<style scoped>
/* 自定义动画 */
@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

/* 玻璃拟态效果增强 */
.backdrop-blur-xl {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* 渐变文字效果 */
.bg-clip-text {
  -webkit-background-clip: text;
  background-clip: text;
}
</style>