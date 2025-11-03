# 前端核心功能 - 设计文档

## 概述

本文档描述了 AI DevOps 平台前端应用的技术设计，基于 shadcn-vue 组件库和现有的 AppLayout 架构，实现类型安全、现代化的用户界面。

### 设计目标

1. **类型安全** - 端到端 TypeScript，tRPC 自动类型推导
2. **组件复用** - 基础组件来自 @juanie/ui，业务组件可复用
3. **性能优化** - 懒加载、缓存、虚拟滚动
4. **用户体验** - 流畅动画、实时更新、友好提示
5. **可维护性** - 清晰的目录结构、统一的代码风格

### 技术架构

```
apps/web/
├── src/
│   ├── components/          # 业务组件
│   │   ├── organization/    # 组织相关组件
│   │   ├── project/         # 项目相关组件
│   │   ├── pipeline/        # Pipeline 相关组件
│   │   ├── deployment/      # 部署相关组件
│   │   └── shared/          # 共享业务组件
│   ├── composables/         # 组合式函数
│   │   ├── useOrganizations.ts
│   │   ├── useProjects.ts
│   │   ├── usePipelines.ts
│   │   ├── useDeployments.ts
│   │   ├── useEnvironments.ts
│   │   └── useToast.ts
│   ├── layouts/             # 布局组件
│   │   └── AppLayout.vue    # 主布局（已存在）
│   ├── views/               # 页面组件
│   ├── stores/              # Pinia 状态管理
│   ├── lib/                 # 工具库
│   │   ├── trpc.ts          # tRPC 客户端
│   │   └── utils.ts         # 工具函数
│   └── router/              # 路由配置
```

## 组件设计

### 基础组件（@juanie/ui）

所有基础组件来自 shadcn-vue，已在 @juanie/ui 中导出：

**布局组件：**
- Sidebar, SidebarProvider, SidebarInset
- Card, CardHeader, CardContent, CardFooter
- Tabs, TabsList, TabsTrigger, TabsContent

**表单组件：**
- Form, FormField, FormItem, FormLabel, FormControl, FormMessage
- Input, Textarea, Select, Checkbox, Radio, Switch
- Button (variants: default, destructive, outline, secondary, ghost, link)

**反馈组件：**
- Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
- Alert, AlertTitle, AlertDescription
- Toast (vue-sonner)
- Skeleton
- Progress

**数据展示组件：**
- Table, TableHeader, TableBody, TableRow, TableCell
- Badge (variants: default, secondary, destructive, outline)
- Avatar, AvatarImage, AvatarFallback
- Accordion, AccordionItem, AccordionTrigger, AccordionContent

**导航组件：**
- Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink
- DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
- Pagination


### 业务组件（apps/web/src/components）

基于后端已实现的 15 个模块，设计以下业务组件：

#### 组织相关组件
- `OrganizationCard.vue` - 组织卡片
- `OrganizationSwitcher.vue` - 组织切换器（顶部导航）
- `CreateOrganizationModal.vue` - 创建组织对话框
- `OrganizationMemberTable.vue` - 成员列表表格

#### 项目相关组件
- `ProjectCard.vue` - 项目卡片（已存在，需优化）
- `CreateProjectModal.vue` - 创建项目对话框（已存在）
- `ProjectStats.vue` - 项目统计卡片
- `ProjectMemberTable.vue` - 项目成员表格

#### 环境相关组件
- `EnvironmentCard.vue` - 环境卡片
- `CreateEnvironmentModal.vue` - 创建环境对话框
- `EnvironmentStatusBadge.vue` - 环境状态徽章

#### Pipeline 相关组件
- `PipelineTable.vue` - Pipeline 列表表格
- `PipelineStatusBadge.vue` - Pipeline 状态徽章
- `PipelineRunCard.vue` - Pipeline 运行卡片
- `PipelineLogViewer.vue` - 日志查看器

#### 部署相关组件
- `DeploymentTable.vue` - 部署列表表格
- `DeploymentStatusBadge.vue` - 部署状态徽章
- `DeploymentApprovalCard.vue` - 审批卡片
- `DeploymentTimeline.vue` - 部署时间线

#### 共享组件
- `EmptyState.vue` - 空状态占位
- `LoadingState.vue` - 加载状态
- `ErrorState.vue` - 错误状态
- `ConfirmDialog.vue` - 确认对话框

## 组合式函数设计

### useToast

```typescript
// apps/web/src/composables/useToast.ts
import { toast } from 'vue-sonner'

export function useToast() {
  return {
    success: (message: string, description?: string) => {
      toast.success(message, { description })
    },
    error: (message: string, description?: string) => {
      toast.error(message, { description })
    },
    warning: (message: string, description?: string) => {
      toast.warning(message, { description })
    },
    info: (message: string, description?: string) => {
      toast.info(message, { description })
    },
  }
}
```

### useOrganizations

```typescript
// apps/web/src/composables/useOrganizations.ts
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useOrganizations() {
  const toast = useToast()

  // 查询
  const { data: organizations, isLoading, error, refetch } = trpc.organizations.list.useQuery()

  // 创建
  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: () => {
      toast.success('组织创建成功')
      refetch()
    },
    onError: (error) => {
      toast.error('创建失败', error.message)
    },
  })

  // 更新
  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      toast.success('组织更新成功')
      refetch()
    },
    onError: (error) => {
      toast.error('更新失败', error.message)
    },
  })

  // 删除
  const deleteMutation = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      toast.success('组织删除成功')
      refetch()
    },
    onError: (error) => {
      toast.error('删除失败', error.message)
    },
  })

  return {
    organizations: computed(() => organizations.value || []),
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
```

### useProjects

```typescript
// apps/web/src/composables/useProjects.ts
import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useProjects(organizationId: Ref<string>) {
  const toast = useToast()

  // 查询
  const { data: projects, isLoading, error, refetch } = trpc.projects.list.useQuery(
    computed(() => ({ organizationId: organizationId.value })),
    { enabled: computed(() => !!organizationId.value) }
  )

  // 创建
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success('项目创建成功')
      refetch()
    },
    onError: (error) => {
      toast.error('创建失败', error.message)
    },
  })

  // 更新
  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success('项目更新成功')
      refetch()
    },
    onError: (error) => {
      toast.error('更新失败', error.message)
    },
  })

  // 删除
  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success('项目删除成功')
      refetch()
    },
    onError: (error) => {
      toast.error('删除失败', error.message)
    },
  })

  return {
    projects: computed(() => projects.value || []),
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
```

### usePipelines

```typescript
// apps/web/src/composables/usePipelines.ts
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function usePipelines(projectId: Ref<string>) {
  const toast = useToast()

  // 查询 Pipeline 列表
  const { data: pipelines, isLoading, refetch } = trpc.pipelines.list.useQuery(
    computed(() => ({ projectId: projectId.value })),
    { enabled: computed(() => !!projectId.value) }
  )

  // 触发 Pipeline
  const triggerMutation = trpc.pipelines.trigger.useMutation({
    onSuccess: () => {
      toast.success('Pipeline 已触发')
      refetch()
    },
    onError: (error) => {
      toast.error('触发失败', error.message)
    },
  })

  // 取消 Pipeline
  const cancelMutation = trpc.pipelines.cancel.useMutation({
    onSuccess: () => {
      toast.success('Pipeline 已取消')
      refetch()
    },
    onError: (error) => {
      toast.error('取消失败', error.message)
    },
  })

  // 订阅日志流
  const subscribeToLogs = (runId: string, onData: (log: any) => void) => {
    return trpc.pipelines.streamLogs.useSubscription(
      { runId },
      {
        onData,
        onError: (error) => {
          toast.error('日志订阅失败', error.message)
        },
      }
    )
  }

  // 订阅状态更新
  const subscribeToStatus = (runId: string, onData: (status: any) => void) => {
    return trpc.pipelines.watchRun.useSubscription(
      { runId },
      {
        onData,
        onError: (error) => {
          toast.error('状态订阅失败', error.message)
        },
      }
    )
  }

  return {
    pipelines: computed(() => pipelines.value || []),
    isLoading,
    refetch,
    trigger: triggerMutation.mutate,
    cancel: cancelMutation.mutate,
    isTriggering: triggerMutation.isLoading,
    isCanceling: cancelMutation.isLoading,
    subscribeToLogs,
    subscribeToStatus,
  }
}
```

## 状态管理设计

### Auth Store

```typescript
// apps/web/src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trpc } from '@/lib/trpc'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  async function initialize() {
    loading.value = true
    try {
      const data = await trpc.auth.me.query()
      user.value = data.user
    } catch (error) {
      user.value = null
      token.value = null
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await trpc.auth.logout.mutate()
    user.value = null
    token.value = null
  }

  return {
    user,
    token,
    loading,
    isAuthenticated,
    initialize,
    logout,
  }
}, {
  persist: {
    paths: ['token'],
  },
})
```

### App Store

```typescript
// apps/web/src/stores/app.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const currentOrganizationId = ref<string | null>(null)
  const sidebarCollapsed = ref(false)

  function setCurrentOrganization(id: string) {
    currentOrganizationId.value = id
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    currentOrganizationId,
    sidebarCollapsed,
    setCurrentOrganization,
    toggleSidebar,
  }
}, {
  persist: {
    paths: ['currentOrganizationId', 'sidebarCollapsed'],
  },
})
```


## 页面设计

### 登录页面 (Login.vue)

**路由：** `/login`

**布局：** 居中卡片布局

**组件使用：**
- Card - 登录表单容器
- Button - GitHub/GitLab 登录按钮
- lucide-vue-next - GitHub/GitLab 图标

**功能：**
- OAuth 登录跳转
- 登录状态检查
- 自动重定向到 Dashboard

### Dashboard 页面

**路由：** `/dashboard`

**布局：** AppLayout

**组件使用：**
- Card - 统计卡片
- Badge - 状态标签
- Skeleton - 加载占位

**数据展示：**
- 项目统计（总数、活跃数）
- 最近 5 次部署
- 正在运行的 Pipeline
- 本月成本趋势

### 组织列表页面 (Organizations.vue)

**路由：** `/organizations`

**布局：** AppLayout

**组件使用：**
- Card Grid - 组织卡片网格
- Dialog - 创建组织表单
- Button - 操作按钮

**功能：**
- 显示用户所属组织
- 创建新组织
- 编辑/删除组织
- 切换当前组织

### 组织详情页面 (OrganizationDetail.vue)

**路由：** `/organizations/:id`

**布局：** AppLayout

**组件使用：**
- Tabs - 切换不同视图
- Table - 成员列表
- Dialog - 邀请成员
- Select - 角色选择

**标签页：**
- 概览 - 组织信息和统计
- 成员 - 成员管理
- 团队 - 团队列表
- 设置 - 组织设置

### 项目列表页面 (Projects.vue)

**路由：** `/projects`

**布局：** AppLayout

**组件使用：**
- Card Grid - 项目卡片网格
- Input - 搜索框
- Select - 状态筛选
- Dialog - 创建项目表单

**功能：**
- 项目卡片展示
- 搜索和筛选
- 创建项目
- 快速操作（编辑、删除）

**动画：**
- 卡片交错进入动画
- 悬停缩放效果

### 项目详情页面 (ProjectDetail.vue)

**路由：** `/projects/:id`

**布局：** AppLayout

**组件使用：**
- Tabs - 切换不同视图
- Card - 信息卡片
- Table - 列表展示
- Badge - 状态标签

**标签页：**
- 概览 - 项目信息和统计
- 环境 - 环境列表
- Pipeline - Pipeline 列表
- 部署 - 部署历史
- 成员 - 成员管理
- 设置 - 项目设置

### Pipeline 列表页面 (Pipelines.vue)

**路由：** `/projects/:projectId/pipelines`

**布局：** AppLayout

**组件使用：**
- Table - Pipeline 列表
- Badge - 状态标签
- Button - 触发按钮
- Dialog - Pipeline 配置

**功能：**
- Pipeline 列表展示
- 手动触发
- 查看配置
- 查看运行历史

### Pipeline 运行详情页面 (PipelineRun.vue)

**路由：** `/pipelines/:pipelineId/runs/:runId`

**布局：** AppLayout

**组件使用：**
- Badge - 运行状态
- Accordion - 阶段展开
- Code/Textarea - 日志显示
- Progress - 进度条

**功能：**
- 实时日志流（tRPC subscription）
- 实时状态更新
- 取消运行
- 重新运行

**动画：**
- 日志滚动动画
- 状态变化动画

### 部署列表页面 (Deployments.vue)

**路由：** `/projects/:projectId/deployments`

**布局：** AppLayout

**组件使用：**
- Table - 部署列表
- Badge - 状态标签
- Select - 环境筛选
- Dialog - 部署详情

**功能：**
- 部署历史展示
- 按环境筛选
- 查看详情
- 回滚操作

### 部署详情页面 (DeploymentDetail.vue)

**路由：** `/deployments/:id`

**布局：** AppLayout

**组件使用：**
- Card - 信息卡片
- Timeline - 审批时间线
- Button - 审批按钮
- Dialog - 审批表单

**功能：**
- 部署信息展示
- 审批流程展示
- 批准/拒绝部署
- 查看日志

### 环境管理页面 (Environments.vue)

**路由：** `/projects/:projectId/environments`

**布局：** AppLayout

**组件使用：**
- Card Grid - 环境卡片
- Badge - 环境类型
- Dialog - 创建/编辑表单
- Alert - 配置警告

**功能：**
- 环境列表展示
- 创建环境
- 编辑配置
- 删除环境

## 动画设计

### 页面过渡动画

使用 @vueuse/motion 实现：

```vue
<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300 } }"
  >
    <!-- 页面内容 -->
  </div>
</template>
```

### 列表动画

```vue
<template>
  <div
    v-for="(item, index) in items"
    :key="item.id"
    v-motion
    :initial="{ opacity: 0, x: -20 }"
    :enter="{
      opacity: 1,
      x: 0,
      transition: {
        delay: index * 50,
        duration: 300,
      },
    }"
  >
    <!-- 列表项 -->
  </div>
</template>
```

### 卡片悬停动画

```vue
<style scoped>
.card {
  transition: all 0.2s ease-out;
}

.card:hover {
  transform: scale(1.02);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}
</style>
```

## 路由设计

```typescript
// apps/web/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'organizations',
        name: 'Organizations',
        component: () => import('@/views/Organizations.vue'),
        meta: { title: '组织管理' },
      },
      {
        path: 'organizations/:id',
        name: 'OrganizationDetail',
        component: () => import('@/views/OrganizationDetail.vue'),
        meta: { title: '组织详情' },
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/Projects.vue'),
        meta: { title: '项目管理' },
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/ProjectDetail.vue'),
        meta: { title: '项目详情' },
      },
      {
        path: 'projects/:projectId/pipelines',
        name: 'Pipelines',
        component: () => import('@/views/Pipelines.vue'),
        meta: { title: 'Pipeline 管理' },
      },
      {
        path: 'pipelines/:pipelineId/runs/:runId',
        name: 'PipelineRun',
        component: () => import('@/views/PipelineRun.vue'),
        meta: { title: 'Pipeline 运行详情' },
      },
      {
        path: 'projects/:projectId/deployments',
        name: 'Deployments',
        component: () => import('@/views/Deployments.vue'),
        meta: { title: '部署管理' },
      },
      {
        path: 'deployments/:id',
        name: 'DeploymentDetail',
        component: () => import('@/views/DeploymentDetail.vue'),
        meta: { title: '部署详情' },
      },
      {
        path: 'projects/:projectId/environments',
        name: 'Environments',
        component: () => import('@/views/Environments.vue'),
        meta: { title: '环境管理' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && authStore.isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
```

## 性能优化策略

### 1. 代码分割

- 路由懒加载
- 组件懒加载
- 第三方库按需引入

### 2. 数据缓存

- tRPC useQuery 自动缓存
- Pinia 持久化关键数据
- 合理设置 staleTime

### 3. 虚拟滚动

对于大列表（>100 项）使用虚拟滚动：

```vue
<script setup>
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(
  items,
  { itemHeight: 80 }
)
</script>
```

### 4. 防抖节流

搜索输入使用防抖：

```typescript
import { useDebounceFn } from '@vueuse/core'

const debouncedSearch = useDebounceFn((value: string) => {
  // 执行搜索
}, 300)
```

### 5. 图片优化

- 使用 WebP 格式
- 懒加载图片
- 压缩图片大小

## 错误处理

### 全局错误处理

```typescript
// apps/web/src/lib/trpc.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@juanie/api-gateway'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL || 'http://localhost:3001/trpc',
      headers() {
        const authStore = useAuthStore()
        return {
          authorization: authStore.token ? `Bearer ${authStore.token}` : '',
        }
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        }).catch((error) => {
          // 网络错误
          toast.error('网络错误', '请检查网络连接')
          throw error
        })
      },
    }),
  ],
})
```

### 组件级错误处理

```vue
<script setup>
import { onErrorCaptured } from 'vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()

onErrorCaptured((error) => {
  console.error('Component error:', error)
  toast.error('操作失败', error.message)
  return false // 阻止错误继续传播
})
</script>
```

## 主题设计

### 多主题系统

@juanie/ui 提供了完整的多主题系统，不仅支持明暗模式，还支持多种预定义主题：

**预定义主题：**
- `default` - 默认主题
- `github` - GitHub 风格
- `bilibili` - B站风格

**主题功能：**
- 主题切换（useTheme）
- 主题编辑器（ThemeEditor）
- 主题预览（ThemePreview）
- 自定义主题导入导出

### 使用主题系统

```typescript
// 在组件中使用主题
import { useTheme } from '@juanie/ui'

const { 
  themes,          // 所有可用主题
  currentTheme,    // 当前主题
  isDark,          // 是否暗色模式
  mode,            // 当前模式 'light' | 'dark'
  setTheme,        // 切换主题
  setMode,         // 设置模式
  toggleMode,      // 切换明暗模式
} = useTheme()

// 切换主题
setTheme('github')

// 切换明暗模式
toggleMode()
```

### 颜色变量系统

主题系统使用 CSS 变量，支持以下颜色分类：

**基础色：**
- `--background` - 背景色
- `--foreground` - 前景色

**品牌色：**
- `--primary` / `--primary-foreground` - 主色
- `--secondary` / `--secondary-foreground` - 次要色

**交互色：**
- `--accent` / `--accent-foreground` - 强调色
- `--input` - 输入框背景
- `--ring` - 焦点环

**中性色：**
- `--muted` / `--muted-foreground` - 静音色

**表面色：**
- `--card` / `--card-foreground` - 卡片背景

**边框色：**
- `--border` - 边框色

**反馈色：**
- `--success` - 成功色
- `--warning` - 警告色
- `--info` - 信息色
- `--destructive` / `--destructive-foreground` - 危险色

### 主题切换器集成

在 AppLayout 中集成主题切换器：

```vue
<template>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button variant="ghost" size="icon">
        <Sun v-if="!isDark" />
        <Moon v-else />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>选择主题</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem 
        v-for="theme in themes" 
        :key="theme.id"
        @click="setTheme(theme.id)"
      >
        {{ theme.name }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="toggleMode">
        切换明暗模式
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
```

## 总结

本设计文档基于后端已实现的 15 个核心模块，定义了：

✅ **组件架构** - 基础组件（shadcn-vue）+ 业务组件
✅ **组合式函数** - 统一的数据管理和 API 调用
✅ **状态管理** - Pinia + 持久化
✅ **页面设计** - 完整的页面结构和功能
✅ **动画系统** - @vueuse/motion + CSS transitions
✅ **路由设计** - 懒加载 + 路由守卫
✅ **性能优化** - 缓存、防抖、虚拟滚动
✅ **错误处理** - 全局 + 组件级
✅ **主题系统** - 亮色/暗色主题

下一步将创建详细的任务列表（tasks.md）。


## 新增模块设计

### 仓库管理模块

#### useRepositories 组合式函数

```typescript
// apps/web/src/composables/useRepositories.ts
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useRepositories(projectId: Ref<string>) {
  const toast = useToast()

  const { data: repositories, isLoading, refetch } = trpc.repositories.list.useQuery(
    computed(() => ({ projectId: projectId.value })),
    { enabled: computed(() => !!projectId.value) }
  )

  const connectMutation = trpc.repositories.connect.useMutation({
    onSuccess: () => {
      toast.success('仓库连接成功')
      refetch()
    },
    onError: (error) => {
      toast.error('连接失败', error.message)
    },
  })

  const syncMutation = trpc.repositories.sync.useMutation({
    onSuccess: () => {
      toast.success('仓库同步成功')
      refetch()
    },
    onError: (error) => {
      toast.error('同步失败', error.message)
    },
  })

  const disconnectMutation = trpc.repositories.disconnect.useMutation({
    onSuccess: () => {
      toast.success('仓库已断开')
      refetch()
    },
    onError: (error) => {
      toast.error('断开失败', error.message)
    },
  })

  return {
    repositories: computed(() => repositories.value || []),
    isLoading,
    refetch,
    connect: connectMutation.mutate,
    sync: syncMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isLoading,
    isSyncing: syncMutation.isLoading,
    isDisconnecting: disconnectMutation.isLoading,
  }
}
```

#### 仓库管理页面

**路由：** `/projects/:projectId/repositories`

**组件使用：**
- Card - 仓库卡片
- Badge - 提供商标签（GitHub/GitLab）
- Dialog - 连接仓库表单
- Button - 同步/断开按钮

### 团队管理模块

#### useTeams 组合式函数

```typescript
// apps/web/src/composables/useTeams.ts
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useTeams(organizationId: Ref<string>) {
  const toast = useToast()

  const { data: teams, isLoading, refetch } = trpc.teams.list.useQuery(
    computed(() => ({ organizationId: organizationId.value })),
    { enabled: computed(() => !!organizationId.value) }
  )

  const createMutation = trpc.teams.create.useMutation({
    onSuccess: () => {
      toast.success('团队创建成功')
      refetch()
    },
    onError: (error) => {
      toast.error('创建失败', error.message)
    },
  })

  const updateMutation = trpc.teams.update.useMutation({
    onSuccess: () => {
      toast.success('团队更新成功')
      refetch()
    },
    onError: (error) => {
      toast.error('更新失败', error.message)
    },
  })

  const deleteMutation = trpc.teams.delete.useMutation({
    onSuccess: () => {
      toast.success('团队删除成功')
      refetch()
    },
    onError: (error) => {
      toast.error('删除失败', error.message)
    },
  })

  return {
    teams: computed(() => teams.value || []),
    isLoading,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
```

### 安全策略模块

#### useSecurityPolicies 组合式函数

```typescript
// apps/web/src/composables/useSecurityPolicies.ts
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useSecurityPolicies(organizationId: Ref<string>) {
  const toast = useToast()

  const { data: policies, isLoading, refetch } = trpc.securityPolicies.list.useQuery(
    computed(() => ({ organizationId: organizationId.value })),
    { enabled: computed(() => !!organizationId.value) }
  )

  const createMutation = trpc.securityPolicies.create.useMutation({
    onSuccess: () => {
      toast.success('安全策略创建成功')
      refetch()
    },
    onError: (error) => {
      toast.error('创建失败', error.message)
    },
  })

  const updateMutation = trpc.securityPolicies.update.useMutation({
    onSuccess: () => {
      toast.success('安全策略更新成功')
      refetch()
    },
    onError: (error) => {
      toast.error('更新失败', error.message)
    },
  })

  const deleteMutation = trpc.securityPolicies.delete.useMutation({
    onSuccess: () => {
      toast.success('安全策略删除成功')
      refetch()
    },
    onError: (error) => {
      toast.error('删除失败', error.message)
    },
  })

  return {
    policies: computed(() => policies.value || []),
    isLoading,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
```

### 审计日志模块

#### useAuditLogs 组合式函数

```typescript
// apps/web/src/composables/useAuditLogs.ts
import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useAuditLogs(organizationId: Ref<string>) {
  const toast = useToast()
  
  const filters = ref({
    action: '',
    userId: '',
    resourceType: '',
    startDate: '',
    endDate: '',
  })

  const { data: logs, isLoading, refetch } = trpc.auditLogs.list.useQuery(
    computed(() => ({
      organizationId: organizationId.value,
      ...filters.value,
    })),
    { enabled: computed(() => !!organizationId.value) }
  )

  const exportMutation = trpc.auditLogs.export.useMutation({
    onSuccess: (data) => {
      // 下载文件
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${Date.now()}.json`
      a.click()
      toast.success('日志导出成功')
    },
    onError: (error) => {
      toast.error('导出失败', error.message)
    },
  })

  return {
    logs: computed(() => logs.value || []),
    isLoading,
    filters,
    refetch,
    export: exportMutation.mutate,
    isExporting: exportMutation.isLoading,
  }
}
```

### 通知中心模块

#### useNotifications 组合式函数

```typescript
// apps/web/src/composables/useNotifications.ts
import { computed } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useNotifications() {
  const toast = useToast()

  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery()

  const unreadCount = computed(() => {
    return notifications.value?.filter(n => !n.isRead).length || 0
  })

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      refetch()
    },
    onError: (error) => {
      toast.error('操作失败', error.message)
    },
  })

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      toast.success('通知已删除')
      refetch()
    },
    onError: (error) => {
      toast.error('删除失败', error.message)
    },
  })

  return {
    notifications: computed(() => notifications.value || []),
    unreadCount,
    isLoading,
    refetch,
    markAsRead: markAsReadMutation.mutate,
    delete: deleteMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
```

### AI 助手模块

#### useAIAssistants 组合式函数

```typescript
// apps/web/src/composables/useAIAssistants.ts
import { computed, ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useAIAssistants() {
  const toast = useToast()

  const { data: assistants, isLoading } = trpc.aiAssistants.list.useQuery()

  const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const chatMutation = trpc.aiAssistants.chat.useMutation({
    onSuccess: (response) => {
      messages.value.push({
        role: 'assistant',
        content: response.message,
      })
    },
    onError: (error) => {
      toast.error('对话失败', error.message)
    },
  })

  const rateMutation = trpc.aiAssistants.rate.useMutation({
    onSuccess: () => {
      toast.success('评分成功')
    },
    onError: (error) => {
      toast.error('评分失败', error.message)
    },
  })

  const sendMessage = (assistantId: string, message: string) => {
    messages.value.push({
      role: 'user',
      content: message,
    })
    chatMutation.mutate({ assistantId, message })
  }

  return {
    assistants: computed(() => assistants.value || []),
    messages,
    isLoading,
    sendMessage,
    rate: rateMutation.mutate,
    isChatting: chatMutation.isLoading,
    isRating: rateMutation.isLoading,
  }
}
```

### 模板生成模块

#### useTemplates 组合式函数

```typescript
// apps/web/src/composables/useTemplates.ts
import { ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useTemplates() {
  const toast = useToast()

  const generatedTemplate = ref('')

  const generateDockerfileMutation = trpc.templates.generateDockerfile.useMutation({
    onSuccess: (data) => {
      generatedTemplate.value = data.content
      toast.success('Dockerfile 生成成功')
    },
    onError: (error) => {
      toast.error('生成失败', error.message)
    },
  })

  const generateCICDMutation = trpc.templates.generateCICD.useMutation({
    onSuccess: (data) => {
      generatedTemplate.value = data.content
      toast.success('CI/CD 配置生成成功')
    },
    onError: (error) => {
      toast.error('生成失败', error.message)
    },
  })

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedTemplate.value)
    toast.success('已复制到剪贴板')
  }

  const downloadTemplate = (filename: string) => {
    const blob = new Blob([generatedTemplate.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    toast.success('下载成功')
  }

  return {
    generatedTemplate,
    generateDockerfile: generateDockerfileMutation.mutate,
    generateCICD: generateCICDMutation.mutate,
    copyToClipboard,
    downloadTemplate,
    isGenerating: generateDockerfileMutation.isLoading || generateCICDMutation.isLoading,
  }
}
```

## 新增页面设计

### 仓库管理页面 (Repositories.vue)

**路由：** `/projects/:projectId/repositories`

**组件使用：**
- Card Grid - 仓库卡片
- Badge - GitHub/GitLab 标签
- Dialog - 连接仓库表单
- Button - 同步/断开按钮

### 团队管理页面 (Teams.vue)

**路由：** `/organizations/:orgId/teams`

**组件使用：**
- Card Grid - 团队卡片
- Table - 团队成员列表
- Dialog - 创建/编辑团队表单

### 安全策略页面 (SecurityPolicies.vue)

**路由：** `/organizations/:orgId/security`

**组件使用：**
- Table - 策略列表
- Badge - 策略类型和状态
- Dialog - 创建/编辑策略表单
- Textarea - JSONB 规则编辑器

### 审计日志页面 (AuditLogs.vue)

**路由：** `/organizations/:orgId/audit-logs`

**组件使用：**
- Table - 日志列表
- Input - 搜索框
- Select - 筛选器
- Button - 导出按钮

### 通知中心页面 (Notifications.vue)

**路由：** `/notifications`

**组件使用：**
- Card List - 通知列表
- Badge - 通知类型和优先级
- Button - 标记已读/删除

### AI 助手页面 (AIAssistants.vue)

**路由：** `/ai/assistants`

**组件使用：**
- Card Grid - 助手列表
- Chat Interface - 对话界面
- Textarea - 消息输入
- Button - 发送/评分

### 可观测性仪表板页面 (Observability.vue)

**路由：** `/observability`

**组件使用：**
- Tabs - 切换 Metrics/Traces/Logs
- iframe - 嵌入 Grafana/Jaeger
- Select - 时间范围选择

### 监控告警页面 (Alerts.vue)

**路由：** `/monitoring/alerts`

**组件使用：**
- Table - 告警列表
- Badge - 严重程度
- Button - 静默/确认

### 模板生成页面 (Templates.vue)

**路由：** `/templates`

**组件使用：**
- Tabs - Dockerfile/CI-CD
- Form - 配置表单
- Code - 模板预览
- Button - 复制/下载

### 成本详情页面 (CostTracking.vue)

**路由：** `/cost`

**组件使用：**
- Chart - 成本趋势图
- Card - 成本分类统计
- Select - 项目/时间筛选
- Alert - 预算告警

## 路由更新

```typescript
// apps/web/src/router/index.ts
const routes = [
  // ... 现有路由
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      // 仓库管理
      {
        path: 'projects/:projectId/repositories',
        name: 'Repositories',
        component: () => import('@/views/Repositories.vue'),
        meta: { title: '仓库管理' },
      },
      // 团队管理
      {
        path: 'organizations/:orgId/teams',
        name: 'Teams',
        component: () => import('@/views/Teams.vue'),
        meta: { title: '团队管理' },
      },
      // 安全策略
      {
        path: 'organizations/:orgId/security',
        name: 'SecurityPolicies',
        component: () => import('@/views/SecurityPolicies.vue'),
        meta: { title: '安全策略' },
      },
      // 审计日志
      {
        path: 'organizations/:orgId/audit-logs',
        name: 'AuditLogs',
        component: () => import('@/views/AuditLogs.vue'),
        meta: { title: '审计日志' },
      },
      // 通知中心
      {
        path: 'notifications',
        name: 'Notifications',
        component: () => import('@/views/Notifications.vue'),
        meta: { title: '通知中心' },
      },
      // AI 助手
      {
        path: 'ai/assistants',
        name: 'AIAssistants',
        component: () => import('@/views/AIAssistants.vue'),
        meta: { title: 'AI 助手' },
      },
      // 可观测性
      {
        path: 'observability',
        name: 'Observability',
        component: () => import('@/views/Observability.vue'),
        meta: { title: '可观测性' },
      },
      // 监控告警
      {
        path: 'monitoring/alerts',
        name: 'Alerts',
        component: () => import('@/views/Alerts.vue'),
        meta: { title: '监控告警' },
      },
      // 模板生成
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/views/Templates.vue'),
        meta: { title: '模板生成' },
      },
      // 成本追踪
      {
        path: 'cost',
        name: 'CostTracking',
        component: () => import('@/views/CostTracking.vue'),
        meta: { title: '成本追踪' },
      },
    ],
  },
]
```

## 总结

设计文档已更新，新增了：

✅ **9 个组合式函数** - useRepositories, useTeams, useSecurityPolicies, useAuditLogs, useNotifications, useAIAssistants, useTemplates
✅ **10 个新页面** - 仓库、团队、安全、审计、通知、AI、可观测性、告警、模板、成本
✅ **完整的路由配置** - 所有新页面的路由定义

现在前端设计完全覆盖后端的所有 15 个模块和可观测性功能！
