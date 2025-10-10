<template>
  <div class="min-h-screen bg-background text-foreground p-8">
    <div class="max-w-6xl mx-auto space-y-8">
      <!-- 页面标题 -->
      <div class="text-center">
        <h1 class="text-4xl font-bold mb-2">Juanie UI 组件测试</h1>
        <p class="text-muted-foreground">测试所有 UI 组件和主题功能</p>
      </div>

      <!-- 快速主题切换 -->
      <div class="bg-card text-card-foreground p-6 rounded-lg border">
        <h2 class="text-xl font-semibold mb-4">快速主题切换</h2>
        <div class="flex flex-wrap gap-3">
          <button 
            v-for="themeOption in themes"
            :key="themeOption.key"
            @click="setTheme(themeOption.key)"
            :class="[
              'px-4 py-2 rounded-md transition-colors',
              currentTheme === themeOption.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            ]"
          >
            {{ themeOption.name }}
          </button>
          <button 
            @click="toggleDark()"
            class="px-4 py-2 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            {{ isDark ? '🌙 暗色' : '☀️ 亮色' }}
          </button>
        </div>
      </div>

      <!-- 基础样式测试 -->
      <div class="bg-card text-card-foreground p-6 rounded-lg border">
        <h2 class="text-xl font-semibold mb-4">基础样式测试</h2>
        
        <!-- 按钮测试 -->
        <div class="mb-6">
          <h3 class="font-medium mb-3">按钮组件</h3>
          <div class="flex flex-wrap gap-3">
            <button class="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
              Primary 按钮
            </button>
            <button class="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors">
              Secondary 按钮
            </button>
            <button class="bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors">
              Accent 按钮
            </button>
            <button class="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors">
              Destructive 按钮
            </button>
            <button class="border border-border bg-background text-foreground px-4 py-2 rounded-md hover:bg-muted transition-colors">
              Outline 按钮
            </button>
          </div>
        </div>

        <!-- 输入框测试 -->
        <div class="mb-6">
          <h3 class="font-medium mb-3">表单组件</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="text" 
              placeholder="文本输入框"
              class="bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            <input 
              type="email" 
              placeholder="邮箱输入框"
              class="bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            <select class="bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring transition-colors">
              <option>选择选项</option>
              <option>选项 1</option>
              <option>选项 2</option>
              <option>选项 3</option>
            </select>
            <input 
              type="range" 
              class="w-full accent-primary"
            />
          </div>
          <textarea 
            placeholder="多行文本输入"
            rows="3"
            class="w-full mt-4 bg-background border border-input px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors"
          ></textarea>
        </div>

        <!-- 状态色测试 -->
        <div class="mb-6">
          <h3 class="font-medium mb-3">状态色彩</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-success text-success-foreground p-4 rounded-md text-center">
              <div class="font-medium">Success</div>
              <div class="text-sm opacity-80">成功状态</div>
            </div>
            <div class="bg-warning text-warning-foreground p-4 rounded-md text-center">
              <div class="font-medium">Warning</div>
              <div class="text-sm opacity-80">警告状态</div>
            </div>
            <div class="bg-info text-info-foreground p-4 rounded-md text-center">
              <div class="font-medium">Info</div>
              <div class="text-sm opacity-80">信息状态</div>
            </div>
            <div class="bg-destructive text-destructive-foreground p-4 rounded-md text-center">
              <div class="font-medium">Error</div>
              <div class="text-sm opacity-80">错误状态</div>
            </div>
          </div>
        </div>

        <!-- 卡片和布局测试 -->
        <div>
          <h3 class="font-medium mb-3">卡片和布局</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-muted p-4 rounded-md">
              <h4 class="font-medium mb-2">Muted 卡片</h4>
              <p class="text-muted-foreground text-sm">这是一个使用 muted 背景的卡片</p>
            </div>
            <div class="bg-popover text-popover-foreground p-4 rounded-md border">
              <h4 class="font-medium mb-2">Popover 卡片</h4>
              <p class="text-sm opacity-80">这是一个弹出层样式的卡片</p>
            </div>
            <div class="bg-card text-card-foreground p-4 rounded-md border">
              <h4 class="font-medium mb-2">Card 卡片</h4>
              <p class="text-sm opacity-80">这是一个标准的卡片组件</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 颜色工具测试 -->
      <div class="bg-card text-card-foreground p-6 rounded-lg border">
        <h2 class="text-xl font-semibold mb-4">颜色工具测试</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-medium mb-3">自定义主色</h3>
            <div class="space-y-3">
              <input
                v-model="customColor"
                type="color"
                class="w-full h-12 rounded-md border border-input cursor-pointer"
              />
              <button
                @click="applyCustomColor"
                class="w-full bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors"
              >
                应用自定义颜色
              </button>
            </div>
          </div>
          <div>
            <h3 class="font-medium mb-3">颜色信息</h3>
            <div class="space-y-2 text-sm">
              <div>当前主题: <span class="font-mono">{{ currentTheme }}</span></div>
              <div>颜色模式: <span class="font-mono">{{ colorMode }}</span></div>
              <div>暗色模式: <span class="font-mono">{{ isDark ? 'true' : 'false' }}</span></div>
              <div>自定义颜色: <span class="font-mono">{{ customColor }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 完整的主题 Demo 组件 -->
      <!-- <demo /> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { demo } from '@juanie/ui/demo'
import { useTheme, BUILT_IN_THEMES, hexToOklch, generateColorPalette } from '@juanie/ui'
import { computed, onMounted, ref } from 'vue'

const theme = useTheme()
const customColor = ref('#3b82f6')

const themes = computed(() => 
  Object.entries(BUILT_IN_THEMES).map(([key, value]) => ({
    key: key as keyof typeof BUILT_IN_THEMES,
    ...value
  }))
)

const currentTheme = computed(() => theme.currentTheme.value)
const colorMode = computed(() => theme.colorMode.value)
const isDark = computed(() => theme.isDark.value)

function setTheme(themeName: keyof typeof BUILT_IN_THEMES) {
  theme.setTheme(themeName)
}

function toggleDark() {
  theme.toggleDark()
}

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
  document.title = 'Juanie UI - 组件测试'
  theme.loadPersistedSettings()
})
</script>
