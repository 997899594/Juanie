# Requirements Document

## Introduction

前端已经迁移到 TanStack Query 进行数据管理，但是许多 Vue 组件仍然在调用不存在的 `fetch*` 方法（如 `fetchOrganizations`, `fetchProjects`, `fetchTeams` 等）。这些方法在旧的 composables 中存在，但在新的 TanStack Query 版本中已被移除，因为 TanStack Query 会自动获取和缓存数据。

本需求旨在系统地修复所有组件，使其正确使用 TanStack Query 的自动数据获取机制。

## Glossary

- **TanStack Query**: 现代化的数据获取和状态管理库，提供自动缓存、失效和重新获取功能
- **Composable**: Vue 3 的组合式函数，用于封装和复用逻辑
- **Query**: TanStack Query 中的数据获取操作，会自动管理加载状态、错误和缓存
- **Mutation**: TanStack Query 中的数据修改操作（创建、更新、删除）
- **Query Invalidation**: 使查询缓存失效，触发数据重新获取

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望所有组件都正确使用 TanStack Query 的自动数据获取机制，这样就不需要手动调用 fetch 方法，代码更简洁且性能更好。

#### Acceptance Criteria

1. WHEN a component needs to display data THEN the system SHALL use TanStack Query's automatic data fetching instead of manual fetch calls
2. WHEN data needs to be refreshed THEN the system SHALL use query invalidation instead of manual refetch calls
3. WHEN a component mounts THEN the system SHALL NOT manually call fetch methods in onMounted hooks
4. WHEN organization/project context changes THEN the system SHALL rely on TanStack Query's reactive query keys to automatically refetch data
5. WHEN a mutation succeeds THEN the system SHALL use queryClient.invalidateQueries to refresh related data

### Requirement 2

**User Story:** 作为开发者，我希望移除所有对不存在的 fetch 方法的调用，这样应用不会出现运行时错误。

#### Acceptance Criteria

1. WHEN searching for fetchOrganizations calls THEN the system SHALL return zero results in Vue components
2. WHEN searching for fetchProjects calls THEN the system SHALL return zero results in Vue components
3. WHEN searching for fetchTeams calls THEN the system SHALL return zero results in Vue components
4. WHEN searching for fetchDeployments calls THEN the system SHALL return zero results in Vue components
5. WHEN searching for fetchEnvironments calls THEN the system SHALL return zero results in Vue components

### Requirement 3

**User Story:** 作为开发者，我希望组件能够正确响应上下文变化（如切换组织），这样用户看到的数据始终是最新的。

#### Acceptance Criteria

1. WHEN currentOrganizationId changes THEN the system SHALL automatically refetch organization-scoped data through reactive query keys
2. WHEN currentProjectId changes THEN the system SHALL automatically refetch project-scoped data through reactive query keys
3. WHEN switching organizations THEN the system SHALL NOT require manual page refresh
4. WHEN query keys include reactive dependencies THEN the system SHALL automatically refetch when dependencies change
5. WHEN using computed query keys THEN the system SHALL properly track reactive dependencies

### Requirement 4

**User Story:** 作为开发者，我希望错误处理和重试逻辑统一由 TanStack Query 管理，这样代码更一致且更容易维护。

#### Acceptance Criteria

1. WHEN a query fails THEN the system SHALL use TanStack Query's error state instead of custom error handling
2. WHEN user clicks retry THEN the system SHALL use query refetch instead of manual fetch calls
3. WHEN displaying error states THEN the system SHALL use the error object from TanStack Query
4. WHEN a mutation fails THEN the system SHALL display error messages from the mutation's onError callback
5. WHEN network errors occur THEN the system SHALL rely on TanStack Query's automatic retry mechanism

### Requirement 5

**User Story:** 作为开发者，我希望加载状态由 TanStack Query 统一管理，这样可以避免手动管理 loading 状态的复杂性。

#### Acceptance Criteria

1. WHEN data is being fetched THEN the system SHALL use isLoading from TanStack Query instead of manual loading flags
2. WHEN multiple queries are in progress THEN the system SHALL combine their loading states using computed properties
3. WHEN displaying loading indicators THEN the system SHALL use the loading state from composables
4. WHEN mutations are pending THEN the system SHALL use isPending from mutations for button loading states
5. WHEN queries are refetching THEN the system SHALL optionally show refetch indicators using isFetching state

### Requirement 6

**User Story:** 作为开发者，我希望组件代码更简洁，移除不必要的 onMounted 和 watch 逻辑，这样代码更易读且更少出错。

#### Acceptance Criteria

1. WHEN a component needs data on mount THEN the system SHALL rely on TanStack Query's automatic fetching instead of onMounted hooks
2. WHEN watching for context changes THEN the system SHALL use reactive query keys instead of manual watch callbacks
3. WHEN data dependencies change THEN the system SHALL automatically refetch through query key reactivity
4. WHEN removing manual fetch logic THEN the system SHALL ensure query keys properly include all dependencies
5. WHEN simplifying components THEN the system SHALL maintain the same user-facing behavior

### Requirement 7

**User Story:** 作为开发者，我希望所有受影响的组件都经过测试，确保迁移后功能正常，这样不会引入回归问题。

#### Acceptance Criteria

1. WHEN a component is migrated THEN the system SHALL verify it displays data correctly on mount
2. WHEN organization context changes THEN the system SHALL verify data updates automatically
3. WHEN mutations are performed THEN the system SHALL verify related queries are invalidated
4. WHEN errors occur THEN the system SHALL verify error states are displayed correctly
5. WHEN testing is complete THEN the system SHALL document any behavior changes in migration notes
