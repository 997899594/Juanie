# Git 认证 - 工作空间上下文方案

## 🎯 核心设计理念

**用户选择工作空间 → 系统自动推荐认证方式**

不需要用户理解复杂的认证概念，系统根据工作空间上下文自动做出最佳选择。

## 📊 用户体验流程

### 场景 1: 个人开发者（最简单）

```
1. 登录系统
   └─ 默认进入 "个人工作空间"

2. 创建项目
   └─ 系统提示: "当前在个人工作空间，推荐使用 OAuth 认证"

3. 点击 "使用 OAuth 授权"
   └─ 跳转到 GitHub/GitLab 授权页面

4. 授权完成
   └─ 自动返回，配置完成 ✅
```

**用户操作**: 2 次点击
**理解成本**: 零（不需要理解认证方式）

### 场景 2: 团队协作（组织）

```
1. 登录系统
   └─ 右上角切换到 "Acme Corp" 组织

2. 创建项目
   └─ 系统提示: "当前在 Acme Corp，推荐使用 GitHub App 认证"

3. 填写 GitHub App 配置
   ├─ App ID
   ├─ Installation ID
   └─ Private Key

4. 保存配置
   └─ 配置完成 ✅
```

**用户操作**: 切换工作空间 + 填写配置
**理解成本**: 低（系统已经推荐了最佳方式）

### 场景 3: 工作空间切换

```
顶部导航栏:
┌─────────────────────────────────┐
│ [👤 张三] ▼  项目  设置  帮助    │
└─────────────────────────────────┘
     │
     ├─ 👤 个人工作空间 ✓
     ├─ 🏢 Acme Corp
     ├─ 🏢 Tech Startup
     ├─ ─────────────
     ├─ ➕ 创建组织
     └─ 👥 加入组织
```

**切换效果**:
- 项目列表自动更新
- 推荐认证方式自动更新
- 上下文提示自动更新

## 🎨 UI 组件

### 1. WorkspaceSwitcher（顶部导航栏）

```vue
<WorkspaceSwitcher />
```

**功能**:
- 显示当前工作空间
- 快速切换工作空间
- 创建/加入组织

**位置**: 顶部导航栏左侧

### 2. GitAuthSelector（智能认证选择器）

```vue
<GitAuthSelector :project-id="projectId" />
```

**功能**:
- 自动显示工作空间上下文
- 自动推荐最佳认证方式
- 动态加载对应表单

**特点**:
- 无需传递 `provider` 和 `isOrganization`
- 自动从工作空间 store 获取上下文
- 智能推荐，用户可以手动覆盖

## 💡 技术实现

### 工作空间 Store

```typescript
// stores/workspace.ts
export const useWorkspaceStore = defineStore('workspace', () => {
  const currentWorkspace = ref<Workspace | null>(null)
  
  const isPersonal = computed(() => 
    currentWorkspace.value?.type === 'personal'
  )
  
  const recommendedAuthType = computed(() => {
    if (isPersonal.value) {
      return { type: 'oauth', label: 'OAuth 认证', ... }
    }
    return { type: 'github_app', label: 'GitHub App', ... }
  })
  
  return { currentWorkspace, isPersonal, recommendedAuthType }
})
```

### 组件自动适配

```vue
<script setup>
import { useWorkspaceStore } from '@/stores/workspace'

const workspaceStore = useWorkspaceStore()
const { recommendedAuthType } = storeToRefs(workspaceStore)

// 自动选择推荐的认证方式
watch(recommendedAuthType, (recommended) => {
  if (recommended) {
    selectedAuthType.value = recommended.type
  }
}, { immediate: true })
</script>
```

## 📊 对比：传统 vs 现代化

| 维度 | 传统方式 | 现代化方式（工作空间） |
|-----|---------|---------------------|
| **用户理解** | 需要理解认证方式区别 | 只需选择工作空间 |
| **操作步骤** | 5-6 步 | 2-3 步 |
| **错误率** | 高（容易选错） | 低（系统推荐） |
| **团队协作** | 需要手动配置 | 自动使用组织认证 |
| **切换成本** | 需要重新配置 | 一键切换 |

## 🎯 用户教育

### 首次使用引导

```
欢迎使用！👋

你现在在 "个人工作空间"
这里适合个人项目和实验

如果你是团队成员，可以：
1. 点击右上角头像
2. 切换到组织工作空间
3. 享受团队协作功能
```

### 上下文提示

```
┌─────────────────────────────────────┐
│ ℹ️ 当前工作空间                      │
│                                     │
│ 个人工作空间 - 使用你的个人账户       │
│ 推荐使用: OAuth 认证                 │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│ ℹ️ 当前工作空间                      │
│                                     │
│ Acme Corp - 组织工作空间             │
│ 推荐使用: GitHub App                 │
│ 原因: 组织级别权限控制，最佳安全性    │
└─────────────────────────────────────┘
```

## 🔄 状态同步

### 工作空间切换时

```typescript
watch(currentWorkspace, async (newWorkspace) => {
  // 1. 更新 URL（可选）
  router.push({ query: { workspace: newWorkspace.id } })
  
  // 2. 刷新项目列表
  await refreshProjects(newWorkspace.id)
  
  // 3. 更新推荐认证
  // 自动通过 computed 更新
  
  // 4. 保存到本地
  localStorage.setItem('lastWorkspace', newWorkspace.id)
  
  // 5. 显示提示
  toast({
    title: '工作空间已切换',
    description: `当前: ${newWorkspace.name}`
  })
})
```

## 🎉 优势总结

### 1. 用户体验
- ✅ **零学习成本** - 不需要理解认证概念
- ✅ **智能推荐** - 系统自动选择最佳方式
- ✅ **快速切换** - 一键切换工作空间
- ✅ **清晰上下文** - 始终知道当前在哪里工作

### 2. 团队协作
- ✅ **自动隔离** - 个人和组织项目自动分离
- ✅ **统一认证** - 组织项目自动使用组织认证
- ✅ **权限清晰** - 基于工作空间的权限管理

### 3. 技术实现
- ✅ **简单集成** - 组件自动适配工作空间
- ✅ **状态管理** - Pinia store 统一管理
- ✅ **类型安全** - 完整的 TypeScript 支持

## 🚀 实施步骤

### Phase 1: 基础设施（已完成）
- ✅ 工作空间 Store
- ✅ WorkspaceSwitcher 组件
- ✅ GitAuthSelector 自动适配

### Phase 2: 后端支持（待实施）
- [ ] 工作空间 API
- [ ] 组织管理 API
- [ ] 权限控制

### Phase 3: 完善体验（待实施）
- [ ] 首次使用引导
- [ ] 工作空间设置页面
- [ ] 成员管理

## 💭 最佳实践

### 1. 默认行为
```typescript
// 新用户默认创建个人工作空间
// 自动使用 OAuth 认证
```

### 2. 智能提示
```typescript
// 在个人工作空间创建组织项目时提示
if (isPersonal && projectType === 'organization') {
  showTip('建议切换到组织工作空间')
}
```

### 3. 平滑迁移
```typescript
// 项目从个人转移到组织时
// 自动提示切换认证方式
```

## 🎯 总结

**最现代化的方案 = 工作空间优先 + 智能推荐**

用户只需要：
1. 选择在哪里工作（个人/组织）
2. 系统自动处理其他一切

**简单、智能、好用！** 🚀
