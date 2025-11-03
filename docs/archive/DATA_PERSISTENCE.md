# 数据持久化配置文档

## 概述

本应用使用 `pinia-plugin-persistedstate` 实现状态持久化，确保用户数据在页面刷新后仍然保留。

## 已配置的 Store

### 1. Auth Store (`stores/auth.ts`)

**持久化数据：**
- `sessionId` - 用户会话 ID

**存储位置：** localStorage

**配置：**
```typescript
{
  persist: {
    paths: ['sessionId'],
  },
}
```

**说明：**
- 只持久化 sessionId，不持久化完整的用户信息
- 应用启动时通过 sessionId 验证会话并获取最新用户信息
- 确保安全性和数据一致性

### 2. App Store (`stores/app.ts`)

**持久化数据：**
- `sidebarCollapsed` - 侧边栏折叠状态
- `currentOrganizationId` - 当前选中的组织 ID

**存储位置：** localStorage

**配置：**
```typescript
{
  persist: {
    key: 'app-store',
    storage: localStorage,
    paths: ['sidebarCollapsed', 'currentOrganizationId'],
  },
}
```

**说明：**
- 保存用户的 UI 偏好设置
- 记住用户最后选择的组织
- 提供连续的用户体验

### 3. Preferences Store (`stores/preferences.ts`) ✨ 新增

**持久化数据：**
- `theme` - 主题偏好 ('light' | 'dark' | 'system')
- `language` - 语言偏好 ('zh-CN' | 'en-US')
- `notificationsEnabled` - 是否启用通知
- `soundEnabled` - 是否启用声音
- `compactMode` - 是否启用紧凑模式
- `animationsEnabled` - 是否启用动画

**存储位置：** localStorage

**配置：**
```typescript
{
  persist: {
    key: 'user-preferences',
    storage: localStorage,
    paths: [
      'theme',
      'language',
      'notificationsEnabled',
      'soundEnabled',
      'compactMode',
      'animationsEnabled',
    ],
  },
}
```

**功能：**
- 自动应用主题（支持系统主题）
- 监听系统主题变化
- 语言切换支持
- 完整的用户偏好管理

## 使用示例

### 1. 使用 Auth Store

```typescript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// 初始化认证（应用启动时调用）
await authStore.initialize()

// 检查认证状态
if (authStore.isAuthenticated) {
  console.log('User:', authStore.user)
}

// 登出
await authStore.logout()
```

### 2. 使用 App Store

```typescript
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

// 切换侧边栏
appStore.toggleSidebar()

// 设置当前组织
appStore.setCurrentOrganization('org-id')

// 获取当前组织
const orgId = appStore.currentOrganizationId
```

### 3. 使用 Preferences Store

```typescript
import { usePreferencesStore } from '@/stores/preferences'

const preferences = usePreferencesStore()

// 设置主题
preferences.setTheme('dark')

// 切换主题
preferences.toggleTheme()

// 检查当前主题
if (preferences.isDark) {
  console.log('Dark mode is active')
}

// 设置语言
preferences.setLanguage('en-US')

// 切换通知
preferences.notificationsEnabled = false
```

## 存储结构

### localStorage 键值

```
auth                    // Auth Store (sessionId)
app-store              // App Store (sidebar, organization)
user-preferences       // Preferences Store (theme, language, etc.)
```

### 数据示例

```json
{
  "auth": {
    "sessionId": "session-uuid-here"
  },
  "app-store": {
    "sidebarCollapsed": false,
    "currentOrganizationId": "org-123"
  },
  "user-preferences": {
    "theme": "dark",
    "language": "zh-CN",
    "notificationsEnabled": true,
    "soundEnabled": true,
    "compactMode": false,
    "animationsEnabled": true
  }
}
```

## 安全考虑

### 1. 敏感数据处理

- ❌ **不要持久化：** 完整的用户信息、密码、敏感令牌
- ✅ **可以持久化：** Session ID、用户偏好、UI 状态

### 2. Session 验证

- 应用启动时验证 sessionId 的有效性
- 无效的 session 自动清除
- 重新获取最新的用户信息

### 3. 数据清理

```typescript
// 登出时清理所有持久化数据
authStore.logout() // 自动清理 sessionId
appStore.setCurrentOrganization(null) // 清理组织选择
```

## 最佳实践

### 1. 选择性持久化

只持久化必要的数据，避免存储过多信息：

```typescript
{
  persist: {
    paths: ['field1', 'field2'], // 只持久化指定字段
  },
}
```

### 2. 使用不同的存储

根据数据特性选择存储方式：

```typescript
{
  persist: {
    storage: localStorage,  // 长期存储
    // storage: sessionStorage,  // 会话存储（关闭标签页后清除）
  },
}
```

### 3. 自定义序列化

处理复杂数据类型：

```typescript
{
  persist: {
    serializer: {
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    },
  },
}
```

## 迁移和版本控制

### 处理数据结构变更

```typescript
// 在 store 初始化时检查和迁移旧数据
const version = ref(1)

if (version.value < 2) {
  // 迁移逻辑
  version.value = 2
}
```

### 清除旧数据

```typescript
// 清除特定版本的旧数据
if (localStorage.getItem('old-key')) {
  localStorage.removeItem('old-key')
}
```

## 调试

### 查看持久化数据

```javascript
// 在浏览器控制台
console.log(localStorage.getItem('auth'))
console.log(localStorage.getItem('app-store'))
console.log(localStorage.getItem('user-preferences'))
```

### 清除所有数据

```javascript
// 清除所有 localStorage
localStorage.clear()

// 或者只清除特定的 store
localStorage.removeItem('auth')
localStorage.removeItem('app-store')
localStorage.removeItem('user-preferences')
```

## 性能考虑

### 1. 避免频繁写入

```typescript
// 使用 debounce 减少写入频率
import { useDebounceFn } from '@vueuse/core'

const debouncedUpdate = useDebounceFn(() => {
  // 更新状态
}, 300)
```

### 2. 限制数据大小

- localStorage 限制：通常 5-10MB
- 只存储必要的数据
- 定期清理过期数据

### 3. 异步操作

```typescript
// 大量数据可以考虑使用 IndexedDB
// 或者分批处理
```

## 总结

通过合理配置 Pinia 持久化插件，我们实现了：

✅ **用户认证状态持久化** - 无需重复登录
✅ **应用状态持久化** - 记住用户的选择和偏好
✅ **主题和语言持久化** - 提供一致的用户体验
✅ **安全的数据管理** - 只存储必要的非敏感信息

这些配置确保了应用在页面刷新后能够快速恢复用户的工作状态，提供流畅的用户体验。
