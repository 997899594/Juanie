<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTheme } from './composable'

const { currentTheme, mode } = useTheme()

// 颜色编辑器状态
interface ColorVariable {
  name: string
  var: string
  value: string
  category: string
}

const editableColors = ref<ColorVariable[]>([
  { name: '背景色', var: '--background', value: '', category: 'base' },
  { name: '前景色', var: '--foreground', value: '', category: 'base' },
  { name: '主色', var: '--primary', value: '', category: 'brand' },
  { name: '主色前景', var: '--primary-foreground', value: '', category: 'brand' },
  { name: '次要色', var: '--secondary', value: '', category: 'brand' },
  { name: '次要色前景', var: '--secondary-foreground', value: '', category: 'brand' },
  { name: '强调色', var: '--accent', value: '', category: 'interactive' },
  { name: '强调色前景', var: '--accent-foreground', value: '', category: 'interactive' },
  { name: '边框色', var: '--border', value: '', category: 'border' },
  { name: '成功色', var: '--success', value: '', category: 'feedback' },
  { name: '警告色', var: '--warning', value: '', category: 'feedback' },
  { name: '危险色', var: '--destructive', value: '', category: 'feedback' },
])

// 获取当前 CSS 变量值
function loadCurrentColors() {
  editableColors.value.forEach((color) => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(color.var)
      .trim()
    color.value = value
  })
}

// 初始化加载
loadCurrentColors()

// 监听主题变化，重新加载颜色
watch([currentTheme, mode], () => {
  loadCurrentColors()
})

// 更新 CSS 变量
function updateColor(varName: string, value: string) {
  document.documentElement.style.setProperty(varName, value)
}

// 重置为默认值
function resetColors() {
  editableColors.value.forEach((color) => {
    document.documentElement.style.removeProperty(color.var)
  })
  loadCurrentColors()
}

// 导出主题
function exportTheme() {
  const theme: Record<string, string> = {}
  editableColors.value.forEach((color) => {
    theme[color.var] = color.value
  })

  const css = Object.entries(theme)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  const themeCSS = `[data-theme="custom"] {\n${css}\n}`

  // 复制到剪贴板
  navigator.clipboard.writeText(themeCSS).then(() => {
    alert('主题 CSS 已复制到剪贴板！')
  })
}

// 导入主题
const importText = ref('')
function importTheme() {
  try {
    // 简单的 CSS 解析
    const matches = importText.value.matchAll(/--[\w-]+:\s*([^;]+);/g)
    for (const match of matches) {
      const [full, value] = match
      if (!full || !value) continue
      const varName = full.split(':')[0]?.trim()
      if (!varName) continue
      const color = editableColors.value.find((c) => c.var === varName)
      if (color && value) {
        color.value = value.trim()
        updateColor(varName, value.trim())
      }
    }
    importText.value = ''
    alert('主题导入成功！')
  } catch (error) {
    alert('导入失败，请检查 CSS 格式')
  }
}

// 按类别分组
const groupedColors = computed(() => {
  const groups: Record<string, ColorVariable[]> = {}
  editableColors.value.forEach((color) => {
    if (!groups[color.category]) {
      groups[color.category] = []
    }
    const group = groups[color.category]
    if (group) {
      group.push(color)
    }
  })
  return groups
})

const categoryNames: Record<string, string> = {
  base: '基础色',
  brand: '品牌色',
  interactive: '交互色',
  border: '边框色',
  feedback: '反馈色',
}

// OKLCH 转 Hex (简化版)
function oklchToHex(oklch: string): string {
  // 这里需要一个完整的颜色转换库
  // 暂时返回一个占位符
  return '#000000'
}

// Hex 转 OKLCH (简化版)
function hexToOklch(hex: string): string {
  // 这里需要一个完整的颜色转换库
  // 暂时返回一个占位符
  return 'oklch(0.5 0.1 180)'
}
</script>

<template>
  <div class="theme-editor">
    <div class="editor-header">
      <h2>主题编辑器</h2>
      <div class="header-actions">
        <button @click="resetColors" class="btn btn-outline">重置</button>
        <button @click="exportTheme" class="btn btn-primary">导出主题</button>
      </div>
    </div>

    <div class="editor-info">
      <p>
        <strong>提示：</strong>
        修改颜色后会实时预览效果。使用"导出主题"按钮可以将自定义主题复制到剪贴板。
      </p>
    </div>

    <!-- 颜色编辑器 -->
    <div class="color-editors">
      <div v-for="(colors, category) in groupedColors" :key="category" class="editor-section">
        <h3 class="section-title">{{ categoryNames[category] }}</h3>
        <div class="color-list">
          <div v-for="color in colors" :key="color.var" class="color-editor">
            <div class="color-preview" :style="{ background: color.value }" />
            <div class="color-controls">
              <label class="color-label">{{ color.name }}</label>
              <div class="input-group">
                <input
                  v-model="color.value"
                  @input="updateColor(color.var, color.value)"
                  type="text"
                  class="color-input"
                  :placeholder="color.var"
                />
                <code class="color-var">{{ color.var }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导入主题 -->
    <div class="import-section">
      <h3>导入主题</h3>
      <textarea
        v-model="importText"
        placeholder="粘贴主题 CSS 代码..."
        class="import-textarea"
        rows="6"
      />
      <button @click="importTheme" class="btn btn-primary">导入</button>
    </div>

    <!-- 实时预览 -->
    <div class="preview-section">
      <h3>实时预览</h3>
      <div class="preview-content">
        <div class="preview-card">
          <h4>卡片标题</h4>
          <p>这是一个卡片组件，用于预览主题效果。</p>
          <div class="preview-buttons">
            <button class="btn btn-primary">主要按钮</button>
            <button class="btn btn-secondary">次要按钮</button>
            <button class="btn btn-destructive">危险按钮</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-editor {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.editor-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.editor-info {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 2rem;
}

.editor-info p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.color-editors {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 2rem;
}

.editor-section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 1rem 0;
}

.color-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.color-editor {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
}

.color-preview {
  width: 3rem;
  height: 3rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.color-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.color-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
}

.input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.color-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--input);
  color: var(--foreground);
  font-size: 0.875rem;
  font-family: monospace;
}

.color-var {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  font-family: monospace;
  white-space: nowrap;
}

.import-section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.import-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 1rem 0;
}

.import-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--input);
  color: var(--foreground);
  font-size: 0.875rem;
  font-family: monospace;
  resize: vertical;
  margin-bottom: 1rem;
}

.preview-section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.preview-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 1rem 0;
}

.preview-content {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
}

.preview-card {
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
}

.preview-card h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 0.5rem 0;
}

.preview-card p {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0 0 1rem 0;
}

.preview-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.btn-destructive {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.btn-outline {
  border-color: var(--border);
  background: transparent;
  color: var(--foreground);
}

.btn:hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .theme-editor {
    padding: 1rem;
  }

  .editor-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .color-editor {
    flex-direction: column;
    align-items: flex-start;
  }

  .color-preview {
    width: 100%;
    height: 4rem;
  }
}
</style>
