# GitOps P0 修复行动计划

**日期**: 2025-12-25  
**预计时间**: 35 分钟  
**优先级**: P0 - 立即修复

---

## 问题 1: webhooks/ 模块架构违规

### 当前问题

```typescript
// ❌ packages/services/business/src/gitops/webhooks/webhook.module.ts
import { DatabaseModule } from '@juanie/database'  // 架构违规

@Module({
  imports: [
    DatabaseModule,  // Business 层不应该直接导入 @juanie/database
    // ...
  ],
})
export class WebhookModule {}
```

### 修复方案

**步骤 1**: 检查 `WebhookService` 和 `GitPlatformSyncService` 的数据库使用

```bash
# 搜索数据库直接使用
rg "this\.db\." packages/services/business/src/gitops/webhooks/
rg "DatabaseClient" packages/services/business/src/gitops/webhooks/
```

**步骤 2**: 替换为 Foundation 层服务

```typescript
// ✅ 正确做法
import { GitConnectionsModule } from '@juanie/service-foundation'

@Module({
  imports: [
    GitConnectionsModule,  // 使用 Foundation 层服务
    // ...
  ],
})
export class WebhookModule {}
```

**步骤 3**: 更新服务代码

```typescript
// ❌ 错误：直接查询数据库
constructor(private db: DatabaseClient) {}

async getConnection(projectId: string) {
  return this.db.query.gitConnections.findFirst({
    where: eq(schema.gitConnections.projectId, projectId)
  })
}

// ✅ 正确：使用 Foundation 层服务
constructor(private gitConnectionsService: GitConnectionsService) {}

async getConnection(projectId: string) {
  return this.gitConnectionsService.findByProjectId(projectId)
}
```

**预计时间**: 30 分钟

---

## 问题 2: TypeScript 缓存问题

### 当前问题

```typescript
// ❌ packages/services/business/src/gitops/git-sync/git-sync.service.ts
import { ProjectsService } from '../../projects/core'  // 报错：找不到模块

// packages/services/business/src/projects/core/index.ts
export * from './projects.module'
export * from './projects.service'  // 报错：找不到模块
```

### 根本原因

- 这是 TypeScript 缓存问题，不是代码问题
- 文件 `projects/core/projects.service.ts` 实际存在
- IDE 和 TypeScript 编译器缓存了旧的模块信息

### 修复方案

**步骤 1**: 清理 TypeScript 缓存

```bash
# 运行 reinstall 脚本（会清理所有缓存）
bun run reinstall
```

**步骤 2**: 验证导入

```bash
# 检查文件是否存在
ls -la packages/services/business/src/projects/core/projects.service.ts

# 检查导出
cat packages/services/business/src/projects/core/index.ts
```

**步骤 3**: 重启 IDE

```bash
# 如果问题仍然存在，重启 VS Code
# Command Palette -> Developer: Reload Window
```

**预计时间**: 5 分钟

---

## 执行清单

### 问题 1: webhooks/ 架构违规（30 分钟）

- [ ] 搜索 `WebhookService` 的数据库使用
- [ ] 搜索 `GitPlatformSyncService` 的数据库使用
- [ ] 移除 `DatabaseModule` 导入
- [ ] 添加 `GitConnectionsModule` 导入
- [ ] 更新服务构造函数
- [ ] 替换所有直接数据库查询为 Foundation 层服务调用
- [ ] 运行 `bun run dev:api` 验证
- [ ] 运行 `biome check --write` 格式化代码

### 问题 2: TypeScript 缓存（5 分钟）

- [ ] 运行 `bun run reinstall`
- [ ] 验证文件存在
- [ ] 验证导出正确
- [ ] 重启 IDE（如果需要）
- [ ] 验证导入错误消失

---

## 验证标准

### 问题 1 验证

```bash
# 1. 检查没有直接导入 @juanie/database
rg "@juanie/database" packages/services/business/src/gitops/webhooks/

# 2. 检查使用 Foundation 层服务
rg "GitConnectionsService" packages/services/business/src/gitops/webhooks/

# 3. 启动 API 服务
bun run dev:api

# 4. 检查日志没有错误
```

### 问题 2 验证

```bash
# 1. 检查 TypeScript 编译
bun run build

# 2. 检查 IDE 没有错误提示
# 打开 git-sync.service.ts，检查导入行没有红色波浪线

# 3. 运行 API 服务
bun run dev:api
```

---

## 回滚计划

### 如果问题 1 修复失败

```bash
# 恢复原始代码
git checkout packages/services/business/src/gitops/webhooks/
```

### 如果问题 2 修复失败

```bash
# 重新安装依赖
rm -rf node_modules .bun-cache
bun install
```

---

## 完成后

1. **更新文档**
   - 在 `GITOPS-DEEP-ARCHITECTURE-AUDIT-COMPLETE.md` 中标记 P0 问题为已修复
   - 创建 `GITOPS-P0-FIXES-COMPLETE.md` 记录修复详情

2. **提交代码**
   ```bash
   git add .
   git commit -m "fix(gitops): P0 架构违规修复

   - 移除 webhooks/ 模块的 DatabaseModule 直接导入
   - 使用 Foundation 层 GitConnectionsService
   - 清理 TypeScript 缓存问题
   
   Refs: GITOPS-DEEP-ARCHITECTURE-AUDIT-COMPLETE.md"
   ```

3. **规划 P1 重构**
   - 阅读 `GITOPS-DEEP-ARCHITECTURE-AUDIT-COMPLETE.md` 的 P1 部分
   - 评估工作量和优先级
   - 创建详细的重构计划

---

**创建人**: Kiro AI  
**创建日期**: 2025-12-25  
**预计完成时间**: 35 分钟
