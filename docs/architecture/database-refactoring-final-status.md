# 数据库重构 - 最终状态报告

> 时间: 2024-12-19
> 状态: 85% 完成

## 执行总结

已完成数据库 Schema 重构的核心工作，但代码层面还有部分文件需要适配新的数据结构。

## 已完成工作 ✅

### 1. 数据库 Schema 层（100%）
- ✅ 创建 `git_connections` 表（合并 oauth_accounts 和 user_git_accounts）
- ✅ 删除 `projects` 表的冗余 Git 字段
- ✅ 删除 `repositories` 表的 Flux 状态字段
- ✅ 统一字段命名规范
- ✅ 支持私有 Git 服务器配置

### 2. 核心服务层（90%）
- ✅ `GitConnectionsService` - 统一 Git 连接管理
- ✅ `GitAccountLinkingService` - 更新字段名
- ✅ `ProjectInitializationWorker` - 使用新服务
- ✅ `RepositoriesService` - 修复 Flux 字段 + 添加 `findByProjectId` 方法
- ✅ `ConflictResolutionService` - 更新字段名（部分）
- ⏳ `ProjectCollaborationSyncService` - 进行中（50%）
- ⏳ `GitPlatformSyncService` - 待修复

### 3. 类型和接口（100%）
- ✅ 更新所有输入接口
- ✅ 更新 tRPC 路由验证
- ✅ 标记废弃类型

## 剩余工作 ⏳

### 需要修复的文件（预计 1-1.5 小时）

**1. project-collaboration-sync.service.ts** (50% 完成)
- ✅ 已添加 repository 查询
- ✅ 已修复前半部分的字段引用
- ⏳ 还需修复：
  - `addMember` 方法中的 `project.gitProvider` 和 `project.gitRepoUrl`
  - `removeMember` 方法中的引用
  - `getProjectCollaborationStatus` 方法中的引用
  - 约 10 处需要修改

**2. git-platform-sync.service.ts** (0% 完成)
- ⏳ 需要添加 repository 查询
- ⏳ 需要修复所有 `project.gitProvider` 和 `project.gitRepoUrl` 引用
- 约 8 处需要修改

**3. 测试文件** (0% 完成)
- 所有 `*.spec.ts` 文件还在使用旧字段名
- 可以暂时忽略，后续统一修复

## 技术方案

### 已采用的模式

对于需要 Git 信息的方法：

```typescript
// 1. 在方法开头查询 repository
const repository = await this.db.query.repositories.findFirst({
  where: eq(schema.repositories.projectId, projectId),
})

if (!repository) {
  // 处理没有仓库的情况
  return { skipped: true }
}

// 2. 提取变量
const gitProvider = repository.provider as 'github' | 'gitlab'
const gitRepoUrl = repository.cloneUrl

// 3. 在方法中使用这些变量替代 project.gitProvider
```

### 字段映射

| 旧字段 | 新来源 |
|--------|--------|
| `project.gitProvider` | `repository.provider` |
| `project.gitRepoUrl` | `repository.cloneUrl` |
| `project.gitRepoName` | `repository.fullName` |
| `project.gitDefaultBranch` | `repository.defaultBranch` |
| `gitAccount.gitUsername` | `gitAccount.username` |
| `gitAccount.gitUserId` | `gitAccount.providerAccountId` |
| `gitAccount.gitEmail` | `gitAccount.email` |
| `gitAccount.syncStatus` | `gitAccount.status` |

## 下一步建议

### 选项 A: 立即完成（推荐）

继续修复剩余的 2 个文件，预计 1-1.5 小时可以完成。

**优点**:
- 一次性完成所有修改
- 避免后续遗忘
- 代码状态一致

**缺点**:
- 需要额外时间

### 选项 B: 分阶段完成

1. 先应用数据库迁移（`bun run db:push`）
2. 暂时注释掉有问题的功能
3. 启动开发环境测试核心功能
4. 后续逐步修复

**优点**:
- 可以快速看到效果
- 核心功能可以先运行

**缺点**:
- 部分功能暂时不可用
- 需要记录待修复项

## 建议行动

**推荐选项 A**，理由：
1. 已经完成 85%，剩余工作量不大
2. 修复模式已经明确，执行起来很快
3. 一次性完成避免技术债务累积

## 快速修复脚本

可以使用以下正则替换加速修复：

```bash
# 1. 替换 project.gitProvider
project\.gitProvider → gitProvider

# 2. 替换 project.gitRepoUrl  
project\.gitRepoUrl → gitRepoUrl

# 3. 替换 gitAccount.gitUsername
gitAccount\.gitUsername → gitAccount.username

# 4. 替换 gitAccount.gitUserId
gitAccount\.gitUserId → gitAccount.providerAccountId
```

注意：需要先在文件开头添加 repository 查询和变量定义。

## 数据库迁移

当代码修复完成后，执行：

```bash
# 1. 生成迁移（如果需要）
bun run db:generate

# 2. 应用迁移
bun run db:push

# 3. 验证
bun run db:studio
```

## 成功标准

- [ ] 所有 TypeScript 编译错误修复
- [ ] `bun run build` 成功
- [ ] 数据库迁移成功应用
- [ ] 开发环境可以启动
- [ ] 核心功能可以运行（创建项目、连接 Git）

## 预计完成时间

- 修复剩余代码: 1-1.5 小时
- 应用数据库迁移: 5 分钟
- 测试验证: 30 分钟
- **总计**: 2-2.5 小时
