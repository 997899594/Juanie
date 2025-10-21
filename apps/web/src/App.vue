vue
<template>
  <div id="app" class="min-h-screen">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 全局认证状态初始化
const authStore = useAuthStore()

onMounted(async () => {
  // 应用启动时初始化认证状态
  await authStore.initialize()
})
</script>


