# 工作空间上下文设计 - 现代化方案

## 🎯 核心概念

### 用户身份层级
```
用户账户 (User Account)
├── 个人工作空间 (Personal Workspace)
│   └── 使用个人认证 (OAuth, PAT)
│
└── 组织工作空间 (Organization Workspace)
    ├── 组织 A
    │   └── 使用组织认证 (GitHub App, Group Token)
    └── 组织 B
        └── 使用组织认证
```

## 🎨 现代化交互设计

### 1. 全局工作空间切换器（类似 GitHub/Vercel）

```
┌─────────────────────────────────────┐
│  [👤 张三]  ▼                       │  ← 顶部导航栏
│                                     │
│  个人工作空间                        │
│  ├─ 📁 我的项目                     │
│  └─ ⚙️  个人设置                    │
│                                     │
│  组织工作空间                        │
│  ├─ 🏢 Acme Corp                   │
│  ├─ 🏢 Tech Startup                │
│  └─ ➕ 创建/加入组织                │
└─────────────────────────────────────┘
```

### 2. 项目创建时的上下文选择

```
创建新项目
┌─────────────────────────────────────┐
│ 项目名称: my-app                     │
│                                     │
│ 所属工作空间: [选择器] ▼             │
│  ├─ 👤 个人工作空间                  │
│  ├─ 🏢 Acme Corp                   │
│  └─ 🏢 Tech Startup                │
│                                     │
│ Git 认证方式: [自动选择] 💡          │
│  → 个人工作空间: OAuth 认证          │
│  → 组织工作空间: GitHub App 认证     │
└─────────────────────────────────────┘
```

### 3. 智能认证推荐

```
当前工作空间: 🏢 Acme Corp

推荐认证方式: GitHub App ⭐
├─ 原因: 组织级别项目
├─ 优势: 最佳安全性、审计友好
└─ 状态: 已配置 ✅

其他可用方式:
├─ OAuth (不推荐，使用个人账户)
└─ PAT (备选方案)
```

## 💡 实现方案

### 方案 1: 基于工作空间的自动选择（推荐）

**优点**: 用户无需理解认证细节，系统自动处理
**适用**: 大多数用户

```typescript
// 用户选择工作空间 → 系统自动选择认证方式
const workspace = userSelectedWorkspace // 'personal' | 'org-123'

if (workspace === 'personal') {
  // 自动使用个人认证
  authType = 'oauth' // 或 'pat'
} else {
  // 自动使用组织认证
  authType = 'github_app' // 或 'gitlab_group_token'
}
```

### 方案 2: 智能推荐 + 手动覆盖

**优点**: 灵活性高，专业用户可以自定义
**适用**: 高级用户

```typescript
// 系统推荐，但允许用户修改
const recommended = getRecommendedAuth(workspace)
const selected = userOverride || recommended
```

### 方案 3: 渐进式引导

**优点**: 教育用户，帮助理解
**适用**: 首次使用

```typescript
// 首次创建项目时显示引导
if (isFirstProject) {
  showOnboarding({
    step1: '选择工作空间',
    step2: '了解认证方式',
    step3: '完成配置'
  })
}
```

## 🔧 技术实现

### 1. 工作空间上下文 Store

```typescript
// stores/workspace.ts
export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    currentWorkspace: null as Workspace | null,
    availableWorkspaces: [] as Workspace[],
  }),

  getters: {
    isPersonal: (state) => state.currentWorkspace?.type === 'personal',
    isOrganization: (state) => state.currentWorkspace?.type === 'organization',
    
    recommendedAuthType: (state) => {
      if (state.currentWorkspace?.type === 'personal') {
        return 'oauth'
      }
      if (state.currentWorkspace?.type === 'organization') {
        return state.currentWorkspace.provider === 'github' 
          ? 'github_app' 
          : 'gitlab_group_token'
      }
      return null
    }
  },

  actions: {
    async switchWorkspace(workspaceId: string) {
      this.currentWorkspace = await fetchWorkspace(workspaceId)
      // 切换后自动刷新相关数据
    }
  }
})
```

### 2. 工作空间类型定义

```typescript
interface Workspace {
  id: string
  type: 'personal' | 'organization'
  name: string
  avatar?: string
  
  // 组织特有字段
  organizationId?: string
  role?: 'owner' | 'admin' | 'member'
  
  // Git 配置
  provider?: 'github' | 'gitlab'
  defaultAuthType?: AuthType
}
```

## 🎨 UI 组件设计

### 1. 工作空间切换器

```vue
<template>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button variant="ghost">
        <Avatar :src="currentWorkspace.avatar" />
        {{ currentWorkspace.name }}
        <ChevronDown class="ml-2 h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    
    <DropdownMenuContent>
      <DropdownMenuLabel>个人工作空间</DropdownMenuLabel>
      <DropdownMenuItem @click="switchTo('personal')">
        <User class="mr-2 h-4 w-4" />
        我的工作空间
      </DropdownMenuItem>
      
      <DropdownMenuSeparator />
      
      <DropdownMenuLabel>组织工作空间</DropdownMenuLabel>
      <DropdownMenuItem 
        v-for="org in organizations" 
        :key="org.id"
        @click="switchTo(org.id)"
      >
        <Building class="mr-2 h-4 w-4" />
        {{ org.name }}
      </DropdownMenuItem>
      
      <DropdownMenuSeparator />
      
      <DropdownMenuItem @click="createOrganization">
        <Plus class="mr-2 h-4 w-4" />
        创建组织
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
```

### 2. 智能认证选择器（简化版）

```vue
<template>
  <div class="space-y-4">
    <!-- 工作空间上下文 -->
    <Alert>
      <InfoIcon class="h-4 w-4" />
      <AlertTitle>当前工作空间</AlertTitle>
      <AlertDescription>
        {{ workspaceContext }}
      </AlertDescription>
    </Alert>

    <!-- 推荐认证方式 -->
    <Card class="border-primary">
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>{{ recommendedAuth.label }}</CardTitle>
          <Badge>推荐</Badge>
        </div>
        <CardDescription>
          {{ recommendedAuth.reason }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button @click="useRecommended" class="w-full">
          使用推荐方式
        </Button>
      </CardContent>
    </Card>

    <!-- 其他方式（折叠） -->
    <Collapsible>
      <CollapsibleTrigger>
        <Button variant="ghost" size="sm">
          查看其他认证方式
          <ChevronDown class="ml-2 h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <!-- 其他认证方式列表 -->
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
```

## 📊 用户流程对比

### 传统方式（复杂）
```
1. 创建项目
2. 选择 Git provider
3. 理解认证方式的区别
4. 选择认证方式
5. 填写配置
6. 完成
```

### 现代化方式（简单）
```
1. 选择工作空间（个人/组织）
2. 创建项目
3. 系统自动选择最佳认证方式
4. 一键授权/填写配置
5. 完成
```

## 🎯 最佳实践

### 1. 默认行为
- 新用户默认使用个人工作空间
- 个人工作空间默认使用 OAuth
- 组织工作空间默认使用组织级认证

### 2. 智能提示
```
当用户在个人工作空间创建项目时:
💡 提示: "使用个人 OAuth 认证，快速开始"

当用户在组织工作空间创建项目时:
💡 提示: "使用组织 GitHub App，更安全的团队协作"
```

### 3. 平滑迁移
```
个人项目 → 转移到组织
├─ 自动提示切换认证方式
├─ 保留原有配置作为备份
└─ 一键迁移到组织认证
```

## 🔄 状态同步

### 工作空间切换时
```typescript
watch(currentWorkspace, async (newWorkspace) => {
  // 1. 更新 UI 上下文
  updateUIContext(newWorkspace)
  
  // 2. 刷新项目列表
  await refreshProjects(newWorkspace.id)
  
  // 3. 更新推荐认证方式
  updateRecommendedAuth(newWorkspace)
  
  // 4. 保存到本地存储
  localStorage.setItem('lastWorkspace', newWorkspace.id)
})
```

## 💡 用户教育

### 首次使用引导
```
欢迎使用！👋

你可以在两种模式下工作：

👤 个人工作空间
   适合个人项目和实验
   使用你的个人 GitHub/GitLab 账户

🏢 组织工作空间
   适合团队协作
   使用组织级别的认证，更安全

你可以随时在右上角切换工作空间
```

### 上下文提示
```
当前在: 🏢 Acme Corp

这个项目将使用组织的 GitHub App 认证
团队成员都可以访问和管理
```

## 🎉 总结

**最现代化的方案**:

1. **工作空间优先** - 用户先选择在哪里工作
2. **自动推荐** - 系统根据工作空间自动选择最佳认证
3. **一键切换** - 顶部导航栏快速切换工作空间
4. **智能提示** - 清晰说明当前上下文和推荐原因
5. **渐进式** - 新用户简单，高级用户灵活

**用户体验**:
- 新用户: 不需要理解认证细节，系统自动处理
- 高级用户: 可以手动选择和自定义
- 团队用户: 清晰的组织上下文，自动使用组织认证

**实现复杂度**: 中等
**用户体验**: 优秀
**维护性**: 良好
