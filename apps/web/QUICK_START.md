# Web 应用快速开始

## 🚀 立即开始

### 第一步：配置 tRPC 客户端

我们将创建一个类型安全的 API 客户端层。

#### 任务清单
1. ✅ 创建 tRPC 客户端配置
2. ✅ 创建 API Hooks
3. ✅ 配置请求/响应拦截器
4. ✅ 添加错误处理

### 第二步：完善状态管理

重构和完善 Pinia stores。

#### 任务清单
1. ✅ 重构 auth store
2. ✅ 创建 user store
3. ✅ 创建 app store
4. ✅ 添加持久化

### 第三步：路由系统

完善路由配置和守卫。

#### 任务清单
1. ✅ 重构路由配置
2. ✅ 添加路由守卫
3. ✅ 添加路由元信息
4. ✅ 添加面包屑

## 📝 开发优先级

### 🔥 高优先级（立即开始）

#### 1. tRPC 客户端配置
**文件**: `src/api/client.ts`

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@juanie/api-gateway/types'

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL || 'http://localhost:3000/trpc',
      headers() {
        const sessionId = localStorage.getItem('sessionId')
        return sessionId ? { 'x-session-id': sessionId } : {}
      },
    }),
  ],
})
```

#### 2. Auth Store 重构
**文件**: `src/stores/auth.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trpc } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const sessionId = ref<string | null>(localStorage.getItem('sessionId'))
  const user = ref<User | null>(null)
  
  const isAuthenticated = computed(() => !!sessionId.value && !!user.value)
  
  async function login(provider: 'github' | 'gitlab') {
    // OAuth 登录逻辑
  }
  
  async function logout() {
    sessionId.value = null
    user.value = null
    localStorage.removeItem('sessionId')
  }
  
  async function fetchUser() {
    if (!sessionId.value) return
    try {
      user.value = await trpc.users.getMe.query()
    } catch (error) {
      await logout()
    }
  }
  
  return {
    sessionId,
    user,
    isAuthenticated,
    login,
    logout,
    fetchUser,
  }
}, {
  persist: true, // 持久化
})
```

#### 3. 路由守卫
**文件**: `src/router/guards.ts`

```typescript
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function setupRouterGuards(router: Router) {
  // 认证守卫
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    
    // 需要认证的路由
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
    
    // 已登录用户访问登录页
    if (to.name === 'login' && authStore.isAuthenticated) {
      next({ name: 'dashboard' })
      return
    }
    
    next()
  })
  
  // 权限守卫
  router.beforeEach((to, from, next) => {
    const requiredPermission = to.meta.permission
    if (requiredPermission && !hasPermission(requiredPermission)) {
      next({ name: '403' })
      return
    }
    next()
  })
}
```

### ⚡ 中优先级（本周完成）

#### 4. 项目列表页面
**文件**: `src/views/projects/ProjectList.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Card, Input } from '@juanie/ui'
import { useProjects } from '@/composables/useProjects'

const router = useRouter()
const { projects, isLoading, createProject } = useProjects()

const searchQuery = ref('')
const showCreateModal = ref(false)

function handleCreateProject() {
  showCreateModal.value = true
}

function handleProjectClick(projectId: string) {
  router.push({ name: 'project-detail', params: { id: projectId } })
}
</script>

<template>
  <div class="projects-page">
    <div class="page-header">
      <h1>项目</h1>
      <Button @click="handleCreateProject">创建项目</Button>
    </div>
    
    <div class="search-bar">
      <Input v-model="searchQuery" placeholder="搜索项目..." />
    </div>
    
    <div v-if="isLoading" class="loading">
      加载中...
    </div>
    
    <div v-else class="projects-grid">
      <Card
        v-for="project in projects"
        :key="project.id"
        @click="handleProjectClick(project.id)"
        class="project-card"
      >
        <h3>{{ project.name }}</h3>
        <p>{{ project.description }}</p>
      </Card>
    </div>
  </div>
</template>
```

#### 5. 组合式函数
**文件**: `src/composables/useProjects.ts`

```typescript
import { ref, computed } from 'vue'
import { trpc } from '@/api/client'
import { useToast } from '@/composables/useToast'

export function useProjects(organizationId?: string) {
  const toast = useToast()
  const projects = ref([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  
  async function fetchProjects() {
    if (!organizationId) return
    
    isLoading.value = true
    error.value = null
    
    try {
      projects.value = await trpc.projects.list.query({ organizationId })
    } catch (err) {
      error.value = err as Error
      toast.error('加载项目失败')
    } finally {
      isLoading.value = false
    }
  }
  
  async function createProject(data: CreateProjectInput) {
    try {
      const project = await trpc.projects.create.mutate(data)
      projects.value.push(project)
      toast.success('项目创建成功')
      return project
    } catch (err) {
      toast.error('创建项目失败')
      throw err
    }
  }
  
  return {
    projects: computed(() => projects.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchProjects,
    createProject,
  }
}
```

### 📌 低优先级（下周开始）

#### 6. 高级功能
- AI 助手集成
- 成本追踪可视化
- 实时通知
- WebSocket 集成

## 🎯 本周目标

### Day 1-2: 基础设施
- [x] tRPC 客户端配置
- [x] Auth Store 重构
- [x] 路由守卫
- [ ] 错误处理

### Day 3-4: 核心功能
- [ ] 登录页面
- [ ] 仪表板
- [ ] 项目列表
- [ ] 项目详情

### Day 5: 优化
- [ ] 加载状态
- [ ] 错误提示
- [ ] 性能优化
- [ ] 代码审查

## 🔧 开发命令

```bash
# 启动开发服务器
bun run dev

# 类型检查
bun run type-check

# 构建生产版本
bun run build

# 预览构建结果
bun run preview
```

## 📚 关键文件

### 必须创建的文件
```
src/
├── api/
│   ├── client.ts          # tRPC 客户端
│   └── hooks/             # API Hooks
├── composables/
│   ├── useAuth.ts         # 认证
│   ├── useProjects.ts     # 项目
│   └── useToast.ts        # 提示
├── stores/
│   ├── auth.ts            # 认证状态
│   ├── user.ts            # 用户状态
│   └── app.ts             # 应用状态
└── router/
    ├── index.ts           # 路由实例
    ├── routes.ts          # 路由定义
    └── guards.ts          # 路由守卫
```

## 🎨 UI 组件使用

```vue
<script setup lang="ts">
import {
  Button,
  Card,
  Input,
  Dialog,
  Table,
  Badge,
  Avatar,
  Tabs,
} from '@juanie/ui'

import { useTheme } from '@juanie/ui'

const { setTheme, toggleMode, isDark } = useTheme()
</script>

<template>
  <div>
    <Button variant="primary">主要按钮</Button>
    <Card>
      <CardHeader>
        <CardTitle>标题</CardTitle>
      </CardHeader>
      <CardContent>
        内容
      </CardContent>
    </Card>
  </div>
</template>
```

## 🚨 注意事项

### 1. 类型安全
- 始终使用 TypeScript
- 利用 tRPC 的类型推导
- 避免使用 `any`

### 2. 性能
- 使用路由懒加载
- 避免不必要的重渲染
- 使用 `computed` 而不是 `watch`

### 3. 用户体验
- 添加加载状态
- 提供错误反馈
- 使用乐观更新

### 4. 代码质量
- 遵循命名规范
- 添加注释
- 编写测试

## 📞 获取帮助

- 查看 [开发计划](./DEVELOPMENT_PLAN.md)
- 查看 [API 文档](../../docs/BACKEND_GUIDE.md)
- 查看 [UI 组件文档](../../packages/ui/README.md)

---

**准备好了吗？让我们开始吧！** 🚀
