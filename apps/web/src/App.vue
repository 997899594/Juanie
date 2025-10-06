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
import { bilibiliTheme } from '@juanie/ui/themes'
import { darkTheme } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

// 主题配置
const theme = computed(() => {
  return themeStore.isDark ? darkTheme : null
})

// 使用 UI 包的主题覆盖配置
const themeOverrides = bilibiliTheme
</script>
