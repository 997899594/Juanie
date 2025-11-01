# @juanie/ui

基于 shadcn-vue 的现代化 Vue 3 组件库，提供完整的主题系统和丰富的 UI 组件。

## 📦 特性

- 🎨 **多主题支持** - 内置 Default、GitHub、Bilibili 三套主题
- 🌓 **深色模式** - 完整的深色模式支持
- 🎯 **类型安全** - 完整的 TypeScript 类型定义
- 📱 **响应式设计** - 移动端友好
- ♿ **可访问性** - 遵循 WCAG 标准
- 🚀 **高性能** - 基于 Radix Vue 和 Reka UI
- 🎭 **动画效果** - 流畅的过渡动画
- 🔧 **可定制** - 基于 CSS 变量的主题系统

## 📚 组件列表

### 基础组件
- **Button** - 按钮
- **Input** - 输入框
- **Textarea** - 文本域
- **Label** - 标签
- **Badge** - 徽章
- **Avatar** - 头像
- **Separator** - 分隔线
- **Skeleton** - 骨架屏
- **Spinner** - 加载动画
- **Kbd** - 键盘按键

### 表单组件
- **Form** - 表单（集成 vee-validate）
- **Field** - 表单字段
- **Checkbox** - 复选框
- **Radio Group** - 单选框组
- **Select** - 选择器
- **Combobox** - 组合框
- **Switch** - 开关
- **Slider** - 滑块
- **Number Field** - 数字输入
- **Pin Input** - PIN 码输入
- **Tags Input** - 标签输入

### 数据展示
- **Table** - 表格（集成 @tanstack/vue-table）
- **Card** - 卡片
- **Empty** - 空状态
- **Chart** - 图表（集成 @unovis）
  - Chart Area - 面积图
  - Chart Bar - 柱状图
  - Chart Line - 折线图
  - Chart Donut - 环形图

### 导航组件
- **Tabs** - 标签页
- **Breadcrumb** - 面包屑
- **Pagination** - 分页
- **Navigation Menu** - 导航菜单
- **Menubar** - 菜单栏
- **Sidebar** - 侧边栏
- **Stepper** - 步骤条

### 反馈组件
- **Alert** - 警告提示
- **Alert Dialog** - 警告对话框
- **Dialog** - 对话框
- **Drawer** - 抽屉
- **Sheet** - 侧边面板
- **Popover** - 弹出框
- **Tooltip** - 工具提示
- **Hover Card** - 悬浮卡片
- **Sonner** - Toast 通知
- **Progress** - 进度条

### 布局组件
- **Accordion** - 折叠面板
- **Collapsible** - 可折叠容器
- **Resizable** - 可调整大小容器
- **Scroll Area** - 滚动区域
- **Aspect Ratio** - 宽高比容器
- **Carousel** - 轮播图

### 其他组件
- **Command** - 命令面板
- **Context Menu** - 右键菜单
- **Dropdown Menu** - 下拉菜单
- **Toggle** - 切换按钮
- **Toggle Group** - 切换按钮组
- **Calendar** - 日历
- **Range Calendar** - 日期范围选择
- **Button Group** - 按钮组
- **Input Group** - 输入框组
- **Item** - 列表项

## 🎨 主题系统

### 内置主题

#### 1. Default 主题
基于 Notion 风格的现代化主题，简洁优雅。

```typescript
import { useTheme } from '@juanie/ui'

const { setTheme } = useTheme()
setTheme('default')
```

#### 2. GitHub 主题
现代化的紫色渐变主题，科技感十足。

```typescript
setTheme('github')
```

**特色：**
- 紫色主色调
- 彩虹配色系统
- 赛博朋克风格深色模式
- 霓虹效果

#### 3. Bilibili 主题
B站官方配色主题，活力十足。

```typescript
setTheme('bilibili')
```

**特色：**
- B站官方蓝色 (#23ADE5)
- B站官方粉色 (#FB7299)
- 经典渐变效果
- 品牌色保持

### 主题切换

```vue
<script setup lang="ts">
import { useTheme } from '@juanie/ui'

const { themes, currentTheme, setTheme, toggleMode, isDark } = useTheme()
</script>

<template>
  <div>
    <!-- 主题选择 -->
    <select @change="setTheme($event.target.value)">
      <option v-for="theme in themes" :key="theme.id" :value="theme.id">
        {{ theme.name }}
      </option>
    </select>

    <!-- 深色模式切换 -->
    <button @click="toggleMode">
      {{ isDark ? '浅色' : '深色' }}
    </button>
  </div>
</template>
```

### 自定义主题

在 `globals.css` 中添加新主题：

```css
[data-theme="my-theme"] {
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.6 0.2 280);
  /* ... 其他变量 */
}

[data-theme="my-theme"].dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  /* ... 其他变量 */
}
```

在 `theme/types.ts` 中注册：

```typescript
export const THEMES: Theme[] = [
  // ... 现有主题
  { id: 'my-theme', name: '我的主题', modes: ['light', 'dark'] },
]
```

## 🚀 使用方法

### 安装

```bash
bun add @juanie/ui
```

### 导入样式

在你的应用入口文件中导入样式：

```typescript
// main.ts
import '@juanie/ui/styles'
```

### 使用组件

```vue
<script setup lang="ts">
import { Button, Card, Input } from '@juanie/ui'
</script>

<template>
  <Card>
    <Input placeholder="输入内容" />
    <Button>提交</Button>
  </Card>
</template>
```

### 使用主题

```vue
<script setup lang="ts">
import { useTheme } from '@juanie/ui'

const { setTheme, toggleMode, isDark } = useTheme()
</script>
```

## 🎯 CSS 变量

### 颜色变量

```css
--background          /* 背景色 */
--foreground          /* 前景色 */
--card                /* 卡片背景 */
--card-foreground     /* 卡片前景 */
--popover             /* 弹出框背景 */
--popover-foreground  /* 弹出框前景 */
--primary             /* 主色 */
--primary-foreground  /* 主色前景 */
--secondary           /* 次要色 */
--secondary-foreground /* 次要色前景 */
--muted               /* 静音色 */
--muted-foreground    /* 静音色前景 */
--accent              /* 强调色 */
--accent-foreground   /* 强调色前景 */
--destructive         /* 危险色 */
--destructive-foreground /* 危险色前景 */
--border              /* 边框色 */
--input               /* 输入框背景 */
--ring                /* 焦点环颜色 */
```

### 功能色变量

```css
--success             /* 成功色 */
--success-foreground  /* 成功色前景 */
--warning             /* 警告色 */
--warning-foreground  /* 警告色前景 */
--info                /* 信息色 */
--info-foreground     /* 信息色前景 */
```

### 交互式元素变量

```css
--surface-elevated    /* 提升表面 */
--outline             /* 轮廓色 */
--radius              /* 圆角大小 */
```

## 🔧 工具函数

### cn - 类名合并

```typescript
import { cn } from '@juanie/ui'

const className = cn(
  'base-class',
  condition && 'conditional-class',
  { 'object-class': true }
)
```

## 📱 响应式设计

所有组件都支持响应式设计，在移动端自动适配。

```css
@media (max-width: 768px) {
  /* 移动端样式 */
}
```

## ♿ 可访问性

- 支持键盘导航
- ARIA 属性完整
- 高对比度模式支持
- 减少动画模式支持

```css
@media (prefers-reduced-motion: reduce) {
  /* 减少动画 */
}

@media (prefers-contrast: high) {
  /* 高对比度 */
}
```

## 🎭 动画效果

内置多种动画效果：

```css
.animate-shimmer      /* 闪烁效果 */
.animate-pulse-glow   /* 脉冲发光 */
.animate-bounce-in    /* 弹入效果 */
```

## 📦 构建

```bash
# 开发模式
bun run dev

# 构建
bun run build

# 类型检查
bun run type-check
```

## 🔍 类型定义

完整的 TypeScript 类型定义：

```typescript
import type { Theme, ThemeMode, ThemeState } from '@juanie/ui'
```

## 📝 最佳实践

### 1. 主题切换

```vue
<script setup lang="ts">
import { useTheme } from '@juanie/ui'
import { watch } from 'vue'

const { setTheme, setMode } = useTheme()

// 监听系统主题变化
watch(
  () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  (isDark) => {
    setMode(isDark ? 'dark' : 'light')
  }
)
</script>
```

### 2. 组件组合

```vue
<template>
  <Card>
    <CardHeader>
      <CardTitle>标题</CardTitle>
      <CardDescription>描述</CardDescription>
    </CardHeader>
    <CardContent>
      <!-- 内容 -->
    </CardContent>
    <CardFooter>
      <Button>操作</Button>
    </CardFooter>
  </Card>
</template>
```

### 3. 表单验证

```vue
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

const schema = toTypedSchema(
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })
)

const { handleSubmit } = useForm({ validationSchema: schema })
</script>
```

## 🐛 已知问题

目前没有已知问题。

## 🗺️ 路线图

- [ ] 添加更多主题
- [ ] 添加主题编辑器
- [ ] 添加更多图表类型
- [ ] 添加移动端专用组件
- [ ] 添加国际化支持

## 📄 许可证

MIT

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](../../CONTRIBUTING.md)
