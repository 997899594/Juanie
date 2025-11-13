# Composables API 重构文档

## 概述

本次重构统一了所有 Vue composables 的 API 设计模式，从混合的自动/手动模式改为统一的手动获取模式。

## 重构原因

### 之前的问题

1. **API 不一致**：
   - `useDeployments`: 无参数，手动调用 `fetchDeployments(filters)`
   - `useProjects`: 无参数，手动调用 `fetchProjects(organizationId)`
   - `useRepositories`: 必须传 `Ref<string>`，自动 watch
   - `useEnvironments`: 可选参数 `string | Ref<string>`，混合模式

2. **数据获取时机不明确**：
   - 有的 composable 自动获取数据（watch）
   - 有的需要手动调用 fetch 方法
   - 开发者难以预测行为

3. **返回值命名不统一**：
   - 有的用 `loading`，有的用 `isLoading`
   - 有的用 `refetch`，有的用 `fetchXxx`

## 新的统一模式

### API 设计原则

```typescript
export function useXxx() {
  const toast = useToast()
  
  const items = ref<Item[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  /**
   * 获取数据 - 明确接受参数
   */
  const fetchItems = async (requiredParam: string) => {
    if (!requiredParam) return
    
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.xxx.list.query({ requiredParam })
      items.value = result
    } catch (e) {
      error.value = e as Error
      toast.error('获取失败', (e as Error)?.message)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 创建/更新/删除操作
   */
  const create = async (input: any) => {
    isLoading.value = true
    error.value = null
    try {
      const result = await trpc.xxx.create.mutate(input)
      toast.success('创建成功')
      return result
    } catch (e) {
      error.value = e as Error
      toast.error('创建失败', (e as Error)?.message)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    items: computed(() => items.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchItems,
    create,
    update,
    delete: remove,
  }
}
```

### 使用方式

```vue
<script setup>
import { onMounted } from 'vue'
import { useEnvironments } from '@/composables/useEnvironments'

const props = defineProps<{ projectId: string }>()

const { 
  environments, 
  isLoading, 
  fetchEnvironments,
  create 
} = useEnvironments()

// 组件挂载时手动获取
onMounted(() => {
  if (props.projectId) {
    fetchEnvironments(props.projectId)
  }
})

// 或者使用 watchEffect 自动响应
watchEffect(() => {
  if (props.projectId) {
    fetchEnvironments(props.projectId)
  }
})

// 创建后手动刷新
const handleCreate = async (data) => {
  await create(data)
  await fetchEnvironments(props.projectId)
}
</script>
```

## 重构的 Composables

### 1. useEnvironments

**之前**：
```typescript
export function useEnvironments(projectId?: string | Ref<string>)
```

**现在**：
```typescript
export function useEnvironments()
const fetchEnvironments = async (projectId: string) => { ... }
```

### 2. useRepositories

**之前**：
```typescript
export function useRepositories(projectId: Ref<string>)
// 自动 watch projectId 并获取数据
```

**现在**：
```typescript
export function useRepositories()
const fetchRepositories = async (projectId: string) => { ... }
```

## 优势

1. **明确性**：调用方清楚知道何时获取数据
2. **灵活性**：支持条件获取、重新获取、参数变化
3. **可测试性**：不依赖 Vue 响应式系统，易于单元测试
4. **一致性**：所有 composables 遵循相同模式
5. **性能**：避免不必要的自动请求
6. **可控性**：开发者完全控制数据获取时机

## 迁移指南

### 从旧的 useRepositories 迁移

**之前**：
```vue
<script setup>
import { computed } from 'vue'
import { useRepositories } from '@/composables/useRepositories'

const props = defineProps<{ projectId: string }>()
const projectIdRef = computed(() => props.projectId)

// 自动获取数据
const { repositories, isLoading } = useRepositories(projectIdRef)
</script>
```

**现在**：
```vue
<script setup>
import { onMounted } from 'vue'
import { useRepositories } from '@/composables/useRepositories'

const props = defineProps<{ projectId: string }>()

const { 
  repositories, 
  isLoading, 
  fetchRepositories 
} = useRepositories()

// 手动获取数据
onMounted(() => {
  if (props.projectId) {
    fetchRepositories(props.projectId)
  }
})
</script>
```

### 从旧的 useEnvironments 迁移

**之前**：
```vue
<script setup>
const { environments, fetchEnvironments } = useEnvironments()

// 调用时传参数
onMounted(() => {
  fetchEnvironments(props.projectId)
})
</script>
```

**现在**：
```vue
<script setup>
const { environments, fetchEnvironments } = useEnvironments()

// 相同的用法，但内部实现更简洁
onMounted(() => {
  fetchEnvironments(props.projectId)
})
</script>
```

## 注意事项

1. **CRUD 操作后不自动刷新**：
   - 之前：`create()` 后自动调用 `fetchXxx()`
   - 现在：需要手动调用 `fetchXxx()` 刷新数据
   - 原因：让调用方决定是否需要刷新，更灵活

2. **统一使用 isLoading**：
   - 移除了 `isCreating`, `isUpdating`, `isDeleting` 等独立状态
   - 统一使用 `isLoading` 表示任何操作的加载状态
   - 简化了状态管理

3. **错误处理**：
   - 所有方法在失败时都会 throw error
   - 调用方可以使用 try-catch 处理错误
   - composable 内部已经显示 toast 提示

## 相关文件

- `apps/web/src/composables/useEnvironments.ts`
- `apps/web/src/composables/useRepositories.ts`
- `apps/web/src/components/DeploymentsTab.vue`
- `apps/web/src/components/RepositoriesTab.vue`
- `apps/web/src/views/Repositories.vue`
