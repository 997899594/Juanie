<template>
  <div id="app" class="min-h-screen">
    <router-view />
    <Toaster position="top-right" :duration="3000" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

// 全局认证状态初始化
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

onMounted(async () => {
  // 应用启动时初始化认证状态
  await authStore.initialize()
  
  // 初始化主题（从持久化存储恢复）
  preferencesStore.applyTheme()
})
</script>


