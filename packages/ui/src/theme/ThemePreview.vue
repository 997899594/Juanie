<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from './composable'

const { themes, currentTheme, setTheme, mode, toggleMode, isDark } = useTheme()

// 颜色变量列表
const colorVariables = [
  { name: '背景色', var: '--background', category: 'base' },
  { name: '前景色', var: '--foreground', category: 'base' },
  { name: '主色', var: '--primary', category: 'brand' },
  { name: '主色前景', var: '--primary-foreground', category: 'brand' },
  { name: '次要色', var: '--secondary', category: 'brand' },
  { name: '次要色前景', var: '--secondary-foreground', category: 'brand' },
  { name: '强调色', var: '--accent', category: 'interactive' },
  { name: '强调色前景', var: '--accent-foreground', category: 'interactive' },
  { name: '静音色', var: '--muted', category: 'neutral' },
  { name: '静音色前景', var: '--muted-foreground', category: 'neutral' },
  { name: '卡片背景', var: '--card', category: 'surface' },
  { name: '卡片前景', var: '--card-foreground', category: 'surface' },
  { name: '边框色', var: '--border', category: 'border' },
  { name: '输入框背景', var: '--input', category: 'interactive' },
  { name: '焦点环', var: '--ring', category: 'interactive' },
  { name: '成功色', var: '--success', category: 'feedback' },
  { name: '警告色', var: '--warning', category: 'feedback' },
  { name: '信息色', var: '--info', category: 'feedback' },
  { name: '危险色', var: '--destructive', category: 'feedback' },
]

// 按类别分组
const groupedColors = computed(() => {
  const groups: Record<string, typeof colorVariables> = {}
  colorVariables.forEach((color) => {
    if (!groups[color.category]) {
      groups[color.category] = []
    }
    groups[color.category].push(color)
  })
  return groups
})

const categoryNames: Record<string, string> = {
  base: '基础色',
  brand: '品牌色',
  interactive: '交互色',
  neutral: '中性色',
  surface: '表面色',
  border: '边框色',
  feedback: '反馈色',
}

// 获取 CSS 变量值
function getCSSVariable(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}
</script>

<template>
  <div class="theme-preview">
    <!-- 主题选择器 -->
    <div class="theme-selector">
      <div class="selector-header">
        <h2>主题预览</h2>
        <div class="controls">
          <select
            :value="currentTheme?.id"
            @change="setTheme(($event.target as HTMLSelectElement).value)"
            class="theme-select"
          >
            <option v-for="theme in themes" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
          <button @click="toggleMode" class="mode-toggle">
            <span v-if="isDark">🌙 深色</span>
            <span v-else>☀️ 浅色</span>
          </button>
        </div>
      </div>

      <!-- 当前主题信息 -->
      <div class="theme-info">
        <div class="info-item">
          <span class="label">当前主题:</span>
          <span class="value">{{ currentTheme?.name }}</span>
        </div>
        <div class="info-item">
          <span class="label">主题 ID:</span>
          <span class="value">{{ currentTheme?.id }}</span>
        </div>
        <div class="info-item">
          <span class="label">模式:</span>
          <span class="value">{{ mode }}</span>
        </div>
      </div>
    </div>

    <!-- 颜色面板 -->
    <div class="color-palette">
      <div v-for="(colors, category) in groupedColors" :key="category" class="color-category">
        <h3 class="category-title">{{ categoryNames[category] }}</h3>
        <div class="color-grid">
          <div v-for="color in colors" :key="color.var" class="color-item">
            <div
              class="color-swatch"
              :style="{ background: `var(${color.var})` }"
              :title="getCSSVariable(color.var)"
            />
            <div class="color-info">
              <span class="color-name">{{ color.name }}</span>
              <code class="color-var">{{ color.var }}</code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 组件预览 -->
    <div class="component-preview">
      <h3>组件预览</h3>
      <div class="preview-grid">
        <!-- 按钮 -->
        <div class="preview-section">
          <h4>按钮</h4>
          <div class="preview-content">
            <button class="btn btn-primary">Primary</button>
            <button class="btn btn-secondary">Secondary</button>
            <button class="btn btn-destructive">Destructive</button>
            <button class="btn btn-outline">Outline</button>
            <button class="btn btn-ghost">Ghost</button>
          </div>
        </div>

        <!-- 卡片 -->
        <div class="preview-section">
          <h4>卡片</h4>
          <div class="preview-content">
            <div class="card">
              <div class="card-header">
                <h5>Card Title</h5>
                <p>Card description</p>
              </div>
              <div class="card-content">
                <p>This is a card component with some content.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="preview-section">
          <h4>输入框</h4>
          <div class="preview-content">
            <input type="text" placeholder="Enter text..." class="input" />
            <input type="text" placeholder="Disabled" class="input" disabled />
          </div>
        </div>

        <!-- 徽章 -->
        <div class="preview-section">
          <h4>徽章</h4>
          <div class="preview-content">
            <span class="badge badge-default">Default</span>
            <span class="badge badge-secondary">Secondary</span>
            <span class="badge badge-destructive">Destructive</span>
            <span class="badge badge-outline">Outline</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-preview {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* 主题选择器 */
.theme-selector {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.selector-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
}

.controls {
  display: flex;
  gap: 0.75rem;
}

.theme-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
  color: var(--foreground);
  font-size: 0.875rem;
  cursor: pointer;
}

.mode-toggle {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
  color: var(--foreground);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle:hover {
  background: var(--accent);
}

.theme-info {
  display: flex;
  gap: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.info-item {
  display: flex;
  gap: 0.5rem;
}

.info-item .label {
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.info-item .value {
  color: var(--foreground);
  font-weight: 500;
  font-size: 0.875rem;
}

/* 颜色面板 */
.color-palette {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 2rem;
}

.color-category {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.category-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 1rem 0;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.color-swatch {
  width: 3rem;
  height: 3rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border);
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.color-name {
  font-size: 0.875rem;
  color: var(--foreground);
  font-weight: 500;
}

.color-var {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 组件预览 */
.component-preview {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.component-preview > h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 1.5rem 0;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.preview-section {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
}

.preview-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 1rem 0;
}

.preview-content {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* 简单的组件样式 */
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

.btn-ghost {
  background: transparent;
  color: var(--foreground);
}

.btn:hover {
  opacity: 0.9;
}

.card {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  color: var(--card-foreground);
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.card-header h5 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.card-header p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.card-content {
  padding: 1rem;
}

.card-content p {
  margin: 0;
  font-size: 0.875rem;
}

.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--input);
  color: var(--foreground);
  font-size: 0.875rem;
  width: 100%;
}

.input:focus {
  outline: none;
  ring: 2px solid var(--ring);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-default {
  background: var(--primary);
  color: var(--primary-foreground);
}

.badge-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.badge-destructive {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.badge-outline {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
}

@media (max-width: 768px) {
  .theme-preview {
    padding: 1rem;
  }

  .selector-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .theme-info {
    flex-direction: column;
    gap: 0.5rem;
  }

  .color-grid {
    grid-template-columns: 1fr;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
