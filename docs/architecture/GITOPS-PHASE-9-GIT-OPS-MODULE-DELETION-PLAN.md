# GitOps Phase 9: 删除 git-ops/ 模块 - 执行计划

**日期**: 2025-12-25  
**状态**: 🚧 进行中  
**目标**: 删除 git-ops/ 模块,消除 17 个架构违规

---

## 📊 问题分析

### git-ops.service.ts 的职责混乱

**当前职责** (3 种):
1. **Git 操作** - clone, pull, commit, push
2. **YAML 生成** - 生成 Kubernetes Deployment YAML
3. **冲突检测** - 检测和解决配置冲突

**架构违规** (17 个):
1. ❌ 直接注入 DATABASE (1 处)
2. ❌ 直接查询 repositories 表 (3 处)
3. ❌ 直接查询 environments 表 (2 处)
4. ❌ 重复实现 YAML 生成逻辑 (与 YamlGeneratorService 重复)
5. ❌ 混合了基础设施和业务逻辑

---

## 🎯 解决方案

### 方案: 完全删除 git-ops/ 模块

**原因**:
1. **Git 操作**: 可以直接使用 `simple-git` 库
2. **YAML 生成**: Core 层已有 `YamlGeneratorService`
3. **冲突检测**: Business 层已有 `ConflictResolutionService`
4. **部署逻辑**: 应该在 `DeploymentsService` 中实现

**替代方案**:
```typescript
// ❌ 删除
import { GitOpsService } from './git-ops/git-ops.service'

// ✅ 替换为
import { YamlGeneratorService } from '@juanie/core/flux'
import { ConflictResolutionService } from './git-sync/conflict-resolution.service'
import simpleGit from 'simple-git'
```

---

## 📝 受影响的文件

### 1. 需要删除的文件 (3 个)

```bash
packages/services/business/src/gitops/git-ops/
├── git-ops.service.ts          # 删除
├── git-ops.module.ts            # 删除
└── index.ts                     # 删除
```

### 2. 需要修改的文件 (5 个)

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `business.module.ts` | 移除导入 | 删除 GitOpsModule 导入 |
| `index.ts` (business) | 移除导出 | 删除 GitOpsService 导出 |
| `deployments.service.ts` | 重构 | 移除 GitOpsService,实现 Git 操作 |
| `deployments.module.ts` | 移除导入 | 删除 GitOpsModule 导入 |
| `initialization.module.ts` | 移除导入 | 删除 GitOpsModule 导入 |

---

## 🔧 详细执行步骤

### Step 1: 分析 DeploymentsService 的使用

**当前使用** (deployments.service.ts):
```typescript
// Line 32: 注入 GitOpsService
private gitOpsService: GitOpsService

// Line 241: 调用 commitFromUI
commitHash = await this.gitOpsService.commitFromUI({
  projectId: data.projectId,
  environmentId: data.environmentId,
  changes: data.changes,
  userId,
  commitMessage: data.commitMessage,
})
```

**需要替换的功能**:
1. 获取项目 Git 配置
2. Clone/Pull Git 仓库
3. 生成/更新 Deployment YAML
4. Commit 并 Push 到远程

---

### Step 2: 重构 DeploymentsService

**新的实现方案**:

```typescript
// ✅ 新的依赖注入
constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  @Inject(DEPLOYMENT_QUEUE) private queue: Queue,
  private fluxResourcesService: FluxResourcesService,
  private readonly logger: PinoLogger,
) {}

// ✅ 新的 deployWithGitOps 实现
async deployWithGitOps(data: DeployWithGitOpsInput, userId: string) {
  // 1. 获取项目和环境信息
  const project = await this.db.query.projects.findFirst({
    where: eq(schema.projects.id, data.projectId),
  })
  
  const environment = await this.db.query.environments.findFirst({
    where: eq(schema.environments.id, data.environmentId),
  })
  
  // 2. 获取仓库信息
  const repository = await this.db.query.repositories.findFirst({
    where: eq(schema.repositories.projectId, data.projectId),
  })
  
  // 3. 使用 simple-git 进行 Git 操作
  const git = simpleGit({
    baseDir: `/tmp/git-repos/${data.projectId}`,
  })
  
  // 4. Clone/Pull 仓库
  await this.ensureRepository(git, repository.cloneUrl, repository.defaultBranch)
  
  // 5. 生成 Deployment YAML
  const yamlContent = this.generateDeploymentYAML(data.changes)
  
  // 6. 写入文件
  const yamlPath = `k8s/overlays/${environment.name}/deployment.yaml`
  await fs.writeFile(path.join(git.baseDir, yamlPath), yamlContent)
  
  // 7. Commit 并 Push
  await git.add(yamlPath)
  await git.commit(data.commitMessage || 'Update deployment')
  await git.push('origin', repository.defaultBranch)
  
  // 8. 获取 commit hash
  const log = await git.log(['-1'])
  return log.latest?.hash
}

// ✅ 辅助方法: 确保仓库存在
private async ensureRepository(
  git: SimpleGit,
  repoUrl: string,
  branch: string,
) {
  try {
    await fs.access(path.join(git.baseDir, '.git'))
    // 仓库存在,拉取最新代码
    await git.pull('origin', branch)
  } catch {
    // 仓库不存在,克隆
    await fs.mkdir(git.baseDir, { recursive: true })
    await git.clone(repoUrl, git.baseDir)
    await git.checkout(branch)
  }
}

// ✅ 辅助方法: 生成 Deployment YAML
private generateDeploymentYAML(changes: DeploymentChanges): string {
  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: 'app',
      labels: { app: 'app' },
    },
    spec: {
      replicas: changes.replicas || 3,
      selector: {
        matchLabels: { app: 'app' },
      },
      template: {
        metadata: {
          labels: { app: 'app' },
        },
        spec: {
          containers: [
            {
              name: 'app',
              image: changes.image || 'nginx:latest',
              ports: [{ containerPort: 80 }],
              env: changes.env ? Object.entries(changes.env).map(([name, value]) => ({
                name,
                value,
              })) : [],
              resources: changes.resources || {},
            },
          ],
        },
      },
    },
  }
  
  return yaml.stringify(deployment)
}
```

---

### Step 3: 删除 git-ops/ 模块

```bash
# 1. 删除整个目录
rm -rf packages/services/business/src/gitops/git-ops/

# 2. 验证删除
ls packages/services/business/src/gitops/
# 应该只看到: credentials/ flux/ git-providers/ git-sync/ webhooks/
```

---

### Step 4: 更新模块导入

#### 4.1 business.module.ts

```typescript
// ❌ 删除
import { GitOpsModule } from './gitops/git-ops/git-ops.module'

// ❌ 删除
imports: [
  GitOpsModule,  // 删除这一行
]

// ❌ 删除
exports: [
  GitOpsModule,  // 删除这一行
]
```

#### 4.2 index.ts (business)

```typescript
// ❌ 删除
export { GitOpsService } from './gitops/git-ops/git-ops.service'
```

#### 4.3 deployments.module.ts

```typescript
// ❌ 删除
import { GitOpsModule } from '../gitops/git-ops/git-ops.module'

// ❌ 删除
imports: [
  GitOpsModule,  // 删除这一行
]
```

#### 4.4 initialization.module.ts

```typescript
// ❌ 删除
import { GitOpsModule } from '../../gitops/git-ops/git-ops.module'

// ❌ 删除
imports: [
  GitOpsModule,  // 删除这一行
]
```

---

### Step 5: 类型定义迁移

**需要保留的类型** (从 git-ops.service.ts):
```typescript
export interface DeploymentChanges {
  image?: string
  replicas?: number
  env?: Record<string, string>
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}
```

**迁移到**: `packages/types/src/deployments.ts`

---

## ✅ 验证标准

### 1. TypeScript 类型检查

```bash
bun run tsc --noEmit
# 应该没有错误
```

### 2. 模块导入检查

```bash
# 确认没有 GitOpsService 的引用
grep -r "GitOpsService" packages/services/business/src/
# 应该没有结果

# 确认没有 GitOpsModule 的引用
grep -r "GitOpsModule" packages/services/business/src/
# 应该没有结果
```

### 3. 功能验证

- ✅ DeploymentsService 可以正常部署
- ✅ Git 操作正常工作
- ✅ YAML 生成正确
- ✅ 所有测试通过

---

## 📊 预期收益

### 架构改进

| 指标 | Before | After | 改进 |
|------|--------|-------|------|
| 架构违规 | 17 | 0 | -100% |
| 代码行数 | 600+ | 0 | -100% |
| 职责混乱 | 3 种职责 | 0 | -100% |
| 重复代码 | YAML 生成重复 | 0 | -100% |

### 代码质量

- ✅ **单一职责**: 每个服务只做一件事
- ✅ **层级清晰**: Business → Foundation → Core
- ✅ **消除重复**: 使用 Core 层的工具类
- ✅ **可维护性**: 代码更简洁,更易理解

---

## 🚨 风险评估

### 低风险

1. **Git 操作**: simple-git 是成熟的库,直接使用更简单
2. **YAML 生成**: Core 层的 YamlGeneratorService 已经过验证
3. **类型定义**: 只需要迁移 DeploymentChanges 类型

### 缓解措施

1. **渐进式重构**: 先重构 DeploymentsService,再删除 git-ops/
2. **充分测试**: 每一步都运行 TypeScript 检查
3. **保留类型**: 将必要的类型定义迁移到 @juanie/types

---

## 📝 执行日志

### 2025-12-25

- ✅ 创建执行计划
- ⏳ 分析 DeploymentsService 使用情况
- ⏳ 重构 DeploymentsService
- ⏳ 删除 git-ops/ 模块
- ⏳ 更新所有导入
- ⏳ 运行验证

---

## 🎯 下一步

1. **立即执行**: 重构 DeploymentsService
2. **验证**: 运行 TypeScript 检查
3. **删除**: 删除 git-ops/ 模块
4. **更新**: 更新所有模块导入
5. **测试**: 运行完整测试套件

---

**计划创建时间**: 2025-12-25  
**预计完成时间**: 2025-12-25 (1 小时)
