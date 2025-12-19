<template>
  <div class="mx-auto grid w-[350px] gap-6">
    <div class="grid gap-2 text-center">
      <h1 class="text-3xl font-bold">登录</h1>
      <p class="text-balance text-muted-foreground">
        选择您的登录方式
      </p>
    </div>
    <div class="space-y-4">
      <!-- GitHub 登录按钮 -->
      <button
        @click="handleGitHubLogin"
        :disabled="isLoading"
        class="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
      >
        <div class="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        <svg class="relative w-5 h-5 mr-3 transition-transform duration-200 group-hover:rotate-12" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd" />
        </svg>
        <span class="relative">使用 GitHub 登录</span>
        <div class="absolute inset-0 rounded-xl bg-white opacity-0 group-active:opacity-10 transition-opacity duration-75"></div>
      </button>

      <!-- GitLab 登录按钮 -->
      <button
        @click="handleGitLabLogin"
        :disabled="isLoading"
        class="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
      >
        <div class="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        <svg class="relative w-5 h-5 mr-3 transition-transform duration-200 group-hover:rotate-12" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
        </svg>
        <span class="relative">使用 GitLab 登录</span>
        <div class="absolute inset-0 rounded-xl bg-white opacity-0 group-active:opacity-10 transition-opacity duration-75"></div>
      </button>

      <!-- 分割线 -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-300/50"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-4 bg-white/50 backdrop-blur-sm text-gray-500 rounded-full">或者</span>
        </div>
      </div>

      <!-- 快速体验按钮 -->
      <button
        class="group relative w-full flex justify-center items-center py-3 px-4 border border-gray-300/50 text-sm font-medium rounded-xl text-gray-700 bg-white/50 backdrop-blur-sm hover:bg-white/70 hover:border-gray-400/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
      >
        <svg class="w-5 h-5 mr-3 text-blue-600 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
        <span>快速体验 Demo</span>
      </button>
    </div>
    <div class="mt-4 text-center text-sm">
      登录即表示您同意我们的
      <a href="#" class="underline">服务条款</a>
      和
      <a href="#" class="underline">隐私政策</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface LoginFormProps {
  githubLoginUrl?: string
  gitlabLoginUrl?: string
}

interface LoginFormEmits {
  (e: 'github-login'): void
  (e: 'gitlab-login'): void
}

const props = withDefaults(defineProps<LoginFormProps>(), {
  githubLoginUrl: '',
  gitlabLoginUrl: ''
})

const emit = defineEmits<LoginFormEmits>()

const isLoading = ref(false)

const handleGitHubLogin = () => {
  if (isLoading.value) return
  isLoading.value = true
  emit('github-login')
  // 重置加载状态
  setTimeout(() => {
    isLoading.value = false
  }, 2000)
}

const handleGitLabLogin = () => {
  if (isLoading.value) return
  isLoading.value = true
  emit('gitlab-login')
  // 重置加载状态
  setTimeout(() => {
    isLoading.value = false
  }, 2000)
}
</script>