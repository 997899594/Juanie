# Contributing Guide

感谢您考虑为 AI DevOps Platform 做贡献！

## 开发环境设置

### 前置要求

- **Node.js** >= 20
- **Bun** >= 1.0
- **Docker** >= 24.0
- **PostgreSQL** >= 15
- **Redis** >= 7.0

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/ai-devops-platform.git
cd ai-devops-platform

# 2. 安装依赖
bun install

# 3. 复制环境变量
cp .env.example .env

# 4. 启动数据库和 Redis
docker-compose up -d postgres redis

# 5. 运行数据库迁移
bun run db:push

# 6. 启动开发服务器
bun run dev
```

## 开发工作流

### 分支策略

- `main` - 生产分支，始终保持稳定
- `develop` - 开发分支，集成最新功能
- `feature/*` - 功能分支
- `fix/*` - 修复分支

### 提交流程

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **开发和测试**
   ```bash
   # 运行测试
   bun test
   
   # 类型检查
   bun run type-check
   
   # 代码检查
   bun run lint
   ```

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

4. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**:
```
feat(projects): add project template support

- Add template selection in project wizard
- Implement template rendering
- Add tests for template system

Closes #123
```

## 代码规范

### TypeScript

- 使用严格模式
- 避免 `any` 类型
- 为公共 API 添加 JSDoc 注释
- 使用类型推导而非显式类型（当明显时）

```typescript
// ✅ Good
export function createProject(data: CreateProjectInput): Promise<Project> {
  // ...
}

// ❌ Bad
export function createProject(data: any): any {
  // ...
}
```

### 命名约定

- **文件名**: kebab-case (`project-service.ts`)
- **类名**: PascalCase (`ProjectService`)
- **函数/变量**: camelCase (`createProject`)
- **常量**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **接口**: PascalCase (`ProjectConfig`)
- **类型**: PascalCase (`ProjectStatus`)

### 代码组织

```typescript
// 1. Imports
import { Injectable } from '@nestjs/common'
import type { Project } from '@juanie/core-types'

// 2. Types/Interfaces
interface ServiceConfig {
  // ...
}

// 3. Class
@Injectable()
export class ProjectService {
  // 3.1 Properties
  private readonly logger = new Logger()
  
  // 3.2 Constructor
  constructor(private db: Database) {}
  
  // 3.3 Public methods
  async create(data: CreateProjectInput): Promise<Project> {
    // ...
  }
  
  // 3.4 Private methods
  private validate(data: unknown): boolean {
    // ...
  }
}
```

## 测试

### 运行测试

```bash
# 所有测试
bun test

# 特定包
cd packages/services/projects && bun test

# 监听模式
bun test --watch

# 覆盖率
bun test --coverage
```

### 编写测试

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('ProjectService', () => {
  let service: ProjectService
  
  beforeEach(() => {
    service = new ProjectService()
  })
  
  it('should create project', async () => {
    const project = await service.create({
      name: 'Test Project',
      slug: 'test-project',
    })
    
    expect(project.id).toBeDefined()
    expect(project.name).toBe('Test Project')
  })
})
```

### 测试要求

- ✅ 新功能必须有测试
- ✅ Bug 修复必须有回归测试
- ✅ 测试覆盖率 > 80%
- ✅ 测试应该快速且独立

## 文档

### 更新文档

代码变更时，同步更新相关文档：

1. **包级 README** - 更新服务的 README.md
2. **API 注释** - 更新 JSDoc/TSDoc 注释
3. **开发文档** - 更新 docs/development.md
4. **架构文档** - 如果架构变更，更新 docs/architecture.md

### 文档规范

- 使用 Markdown 格式
- 包含代码示例
- 保持简洁和最新
- 使用清晰的标题层级

## 包开发

### 创建新包

```bash
# 1. 创建目录
mkdir -p packages/services/my-service/src

# 2. 创建 package.json
cat > packages/services/my-service/package.json << EOF
{
  "name": "@juanie/service-my-service",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
EOF

# 3. 创建 tsconfig.json
cat > packages/services/my-service/tsconfig.json << EOF
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
EOF

# 4. 创建 README.md
cat > packages/services/my-service/README.md << EOF
# My Service

> Service description

## Quick Start

\`\`\`typescript
import { MyService } from '@juanie/service-my-service'
\`\`\`
EOF
```

### 包依赖

- 使用 workspace 协议：`"@juanie/core-types": "workspace:*"`
- 最小化外部依赖
- 记录依赖原因

## 数据库

### 创建迁移

```bash
# 1. 修改 schema
vim packages/core/database/src/schemas/my-table.schema.ts

# 2. 生成迁移
bun run db:generate

# 3. 应用迁移
bun run db:push

# 4. 验证
bun run db:studio
```

### Schema 规范

```typescript
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const myTable = pgTable('my_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

## PR 检查清单

提交 PR 前确认：

- [ ] 代码通过 `bun run lint`
- [ ] 类型检查通过 `bun run type-check`
- [ ] 测试通过 `bun test`
- [ ] 添加/更新了测试
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] PR 描述清晰
- [ ] 关联了相关 Issue

## 发布流程

（仅维护者）

```bash
# 1. 更新版本
bun run version

# 2. 构建
bun run build

# 3. 发布
bun run publish

# 4. 创建 Release
gh release create v1.0.0
```

## 获取帮助

- 📖 查看 [docs/development.md](./docs/development.md)
- 💬 在 [GitHub Discussions](https://github.com/your-org/ai-devops-platform/discussions) 提问
- 🐛 在 [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues) 报告 bug

## 行为准则

请遵守我们的 [Code of Conduct](./CODE_OF_CONDUCT.md)

---

感谢您的贡献！🎉
