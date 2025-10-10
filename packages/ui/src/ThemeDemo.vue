<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTheme, BUILT_IN_THEMES } from './theme'
import { hexToOklch, generateColorPalette } from './color-utils'

const theme = useTheme()
const customColor = ref('#3b82f6')

const themeOptions = computed<any>(() => 
  Object.entries(BUILT_IN_THEMES).map(([key, value]) => ({
    key,
    ...value
  }))
)

const colorModeOptions = [
  { key: 'light', name: '浅色模式' },
  { key: 'dark', name: '深色模式' },
  { key: 'system', name: '跟随系统' }
] as const

async function applyCustomColor() {
  try {
    const oklch = hexToOklch(customColor.value)
    const palette = generateColorPalette(oklch)
    
    // 动态注入自定义主题变量
    const style = document.getElementById('custom-theme-vars') || 
                  document.createElement('style')
    style.id = 'custom-theme-vars'
    
    style.textContent = `
      :root[data-theme="custom"] {
        --color-primary: ${palette.primary};
        --color-primary-foreground: ${palette.primaryForeground};
        --color-secondary: ${palette.secondary};
        --color-secondary-foreground: ${palette.secondaryForeground};
        --color-accent: ${palette.accent};
        --color-accent-foreground: ${palette.accentForeground};
      }
    `
    
    if (!document.head.contains(style)) {
      document.head.appendChild(style)
    }
    
    // 切换到自定义主题
    document.documentElement.dataset.theme = 'custom'
  } catch (error) {
    console.error('应用自定义颜色失败:', error)
  }
}

onMounted(() => {
  theme.loadPersistedSettings()
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-8">
    <!-- 主题控制面板 -->
    <div class="bg-card text-card-foreground rounded-lg border p-6">
      <h2 class="text-2xl font-semibold mb-6">主题设置</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- 主题选择 -->
        <div>
          <label class="block text-sm font-medium mb-3">主题风格</label>
          <div class="space-y-2">
            <button
              v-for="option in themeOptions"
              :key="option.key"
              @click="theme.setTheme(option.key)"
              :class="[
                'w-full text-left px-3 py-2 rounded-md border transition-colors',
                theme.currentTheme.value === option.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              ]"
            >
              <div class="font-medium">{{ option.name }}</div>
              <div class="text-xs opacity-70">{{ option.description }}</div>
            </button>
          </div>
        </div>
        
        <!-- 颜色模式 -->
        <div>
          <label class="block text-sm font-medium mb-3">颜色模式</label>
          <div class="space-y-2">
            <button
              v-for="option in colorModeOptions"
              :key="option.key"
              @click="theme.setColorMode(option.key)"
              :class="[
                'w-full text-left px-3 py-2 rounded-md border transition-colors',
                theme.colorMode.value === option.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              ]"
            >
              {{ option.name }}
            </button>
          </div>
        </div>
        
        <!-- 自定义颜色 -->
        <div>
          <label class="block text-sm font-medium mb-3">自定义主色</label>
          <div class="space-y-3">
            <input
              v-model="customColor"
              type="color"
              class="w-full h-10 rounded-md border border-input cursor-pointer"
            />
            <button
              @click="applyCustomColor"
              class="w-full bg-accent text-accent-foreground px-3 py-2 rounded-md hover:bg-accent/90 transition-colors"
            >
              应用自定义颜色
            </button>
          </div>
        </div>
      </div>
      
      <!-- 当前状态 -->
      <div class="mt-6 p-4 bg-muted rounded-md">
        <div class="text-sm">
          <span class="font-medium">当前主题:</span> {{ theme.currentTheme.value }} |
          <span class="font-medium">颜色模式:</span> {{ theme.colorMode.value }} |
          <span class="font-medium">暗色模式:</span> {{ theme.isDark.value ? '开启' : '关闭' }}
        </div>
      </div>
    </div>
    
    <!-- 组件预览 -->
    <div class="bg-card text-card-foreground rounded-lg border p-6">
      <h2 class="text-2xl font-semibold mb-6">组件预览</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 按钮组 -->
        <div>
          <h3 class="font-medium mb-3">按钮</h3>
          <div class="space-y-2">
            <button class="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
              Primary
            </button>
            <button class="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90">
              Secondary
            </button>
            <button class="w-full bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90">
              Accent
            </button>
            <button class="w-full bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90">
              Destructive
            </button>
          </div>
        </div>
        
        <!-- 输入框 -->
        <div>
          <h3 class="font-medium mb-3">输入</h3>
          <div class="space-y-2">
            <input 
              type="text" 
              placeholder="文本输入"
              class="w-full bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select class="w-full bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              <option>选项 1</option>
              <option>选项 2</option>
              <option>选项 3</option>
            </select>
            <textarea 
              placeholder="多行文本"
              rows="3"
              class="w-full bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            ></textarea>
          </div>
        </div>
        
        <!-- 状态色 -->
        <div>
          <h3 class="font-medium mb-3">状态色</h3>
          <div class="space-y-2">
            <div class="bg-success text-success-foreground px-3 py-2 rounded-md text-sm">
              成功状态
            </div>
            <div class="bg-warning text-warning-foreground px-3 py-2 rounded-md text-sm">
              警告状态
            </div>
            <div class="bg-info text-info-foreground px-3 py-2 rounded-md text-sm">
              信息状态
            </div>
            <div class="bg-destructive text-destructive-foreground px-3 py-2 rounded-md text-sm">
              错误状态
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>