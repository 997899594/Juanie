# 数据库重构 - 关键阻塞问题

> 时间: 2024-12-19
> 状态: 🔴 阻塞中

## 问题描述

在修复字段重命名（`gitUsername` → `username`）时，发现更严重的问题：

**多个业务逻辑文件依赖已删除的 `project.gitProvider` 和 `project.gitRepoUrl` 字段**

这些字段已从 `projects` 表删除，但以下关键业务逻辑还在使用：

### 受影响的文件

1. **project-collaboration-sync.service.ts** (项目协作同步)
   - 4处使用 `project.gitProvider`
   - 1处使用 `project.gitRepoUrl`
   - 功能：同步项目成员到 Git 仓库

2. **git-platform-sync.service.ts** (Git 平台同步)
   - 4处使用 `project.gitProvider`
   - 4处使用 `project.gitRepoUrl`
   - 功能：处理 Git webhook 事件

## 问题严重性

**严重程度**: 🔴 高

这些是核心业务逻辑，影响：
- 项目成员同步到 Git 仓库
- Git webhook 事件处理
- 协作者权限管理

## 解决方案

### 方案 A: 完整重构（推荐但耗时）

修改所有使用 `project.gitProvider` 的地方，改为通过 `repositories` 表查询：

```typescript
// 修改前
const provider = project.gitProvider
const repoUrl = project.gitRepoUrl

// 修改后
const repository = await this.db.query.repositories.findFirst({
  where: eq(schema.repositories.projectId, project.id)
})
if (!repository) {
  throw new Error('Repository not found for project')
}
const provider = repository.provider
const repoUrl = repository.cloneUrl
```

**优点**:
- 符合新的数据库设计
- 数据来源单一，避免不一致

**缺点**:
- 需要修改多个文件
- 需要添加额外的数据库查询
- 需要处理 repository 不存在的边界情况
- 预计时间: 2-3 小时

### 方案 B: 临时回退（快速但不推荐）

暂时保留 `projects` 表的 Git 字段，延后重构。

**优点**:
- 快速恢复编译
- 系统可以立即运行

**缺点**:
- 违反"绝不向后兼容"原则
- 数据冗余问题依然存在
- 后续还要再改一次

### 方案 C: 渐进式重构（折中方案）

1. **第一步**: 在 `ProjectsService` 中添加辅助方法
   ```typescript
   async getProjectWithRepository(projectId: string) {
     const project = await this.getProject(projectId)
     const repository = await this.repositoriesService.findByProjectId(projectId)
     return { ...project, repository }
   }
   ```

2. **第二步**: 逐个文件修改，使用新方法

3. **第三步**: 完成后删除旧字段

**优点**:
- 分步进行，风险可控
- 可以逐个测试
- 代码更清晰

**缺点**:
- 仍需要一定时间
- 预计时间: 1.5-2 小时

## 当前状态

### 已完成 ✅
- Schema 更新（git_connections 表）
- 字段重命名（username, email, avatarUrl, status）
- GitConnectionsService 创建
- repositories.service.ts Flux 字段修复
- conflict-resolution.service.ts 字段重命名

### 待完成 ⏳
- project-collaboration-sync.service.ts (6处修改)
- git-platform-sync.service.ts (8处修改)
- 其他可能的引用

## 建议

**推荐方案 C（渐进式重构）**

理由：
1. 符合项目原则（不向后兼容）
2. 风险可控，可以分步测试
3. 时间成本可接受（1.5-2小时）
4. 代码质量有保证

## 下一步行动

如果选择方案 C：

1. 在 `ProjectsService` 添加 `getProjectWithRepository()` 方法
2. 在 `RepositoriesService` 添加 `findByProjectId()` 方法（如果没有）
3. 修改 `project-collaboration-sync.service.ts`
4. 修改 `git-platform-sync.service.ts`
5. 运行编译测试
6. 应用数据库迁移
7. 启动开发环境测试

## 预计完成时间

- 方案 A: 2-3 小时
- 方案 B: 30 分钟（不推荐）
- 方案 C: 1.5-2 小时（推荐）

## 风险评估

- **技术风险**: 中等（需要修改核心业务逻辑）
- **测试风险**: 中等（需要测试 Git 同步功能）
- **回滚风险**: 低（可以通过 Git 回滚代码）
