<template>
  <div id="app" class="min-h-screen">
    <router-view />
    <Toaster position="top-right" rich-colors close-button />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from '@juanie/ui'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

// 全局认证状态初始化
const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

onMounted(async () => {
  await authStore.initialize()
  await preferencesStore.initialize()
})

</script>


