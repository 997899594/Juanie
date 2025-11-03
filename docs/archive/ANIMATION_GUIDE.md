# 动画和横切关注点使用指南

本文档说明如何在所有页面中统一应用横切关注点（动画、响应式、主题、性能优化、错误处理）。

## 📦 可复用组件和组合式函数

### 1. `usePageTransition` - 页面动画组合式函数

提供统一的页面动画配置，自动处理性能优化（大列表禁用动画）。

```typescript
import { usePageTransition } from '@/composables/usePageTransition'

const animations = usePageTransition({
  disabled: false,        // 是否禁用动画
  baseDelay: 100,        // 基础延迟（ms）
  duration: 300,         // 动画时长（ms）
})

// 使用预定义的动画配置
animations.page          // 页面容器动画
animations.header        // 页面标题动画
animations.card(index)   // 卡片动画（带索引）
animations.listItem(index) // 列表项动画（带索引）
animations.statsCard(index) // 统计卡片动画（带索引）
```

### 2. `PageContainer` - 页面容器组件

自动应用页面进入动画和标准布局。

```vue
<template>
  <PageContainer 
    title="页面标题" 
    description="页面描述"
    :disable-animation="false"
  >
    <!-- 自定义头部操作按钮 -->
    <template #actions>
      <Button>操作按钮</Button>
    </template>

    <!-- 页面内容 -->
    <div>内容区域</div>
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
</script>
```

### 3. `AnimatedCard` - 动画卡片组件

自动应用卡片进入动画和悬停效果。

```vue
<template>
  <AnimatedCard 
    :index="0" 
    animation-type="card"
    :disable-hover="false"
  >
    <CardHeader>
      <CardTitle>卡片标题</CardTitle>
    </CardHeader>
    <CardContent>
      卡片内容
    </CardContent>
  </AnimatedCard>
</template>

<script setup lang="ts">
import AnimatedCard from '@/components/AnimatedCard.vue'
import { CardHeader, CardTitle, CardContent } from '@juanie/ui'
</script>
```

### 4. `AnimatedList` - 动画列表组件

自动应用列表交错动画，超过50项自动禁用以保证性能。

```vue
<template>
  <AnimatedList :items="projects" :base-delay="150">
    <template #default="{ item, index }">
      <ProjectCard :project="item" :index="index" />
    </template>
  </AnimatedList>
</template>

<script setup lang="ts">
import AnimatedList from '@/components/AnimatedList.vue'
import ProjectCard from '@/components/ProjectCard.vue'

const projects = ref([...])
</script>
```

## 🎨 样式工具类

### 卡片悬停效果

```typescript
import { cardHoverClass } from '@/composables/usePageTransition'

// 在模板中使用
<Card :class="cardHoverClass">
  <!-- 自动应用悬停缩放和阴影效果 -->
</Card>
```

### 按钮点击效果

```typescript
import { buttonActiveClass } from '@/composables/usePageTransition'

// 在模板中使用
<Button :class="buttonActiveClass">
  <!-- 自动应用点击缩放效果 -->
</Button>
```

## 📋 完整页面示例

### 使用 PageContainer（推荐）

```vue
<template>
  <PageContainer title="项目管理" description="管理你的应用和服务项目">
    <template #actions>
      <Button @click="openCreateModal">
        <Plus class="mr-2 h-4 w-4" />
        创建项目
      </Button>
    </template>

    <!-- 统计卡片 -->
    <div class="grid gap-4 md:grid-cols-3">
      <AnimatedCard 
        v-for="(stat, index) in stats" 
        :key="stat.label"
        :index="index"
        animation-type="stats"
      >
        <CardHeader>
          <CardTitle>{{ stat.label }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stat.value }}</div>
        </CardContent>
      </AnimatedCard>
    </div>

    <!-- 项目列表 -->
    <AnimatedList :items="projects">
      <template #default="{ item, index }">
        <ProjectCard :project="item" :index="index" />
      </template>
    </AnimatedList>
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
import AnimatedCard from '@/components/AnimatedCard.vue'
import AnimatedList from '@/components/AnimatedList.vue'
import { Button, CardHeader, CardTitle, CardContent } from '@juanie/ui'
import { Plus } from 'lucide-vue-next'

const stats = ref([...])
const projects = ref([...])
</script>
```

### 手动使用动画（高级用法）

```vue
<template>
  <div
    v-motion
    :initial="animations.page.initial"
    :enter="animations.page.enter"
    class="container mx-auto p-6 space-y-6"
  >
    <div
      v-motion
      :initial="animations.header.initial"
      :enter="animations.header.enter"
    >
      <h1>页面标题</h1>
    </div>

    <Card
      v-for="(item, index) in items"
      :key="item.id"
      v-motion
      :initial="animations.card(index).initial"
      :enter="animations.card(index).enter"
      :class="cardHoverClass"
    >
      <!-- 卡片内容 -->
    </Card>
  </div>
</template>

<script setup lang="ts">
import { usePageTransition, cardHoverClass } from '@/composables/usePageTransition'

const animations = usePageTransition()
const items = ref([...])
</script>
```

## ✅ 横切关注点检查清单

在创建或更新页面时，确保遵守以下横切关注点：

### 1. ✅ 动画
- [ ] 使用 `PageContainer` 或手动添加页面进入动画
- [ ] 列表项使用 `AnimatedList` 或手动添加交错动画
- [ ] 卡片使用 `AnimatedCard` 或添加 `cardHoverClass`
- [ ] 超过50项的列表禁用动画（自动处理）

### 2. ✅ 响应式设计
- [ ] 使用 `container mx-auto` 容器
- [ ] 使用响应式网格：`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] 移动端优化：按钮大小、间距、字体

### 3. ✅ 主题支持
- [ ] 使用主题变量：`text-muted-foreground`、`bg-background`
- [ ] 使用 shadcn-vue 组件（自动支持主题）
- [ ] 避免硬编码颜色值

### 4. ✅ 性能优化
- [ ] 大列表（>50项）自动禁用动画
- [ ] 使用 `computed` 缓存计算结果
- [ ] 路由懒加载：`() => import('./Component.vue')`
- [ ] 搜索使用 `useDebounceFn` 防抖

### 5. ✅ 错误处理
- [ ] 使用 `useToast` 显示错误提示
- [ ] 显示加载状态（Skeleton 或 Loader）
- [ ] 显示空状态（EmptyState）
- [ ] 提供重试按钮

## 🔄 迁移现有页面

### 步骤 1：导入组件

```typescript
import PageContainer from '@/components/PageContainer.vue'
import AnimatedCard from '@/components/AnimatedCard.vue'
import AnimatedList from '@/components/AnimatedList.vue'
```

### 步骤 2：替换页面容器

```vue
<!-- 之前 -->
<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1>标题</h1>
      <p>描述</p>
    </div>
    <Button>操作</Button>
  </div>
  <!-- 内容 -->
</div>

<!-- 之后 -->
<PageContainer title="标题" description="描述">
  <template #actions>
    <Button>操作</Button>
  </template>
  <!-- 内容 -->
</PageContainer>
```

### 步骤 3：替换卡片

```vue
<!-- 之前 -->
<Card>
  <CardHeader>...</CardHeader>
</Card>

<!-- 之后 -->
<AnimatedCard :index="0">
  <CardHeader>...</CardHeader>
</AnimatedCard>
```

### 步骤 4：替换列表

```vue
<!-- 之前 -->
<div v-for="(item, index) in items" :key="item.id">
  <ItemCard :item="item" />
</div>

<!-- 之后 -->
<AnimatedList :items="items">
  <template #default="{ item, index }">
    <ItemCard :item="item" :index="index" />
  </template>
</AnimatedList>
```

## 📊 性能考虑

### 自动性能优化

- `AnimatedList` 在列表超过50项时自动禁用动画
- `usePageTransition` 支持 `disabled` 选项手动控制

### 手动性能优化

```typescript
// 根据列表长度决定是否启用动画
const shouldAnimate = computed(() => items.value.length <= 50)

const animations = usePageTransition({
  disabled: !shouldAnimate.value
})
```

## 🎯 最佳实践

1. **优先使用 PageContainer**：统一页面布局和动画
2. **使用 AnimatedCard 和 AnimatedList**：自动处理动画和性能
3. **保持动画一致**：使用预定义的动画配置
4. **注意性能**：大列表自动禁用动画
5. **响应式优先**：使用 Tailwind 响应式类
6. **主题兼容**：使用主题变量而非硬编码颜色

## 🐛 常见问题

### Q: 动画不生效？
A: 确保已安装 `@vueuse/motion` 并在组件中导入 `v-motion` 指令。

### Q: 列表动画卡顿？
A: 检查列表长度，超过50项会自动禁用动画。可以手动设置 `disable-animation`。

### Q: 如何自定义动画时长？
A: 使用 `usePageTransition({ duration: 500 })` 自定义时长。

### Q: 如何禁用悬停效果？
A: 使用 `<AnimatedCard :disable-hover="true">`。

## 📚 相关文档

- [Vue Motion 文档](https://motion.vueuse.org/)
- [Tailwind CSS 响应式设计](https://tailwindcss.com/docs/responsive-design)
- [shadcn-vue 组件库](https://www.shadcn-vue.com/)
