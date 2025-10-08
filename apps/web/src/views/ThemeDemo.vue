<template>
  <div class="min-h-screen bg-background text-foreground transition-colors duration-300">
    <!-- 🎯 顶部导航栏 -->
    <header class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <h1 class="text-2xl font-bold">Juanie 主题系统</h1>
            <div class="text-sm text-muted-foreground">
              当前：{{ currentPreset }} - {{ resolvedMode }}
            </div>
          </div>
          
          <!-- 主题控制器 -->
          <div class="flex items-center gap-4">
            <!-- 主题选择器 -->
            <select 
              :value="currentPreset" 
              @change="handleThemeChange"
              class="px-3 py-2 bg-card border border-border rounded-md text-sm min-w-32"
            >
              <optgroup label="内置主题">
                <option value="default">🎨 Slate 主题</option>
                <option value="bilibili">🎀 Bilibili 主题</option>
                <option value="notion">📝 Notion 主题</option>
              </optgroup>
              <!-- 🎯 修复：完全安全的条件渲染 -->
              <optgroup label="自定义主题" v-if="customThemes && customThemes.length > 0">
                <option 
                  v-for="theme in customThemes" 
                  :key="theme?.id || Math.random()" 
                  :value="theme?.id"
                  v-show="theme?.id && theme?.name"
                >
                  ✨ {{ theme?.name || '未命名主题' }}
                </option>
              </optgroup>
            </select>

            <!-- 明暗模式切换 -->
            <button 
              @click="toggleMode"
              class="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              {{ isDark ? '🌙 暗色' : '☀️ 亮色' }}
            </button>

            <!-- 系统模式 -->
            <button 
              @click="setSystemMode"
              :class="[
                'px-3 py-2 rounded-md text-sm transition-colors',
                currentMode === 'system' 
                  ? 'bg-accent text-accent-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              ]"
            >
              🖥️ 系统
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="container mx-auto px-4 py-8 space-y-8">
      <!-- 🎨 颜色系统展示 -->
      <section class="space-y-6">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-bold">颜色系统展示</h2>
          <p class="text-muted-foreground">完整的语义化颜色系统，支持明暗模式无缝切换</p>
        </div>

        <!-- 主要颜色 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="space-y-3">
            <h3 class="font-semibold text-sm">主要颜色</h3>
            <div class="space-y-2">
              <div class="bg-primary text-primary-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Primary</div>
                <div class="text-xs opacity-80">主要按钮</div>
              </div>
              <div class="bg-secondary text-secondary-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Secondary</div>
                <div class="text-xs opacity-80">次要按钮</div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <h3 class="font-semibold text-sm">状态颜色</h3>
            <div class="space-y-2">
              <div class="bg-success text-success-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Success</div>
                <div class="text-xs opacity-80">成功状态</div>
              </div>
              <div class="bg-destructive text-destructive-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Destructive</div>
                <div class="text-xs opacity-80">危险操作</div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <h3 class="font-semibold text-sm">扩展颜色</h3>
            <div class="space-y-2">
              <div class="bg-warning text-warning-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Warning</div>
                <div class="text-xs opacity-80">警告提示</div>
              </div>
              <div class="bg-info text-info-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Info</div>
                <div class="text-xs opacity-80">信息提示</div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <h3 class="font-semibold text-sm">界面颜色</h3>
            <div class="space-y-2">
              <div class="bg-muted text-muted-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Muted</div>
                <div class="text-xs opacity-80">静音背景</div>
              </div>
              <div class="bg-accent text-accent-foreground p-4 rounded-lg text-center">
                <div class="font-medium">Accent</div>
                <div class="text-xs opacity-80">强调色</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 🎛️ 主题管理 -->
      <section class="space-y-6">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-bold">主题管理</h2>
          <p class="text-muted-foreground">导入导出、自定义主题等高级功能</p>
        </div>

        <div class="bg-card border border-border rounded-lg p-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <!-- 🎯 导出按钮 -->
            <button 
              @click="handleExportTheme"
              class="flex flex-col items-center gap-2 p-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <span class="text-2xl">📤</span>
              <span class="text-sm font-medium">导出主题</span>
            </button>

            <!-- 导入主题文件 -->
            <label class="flex flex-col items-center gap-2 p-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer">
              <span class="text-2xl">📥</span>
              <span class="text-sm font-medium">导入主题</span>
              <input 
                type="file" 
                accept=".json"
                @change="handleFileImport"
                class="hidden"
              >
            </label>

            <!-- 加载外部主题 -->
            <button 
              @click="showExternalDialog = true"
              class="flex flex-col items-center gap-2 p-4 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-colors"
            >
              <span class="text-2xl">🌐</span>
              <span class="text-sm font-medium">外部主题</span>
            </button>

            <!-- 创建自定义主题 -->
            <button 
              @click="showCreateDialog = true"
              class="flex flex-col items-center gap-2 p-4 bg-success text-success-foreground rounded-lg hover:bg-success/90 transition-colors"
            >
              <span class="text-2xl">✨</span>
              <span class="text-sm font-medium">创建主题</span>
            </button>
          </div>

          <!-- 自定义主题列表 -->
          <div v-if="customThemes && customThemes.length > 0" class="space-y-3">
            <h3 class="text-lg font-semibold">自定义主题</h3>
            <div class="grid gap-3">
              <div 
                v-for="theme in customThemes" 
                :key="theme.id"
                class="flex items-center justify-between p-4 bg-muted rounded-lg"
              >
                <div class="space-y-1">
                  <div class="font-medium">{{ theme.name }}</div>
                  <div class="text-sm text-muted-foreground">
                    {{ theme.description }} • {{ theme.source }} • {{ formatDate(theme.updatedAt) }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button 
                    @click="setTheme(theme.id)"
                    class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    应用
                  </button>
                  <button 
                    @click="deleteCustomTheme(theme.id)"
                    class="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 📊 主题信息 -->
      <section class="space-y-6">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-bold">主题信息</h2>
          <p class="text-muted-foreground">当前主题的详细配置信息</p>
        </div>

        <div class="bg-card border border-border rounded-lg p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- 主题基本信息 -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold">基本信息</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">主题名称：</span>
                  <span>{{ getThemeName(currentPreset) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">主题 ID：</span>
                  <span class="font-mono">{{ currentPreset }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">当前模式：</span>
                  <span>{{ resolvedMode === 'dark' ? '暗色模式' : '亮色模式' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">模式设置：</span>
                  <span>{{ getModeText(currentMode) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">系统偏好：</span>
                  <span>{{ systemPreference === 'dark' ? '暗色' : '亮色' }}</span>
                </div>
              </div>
            </div>

            <!-- CSS 变量预览 -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold">CSS 变量预览</h3>
              <div class="bg-muted p-4 rounded text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
                <div>--color-background: <span class="text-primary">{{ getCSSVariable('--color-background') }}</span></div>
                <div>--color-foreground: <span class="text-primary">{{ getCSSVariable('--color-foreground') }}</span></div>
                <div>--color-primary: <span class="text-primary">{{ getCSSVariable('--color-primary') }}</span></div>
                <div>--color-secondary: <span class="text-primary">{{ getCSSVariable('--color-secondary') }}</span></div>
                <div>--color-success: <span class="text-primary">{{ getCSSVariable('--color-success') }}</span></div>
                <div>--color-warning: <span class="text-primary">{{ getCSSVariable('--color-warning') }}</span></div>
                <div>--color-destructive: <span class="text-primary">{{ getCSSVariable('--color-destructive') }}</span></div>
                <div>--color-info: <span class="text-primary">{{ getCSSVariable('--color-info') }}</span></div>
                <div>--radius: <span class="text-primary">{{ getCSSVariable('--radius') }}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 🌐 外部主题对话框 -->
    <div v-if="showExternalDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-card border border-border rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold mb-4">加载外部主题</h3>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium">主题包 URL</label>
            <input 
              v-model="externalUrl"
              type="url"
              placeholder="https://example.com/theme.json"
              class="w-full mt-1 px-3 py-2 bg-background border border-input rounded focus:ring-2 focus:ring-ring outline-none"
            >
          </div>
          <div class="text-xs text-muted-foreground">
            支持从 GitHub、CDN 或其他 URL 加载主题包
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button 
            @click="handleExternalLoad"
            :disabled="!externalUrl || isLoading"
            class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ isLoading ? '加载中...' : '加载主题' }}
          </button>
          <button 
            @click="showExternalDialog = false"
            class="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- ✨ 创建主题对话框 -->
    <div v-if="showCreateDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-card border border-border rounded-lg p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold mb-4">创建自定义主题</h3>
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium">主题名称</label>
            <input 
              v-model="newThemeName"
              type="text"
              placeholder="我的自定义主题"
              class="w-full mt-1 px-3 py-2 bg-background border border-input rounded focus:ring-2 focus:ring-ring outline-none"
            >
          </div>
          <div>
            <label class="text-sm font-medium">基于主题</label>
            <select 
              v-model="baseThemeId"
              class="w-full mt-1 px-3 py-2 bg-background border border-input rounded focus:ring-2 focus:ring-ring outline-none"
            >
              <option value="default">Slate 主题</option>
              <option value="bilibili">Bilibili 主题</option>
              <option value="notion">Notion 主题</option>
            </select>
          </div>
          <div class="text-xs text-muted-foreground">
            将基于选择的主题创建一个副本，你可以稍后进行自定义
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button 
            @click="handleCreateTheme"
            :disabled="!newThemeName.trim()"
            class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            创建主题
          </button>
          <button 
            @click="showCreateDialog = false"
            class="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 🚨 错误提示 -->
    <div v-if="error" class="fixed bottom-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg max-w-sm">
      <div class="flex items-start gap-2">
        <span class="text-lg">❌</span>
        <div>
          <div class="font-medium">操作失败</div>
          <div class="text-sm opacity-90">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- ✅ 成功提示 -->
    <div v-if="successMessage" class="fixed bottom-4 right-4 bg-success text-success-foreground p-4 rounded-lg shadow-lg max-w-sm">
      <div class="flex items-start gap-2">
        <span class="text-lg">✅</span>
        <div>
          <div class="font-medium">操作成功</div>
          <div class="text-sm opacity-90">{{ successMessage }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@juanie/ui'
import { usePreferredColorScheme } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

// 🎯 安全的主题管理 - 不直接解构，而是保持引用
const theme = useTheme()
console.log(theme, 11)
// 🎯 安全的计算属性包装
const currentPreset = computed(() => theme.currentPreset?.value || 'default')
const currentMode = computed(() => theme.currentMode?.value || 'system')
const customThemes = computed(() => theme.customThemes?.value || [])
const resolvedMode = computed(() => theme.resolvedMode?.value || 'light')
const isDark = computed(() => theme.isDark?.value || false)
const isLoading = computed(() => theme.isLoading?.value || false)
const error = computed(() => theme.error?.value || null)

// 🎯 安全的方法访问
const setTheme = (presetName: string, mode?: string) => {
  if (theme.setTheme && typeof theme.setTheme === 'function') {
    theme.setTheme(presetName, mode as any)
  } else {
    console.warn('setTheme not available')
  }
}

const toggleMode = () => {
  if (theme.toggleMode && typeof theme.toggleMode === 'function') {
    theme.toggleMode()
  } else {
    console.warn('toggleMode not available')
  }
}

const clearError = () => {
  if (theme.clearError && typeof theme.clearError === 'function') {
    theme.clearError()
  } else {
    console.warn('clearError not available')
  }
}

const exportThemeAsFile = () => {
  if (theme.exportThemeAsFile && typeof theme.exportThemeAsFile === 'function') {
    return theme.exportThemeAsFile()
  } else {
    console.warn('exportThemeAsFile not available')
    return false
  }
}

const importThemeFromFile = async (file: File) => {
  if (theme.importThemeFromFile && typeof theme.importThemeFromFile === 'function') {
    return await theme.importThemeFromFile(file)
  } else {
    console.warn('importThemeFromFile not available')
    return false
  }
}

const loadExternalTheme = async (url: string) => {
  if (theme.loadExternalTheme && typeof theme.loadExternalTheme === 'function') {
    return await theme.loadExternalTheme(url)
  } else {
    console.warn('loadExternalTheme not available')
    return false
  }
}

const deleteCustomTheme = (themeId: string) => {
  if (theme.deleteCustomTheme && typeof theme.deleteCustomTheme === 'function') {
    return theme.deleteCustomTheme(themeId)
  } else {
    console.warn('deleteCustomTheme not available')
    return false
  }
}

const createCustomTheme = (baseThemeId: string, customName: string) => {
  console.log(theme)
  return theme.createCustomTheme(baseThemeId, customName)

  // if (theme.createCustomTheme && typeof theme.createCustomTheme === 'function') {
  //   return theme.createCustomTheme(baseThemeId, customName)
  // } else {
  //   console.warn('createCustomTheme not available')
  //   return ''
  // }
}

// 系统偏好
const systemPreference = usePreferredColorScheme()

// 对话框状态
const showExternalDialog = ref(false)
const showCreateDialog = ref(false)
const externalUrl = ref('')
const newThemeName = ref('')
const baseThemeId = ref('default')
const successMessage = ref('')

// 🎯 修复导出功能
const handleExportTheme = () => {
  console.log('🎯 Export theme called')

  try {
    const result = exportThemeAsFile()
    console.log('Export result:', result)
    if (result) {
      showSuccessMessage('主题导出成功！')
    } else {
      showSuccessMessage('导出失败，请检查控制台')
    }
  } catch (e) {
    console.error('Export failed:', e)
    showSuccessMessage(`导出失败：${e instanceof Error ? e.message : String(e)}`)
  }
}

// 🎯 修复事件处理器的类型安全
const handleThemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  if (target?.value) {
    setTheme(target.value)
  }
}

// 🎯 修复：使用安全的方法调用
const setSystemMode = () => {
  setTheme(currentPreset.value, 'system')
}

// 🎯 修复主题名称映射 - 完全安全的访问
const getThemeName = (themeId: string): string => {
  const themeNames: Record<string, string> = {
    default: 'Slate 主题',
    bilibili: 'Bilibili 主题',
    notion: 'Notion 主题',
  }

  // 🎯 完全安全的访问方式
  try {
    const themes = customThemes.value
    if (themes && Array.isArray(themes)) {
      const customTheme = themes.find((t: any) => t?.id === themeId)
      if (customTheme?.name) {
        return customTheme.name
      }
    }
  } catch (e) {
    console.warn('Error accessing custom themes:', e)
  }

  return themeNames[themeId] || themeId
}

// 🎯 修复模式文本映射的类型安全
const getModeText = (mode: string): string => {
  const modeTexts: Record<string, string> = {
    light: '亮色模式',
    dark: '暗色模式',
    system: '跟随系统',
  }
  return modeTexts[mode] || mode
}

// 获取 CSS 变量值
const getCSSVariable = (varName: string) => {
  if (typeof window !== 'undefined') {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    } catch (e) {
      return ''
    }
  }
  return ''
}

// 格式化日期
const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleDateString('zh-CN')
  } catch (e) {
    return ''
  }
}

// 处理文件导入
const handleFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target?.files?.[0]
  if (file) {
    try {
      const success = await importThemeFromFile(file)
      if (success) {
        showSuccessMessage('主题导入成功！')
      }
    } catch (e) {
      console.error('Import failed:', e)
    }
  }
}

// 处理外部主题加载
const handleExternalLoad = async () => {
  if (externalUrl.value) {
    try {
      const success = await loadExternalTheme(externalUrl.value)
      if (success) {
        showExternalDialog.value = false
        externalUrl.value = ''
        showSuccessMessage('外部主题加载成功！')
      }
    } catch (e) {
      console.error('External load failed:', e)
    }
  }
}

// 处理创建主题
const handleCreateTheme = () => {
  if (newThemeName.value.trim()) {
    try {
      const themeId = createCustomTheme(baseThemeId.value, newThemeName.value.trim())
      if (themeId) {
        setTheme(themeId)
        showCreateDialog.value = false
        newThemeName.value = ''
        showSuccessMessage('自定义主题创建成功！')
      }
    } catch (e) {
      console.error('Create theme failed:', e)
      showSuccessMessage('创建主题失败：' + (e instanceof Error ? e.message : String(e)))
    }
  }
}

// 显示成功消息
const showSuccessMessage = (message: string) => {
  successMessage.value = message
  setTimeout(() => {
    successMessage.value = ''
  }, 3000)
}

// 🎯 修复错误处理：安全的 watch
watch(
  () => error.value,
  (newError) => {
    if (newError) {
      setTimeout(() => {
        try {
          clearError()
        } catch (e) {
          console.warn('Clear error failed:', e)
        }
      }, 5000)
    }
  },
  { immediate: false },
)

// 页面标题
onMounted(() => {
  document.title = 'Juanie 主题系统演示'

  // 🎯 调试：检查主题对象
  console.log('🔍 Theme object check:')
  console.log('theme:', theme)
  console.log('theme.setTheme:', typeof theme.setTheme)
  console.log('theme.createCustomTheme:', typeof theme.createCustomTheme)
  console.log('theme.exportThemeAsFile:', typeof theme.exportThemeAsFile)
})
</script>

<style scoped>
/* 自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: oklch(var(--color-muted));
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: oklch(var(--color-muted-foreground));
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: oklch(var(--color-foreground));
}
</style>