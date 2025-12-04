# 设计系统规则

本文档定义了项目的设计系统规则，用于指导 Figma 设计到代码的转换。

## 1. 设计 Token 定义

### 颜色系统

项目使用 CSS 变量定义颜色 token，支持多主题切换（默认、Bilibili、GitHub）。

**位置**: `packages/ui/src/styles/globals.css`

**格式**: CSS 变量 + OKLCH 色彩空间

```css
:root {
  /* 基础色 */
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  
  /* 语义色 */
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --destructive: oklch(0.577 0.245 27.325);
  
  /* 功能色 */
  --success: oklch(0.64 0.15 142);
  --warning: oklch(0.75 0.15 85);
  --info: oklch(0.6 0.15 250);
  
  /* 边框和输入 */
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);
}
```

**Tailwind 使用**:
```vue
<div class="bg-background text-foreground">
<button class="bg-primary text-primary-foreground">
<div class="border-border">
```

### 间距系统

使用 Tailwind 默认间距 + 自定义工具类：

```css
.spacing-xs { padding: 0.5rem; }   /* 8px */
.spacing-sm { padding: 0.75rem; }  /* 12px */
.spacing-md { padding: 1rem; }     /* 16px */
.spacing-lg { padding: 1.5rem; }   /* 24px */
.spacing-xl { padding: 2rem; }     /* 32px */
```

### 圆角系统

```css
--radius: 0.625rem; /* 10px - 默认圆角 */
```

Tailwind 类: `rounded-[--radius]`

### 字体系统

使用系统默认字体栈，支持中英文：

```css
body {
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

## 2. 组件库

### 组件位置

- **UI 组件库**: `packages/ui/src/components/ui/`
- **应用组件**: `apps/web/src/components/`

### 组件架构

基于 **shadcn-vue** + **Radix Vue** / **Reka UI**

**命名约定**:
- 组件文件: PascalCase (例如: `Button.vue`, `Card.vue`)
- 组件目录: kebab-case (例如: `button/`, `card/`)

**组件结构**:
```
packages/ui/src/components/ui/button/
├── Button.vue          # 主组件
├── index.ts            # 导出
└── button.variants.ts  # 样式变体 (可选)
```

### 可用组件列表

基础组件:
- Button, Badge, Avatar, Card, Input, Textarea, Label
- Select, Checkbox, Radio Group, Switch, Slider
- Dialog, Sheet, Drawer, Popover, Tooltip
- Table, Tabs, Accordion, Collapsible
- Alert, Toast (Sonner), Progress, Skeleton
- Sidebar, Navigation Menu, Breadcrumb

数据展示:
- Chart (Area, Bar, Line, Donut)
- Empty State, Pagination

表单:
- Form (基于 vee-validate + zod)
- Field, Input Group, Number Field, Pin Input
- Tags Input, Combobox, Command

### 组件导入

```typescript
// 从 UI 包导入
import { Button, Card, Input } from '@juanie/ui'

// 或单独导入
import { Button } from '@juanie/ui/components/ui/button'
```

## 3. 框架和库

### UI 框架

- **Vue 3** (Composition API)
- **TypeScript** (严格模式)

### 样式框架

- **Tailwind CSS 4** (最新版本)
- **CSS 变量** (主题系统)
- **OKLCH 色彩空间** (现代色彩)

### 构建系统

- **Vite 7** (开发和构建)
- **Bun** (包管理和运行时)
- **Turborepo** (Monorepo 管理)

### 状态管理

- **Pinia** (带持久化)
- **@vueuse/core** (组合式工具)

### 动画

- **@vueuse/motion** (Vue 动画)
- **tw-animate-css** (Tailwind 动画扩展)

## 4. 资源管理

### 图片和媒体

**存储位置**:
- 静态资源: `apps/web/public/`
- 组件内资源: `apps/web/src/assets/`

**引用方式**:
```vue
<!-- 公共资源 -->
<img src="/logo.png" alt="Logo">

<!-- 组件资源 -->
<img :src="logoUrl" alt="Logo">
<script setup>
import logoUrl from '@/assets/logo.png'
</script>
```

### 资源优化

- Vite 自动处理图片优化
- 支持 WebP 格式
- 懒加载图片使用 `loading="lazy"`

## 5. 图标系统

### 图标库

**lucide-vue-next** - 现代化图标库

**使用方式**:
```vue
<script setup lang="ts">
import { Plus, Trash, Edit } from 'lucide-vue-next'
</script>

<template>
  <Plus :size="16" />
  <Trash :size="20" class="text-destructive" />
  <Edit :size="24" :stroke-width="1.5" />
</template>
```

### 图标规范

- 默认大小: 20px
- 小图标: 16px
- 大图标: 24px
- 描边宽度: 1.5-2

## 6. 样式方法

### CSS 方法论

**Utility-First** (Tailwind CSS)

```vue
<template>
  <div class="flex items-center gap-4 p-4 rounded-lg bg-card">
    <Button class="bg-primary hover:bg-primary/90">
      点击
    </Button>
  </div>
</template>
```

### 全局样式

**位置**: `packages/ui/src/styles/globals.css`

包含:
- CSS 变量定义
- 主题切换
- 基础样式重置
- 滚动条样式
- 动画定义

### 响应式设计

使用 Tailwind 响应式前缀:

```vue
<div class="
  w-full 
  md:w-1/2 
  lg:w-1/3
  p-4 
  md:p-6 
  lg:p-8
">
```

断点:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 7. 项目结构

### Monorepo 组织

```
apps/
  web/                    # Vue 3 前端应用
    src/
      components/         # 应用特定组件
      views/              # 页面组件
      composables/        # 组合式函数
      stores/             # Pinia 状态
      router/             # 路由配置

packages/
  ui/                     # UI 组件库
    src/
      components/ui/      # shadcn-vue 组件
      styles/             # 全局样式
  types/                  # 类型定义
```

### 组件组织模式

**按功能分组**:
```
apps/web/src/components/
├── ProjectCard.vue
├── ProjectWizard.vue
├── CreateProjectModal.vue
├── GitAuthSelector.vue
└── RepositoryConfig.vue
```

## 8. Figma 到代码转换规则

### 转换原则

1. **保持视觉一致性**: 1:1 还原 Figma 设计
2. **使用设计 Token**: 优先使用 CSS 变量而非硬编码
3. **复用组件**: 使用现有 shadcn-vue 组件
4. **语义化 HTML**: 使用正确的 HTML 标签
5. **可访问性**: 添加 ARIA 属性和键盘支持

### 颜色映射

Figma 颜色 → CSS 变量:

| Figma 颜色名 | CSS 变量 | Tailwind 类 |
|------------|---------|------------|
| Primary | `--primary` | `bg-primary` |
| Secondary | `--secondary` | `bg-secondary` |
| Background | `--background` | `bg-background` |
| Foreground | `--foreground` | `text-foreground` |
| Border | `--border` | `border-border` |
| Destructive | `--destructive` | `bg-destructive` |

### 间距映射

Figma 间距 → Tailwind 类:

| Figma | Tailwind | 像素值 |
|-------|----------|--------|
| 4px | `p-1` | 4px |
| 8px | `p-2` | 8px |
| 12px | `p-3` | 12px |
| 16px | `p-4` | 16px |
| 24px | `p-6` | 24px |
| 32px | `p-8` | 32px |

### 组件映射

Figma 组件 → Vue 组件:

| Figma 组件 | Vue 组件 | 导入路径 |
|-----------|---------|---------|
| Button | `Button` | `@juanie/ui` |
| Input | `Input` | `@juanie/ui` |
| Card | `Card` | `@juanie/ui` |
| Dialog | `Dialog` | `@juanie/ui` |
| Select | `Select` | `@juanie/ui` |
| Checkbox | `Checkbox` | `@juanie/ui` |

### 转换示例

**Figma 设计** → **Vue 代码**:

```vue
<script setup lang="ts">
import { Button, Card, CardHeader, CardTitle, CardContent } from '@juanie/ui'
import { Plus } from 'lucide-vue-next'
</script>

<template>
  <Card class="w-full max-w-md">
    <CardHeader>
      <CardTitle>项目列表</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <Button class="w-full">
        <Plus :size="16" class="mr-2" />
        创建项目
      </Button>
    </CardContent>
  </Card>
</template>
```

### 交互状态

Figma 状态 → Tailwind 类:

```vue
<!-- Hover -->
<button class="hover:bg-primary/90">

<!-- Focus -->
<input class="focus:ring-2 focus:ring-ring">

<!-- Active -->
<button class="active:scale-95">

<!-- Disabled -->
<button :disabled="true" class="disabled:opacity-50">
```

## 9. 最佳实践

### 组件开发

1. **使用 Composition API**
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>
```

2. **类型安全**
```vue
<script setup lang="ts">
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})
</script>
```

3. **组合式函数**
```typescript
// composables/useProjects.ts
export function useProjects() {
  const projects = ref<Project[]>([])
  
  async function fetchProjects() {
    // ...
  }
  
  return { projects, fetchProjects }
}
```

### 样式规范

1. **优先使用 Tailwind 类**
2. **避免内联样式**
3. **使用 CSS 变量实现主题**
4. **保持类名简洁有序**

### 可访问性

1. **语义化标签**: 使用 `<button>`, `<nav>`, `<main>` 等
2. **ARIA 属性**: 添加 `aria-label`, `aria-describedby` 等
3. **键盘导航**: 确保所有交互元素可键盘访问
4. **焦点管理**: 使用 `focus-visible:` 样式

## 10. 工具和命令

### 开发命令

```bash
# 启动开发服务器
bun run dev

# 构建 UI 包
bun run build --filter='@juanie/ui'

# 类型检查
bun run type-check

# 代码格式化
biome check --write
```

### 组件生成

参考现有组件结构手动创建，或使用 shadcn-vue CLI:

```bash
# 添加新组件
npx shadcn-vue@latest add [component-name]
```

## 相关资源

- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [shadcn-vue 文档](https://www.shadcn-vue.com/)
- [Radix Vue 文档](https://www.radix-vue.com/)
- [Lucide Icons](https://lucide.dev/)
- [OKLCH 色彩空间](https://oklch.com/)
