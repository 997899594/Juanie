# TanStack Query Migration Summary

## 已修复的文件

### ✅ Projects.vue
- 移除 `fetchProjects` 调用
- 使用 `useProjectCRUD().useProjectsQuery()`
- 移除 `onMounted` 和 `watch` 中的手动 fetch
- 使用 `refetch` 替代手动 fetch
- 修复 `deleteProject` 调用参数

### ✅ Teams.vue  
- 移除 `fetchTeams` 调用
- 使用 `useTeams(organizationId)` 自动获取数据
- 移除 `onMounted` 和 `watch` 中的手动 fetch
- 添加 Loader2 图标导入

### ✅ ProjectDetail.vue
- 移除 `fetchProject`, `fetchMembers`, `fetchTeams` 调用
- 使用 `useProjectQuery`, `useMembersQuery`, `useTeamsQuery`
- TanStack Query 自动管理数据获取和缓存

### ✅ Deployments.vue
- 移除 `fetchDeployments` 调用
- 使用 reactive `filters` computed 属性
- TanStack Query 自动响应 filters 变化

### ✅ DeploymentsTab.vue
- 移除 `fetchDeployments` 和 `fetchEnvironments` 调用
- 使用 `useDeployments({ projectId })` 和 `useEnvironmentsQuery()`
- 使用 watch 监听环境数据加载

### ✅ Dashboard.vue
- 移除 `fetchProjects` 和 `fetchDeployments` 调用
- 使用 `useProjectsQuery()` 自动获取项目
- 保留 pipelines 的手动 fetch（待迁移）

### ✅ Pipelines.vue
- 移除 `fetchProjects` 调用
- 使用 `useProjectsQuery()` 自动获取项目
- 保留 pipelines 的手动 fetch（待迁移）

### ✅ GitOpsResources.vue
- 移除 `fetchProjects` 调用
- 使用 `useProjectsQuery()` 自动获取项目
- 使用 watch 监听项目数据加载并自动选择

### ✅ CostTracking.vue
- 移除 `fetchProjects` 调用
- 使用 `useProjectsQuery()` 自动获取项目
- 移除 onMounted 中的手动 fetch

## 待修复的文件（其他类型错误）

所有 `fetch*` 方法调用已全部移除！✅

## 剩余问题

主要是其他类型错误，与 TanStack Query 迁移无关：
- useGitSync 中的 API 不匹配
- useNotifications 中的类型定义缺失
- 一些组件中缺少 log 导入
- 一些未使用的变量和导入

这些问题需要单独修复，不在本次 TanStack Query 迁移范围内。

## 核心原则

1. **不要手动调用 fetch**: TanStack Query 会自动获取数据
2. **使用 reactive query keys**: 当依赖变化时自动重新获取
3. **移除 onMounted/watch**: 不需要手动触发数据获取
4. **使用 invalidateQueries**: Mutation 成功后自动刷新相关数据
5. **使用 refetch**: 错误重试时使用 query 的 refetch 方法

## API 对比

### 旧 API (手动 fetch)
```typescript
const { projects, fetchProjects } = useProjects()

onMounted(async () => {
  await fetchProjects(orgId)
})

watch(orgId, async (newId) => {
  await fetchProjects(newId)
})
```

### 新 API (TanStack Query)
```typescript
const { useProjectsQuery } = useProjectCRUD()
const { data: projects } = useProjectsQuery(orgId)

// 不需要 onMounted 或 watch
// TanStack Query 自动处理
```
