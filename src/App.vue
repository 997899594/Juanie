<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
      <n-global-style />
      <n-loading-bar-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <n-message-provider>
              <router-view />
            </n-message-provider>
          </n-notification-provider>
        </n-dialog-provider>
      </n-loading-bar-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
<<<<<<< Updated upstream:src/App.vue
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { darkTheme } from 'naive-ui'
import { naiveThemeOverrides } from '@/theme/naive-ui'
=======
import { useTheme } from '@juanie/ui'
>>>>>>> Stashed changes:apps/web/src/App.vue

const themeStore = useThemeStore()

// 主题配置
const theme = computed(() => {
  return themeStore.isDark ? darkTheme : null
})

// 使用精简的主题覆盖配置
const themeOverrides = naiveThemeOverrides
</script>

<style>
/* 全局样式已在 styles/index.css 中定义 */
</style>