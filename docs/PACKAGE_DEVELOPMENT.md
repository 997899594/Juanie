# 包开发指南

本指南说明如何在 Juanie Monorepo 中创建和管理包。

## 目录结构

```
Juanie/
├── apps/                    # 应用程序
│   ├── api/                # 后端 API
│   └── web/                # 前端应用
├── packages/
│   ├── config/             # 共享配置包
│   │   ├── typescript/     # TypeScript 配置
│   │   ├── vitest/         # Vitest 配置
│   │   └── vite/           # Vite 配置
│   ├── core/               # 核心共享包
│   │   ├── database/       # 数据库 schemas 和客户端
│   │   ├── types/          # 共享类型定义
│   │   └── utils/          # 工具函数
│   ├── services/           # 业务服务包（Phase 2）
│   ├── shared/             # 共享组件
│   └── ui/                 # UI 组件库
```

## 包命名规范

### 命名约定

- **配置包**: `@juanie/config-<name>`
  - 例如: `@juanie/config-typescript`, `@juanie/config-vitest`
  
- **核心包**: `@juanie/core-<name>`
  - 例如: `@juanie/core-database`, `@juanie/core-types`, `@juanie/core-utils`
  
- **服务包**: `@juanie/service-<name>`
  - 例如: `@juanie/service-auth`, `@juanie/service-organizations`
  
- **应用**: `@juanie/<name>`
  - 例如: `@juanie/api`, `@juanie/web`

### 目录命名

- 使用 kebab-case: `core-database`, `service-auth`
- 保持简洁和描述性

## 创建新包

### 1. 创建包目录结构

```bash
# 核心包示例
mkdir -p packages/core/my-package/src
cd packages/core/my-package
```

### 2. 创建 package.json

```json
{
  "name": "@juanie/core-my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "files": [
    "dist",
    "src"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist .tsbuildinfo"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "typescript": "^5.9.3"
  },
  "engines": {
    "node": ">=22.0.0",
    "bun": ">=1.0.0"
  }
}
```

### 3. 创建 tsconfig.json

```json
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 4. 创建源代码

```typescript
// src/index.ts
export function myFunction() {
  return 'Hello from my package'
}
```

### 5. 构建包

```bash
bun run build
```

### 6. 在其他包中使用

在需要使用的包的 `package.json` 中添加依赖：

```json
{
  "dependencies": {
    "@juanie/core-my-package": "workspace:*"
  }
}
```

然后运行：

```bash
bun install
```

在代码中导入：

```typescript
import { myFunction } from '@juanie/core-my-package'
```

## 依赖管理规则

### 1. 使用 Workspace Protocol

内部包依赖必须使用 `workspace:*`：

```json
{
  "dependencies": {
    "@juanie/core-database": "workspace:*",
    "@juanie/core-types": "workspace:*"
  }
}
```

### 2. 依赖方向规则

**允许的依赖方向**：

```
apps/* → packages/services/* → packages/core/*
apps/* → packages/core/*
packages/services/* → packages/core/*
```

**禁止的依赖**：

- ❌ `packages/core/*` → `packages/services/*`
- ❌ `packages/core/*` → `apps/*`
- ❌ 循环依赖

### 3. 共享依赖版本

在根 `package.json` 中统一管理共享依赖版本：

```json
{
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.4"
  }
}
```

### 4. Peer Dependencies

配置包应使用 peerDependencies：

```json
{
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

## 包类型

### 配置包 (Config Packages)

- **用途**: 共享配置文件
- **特点**: 
  - 通常是 `private: true`
  - 不需要构建
  - 直接导出配置文件

**示例**: `@juanie/config-typescript`

### 核心包 (Core Packages)

- **用途**: 共享代码、工具、类型
- **特点**:
  - 需要构建（TypeScript → JavaScript）
  - 导出类型定义
  - 可以有单元测试

**示例**: `@juanie/core-database`, `@juanie/core-utils`

### 服务包 (Service Packages)

- **用途**: 业务逻辑模块
- **特点**:
  - 包含 service、router、module
  - 可以依赖其他服务包
  - 需要构建和测试

**示例**: `@juanie/service-auth`, `@juanie/service-organizations`

## 测试

### 添加测试支持

1. 安装依赖：

```json
{
  "devDependencies": {
    "@juanie/config-vitest": "workspace:*",
    "vitest": "^4.0.4"
  }
}
```

2. 创建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
```

3. 添加测试脚本：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

4. 创建测试文件：

```typescript
// test/my-function.test.ts
import { describe, expect, it } from 'vitest'
import { myFunction } from '../src'

describe('myFunction', () => {
  it('should work', () => {
    expect(myFunction()).toBe('Hello from my package')
  })
})
```

## Turborepo 集成

### 确保包被 Turborepo 识别

包会自动被 Turborepo 识别，只要它在 `workspaces` 中定义。

### 使用 Turborepo 构建

```bash
# 构建所有包
turbo build

# 构建特定包
turbo build --filter="@juanie/core-my-package"

# 构建包及其依赖
turbo build --filter="@juanie/core-my-package..."
```

### 缓存优化

Turborepo 会自动缓存构建结果。确保在 `package.json` 中定义正确的输出：

```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

在 `turbo.json` 中，`build` 任务已配置为缓存 `dist/**` 输出。

## 最佳实践

### 1. 保持包小而专注

每个包应该有单一职责：

- ✅ `@juanie/core-database` - 只处理数据库
- ✅ `@juanie/core-utils` - 只包含工具函数
- ❌ `@juanie/core-everything` - 包含所有东西

### 2. 明确的导出

使用 `exports` 字段明确定义包的公共 API：

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./utils": "./dist/utils.js",
    "./types": "./dist/types.js"
  }
}
```

### 3. 类型安全

- 始终导出类型定义
- 使用 TypeScript strict mode
- 为公共 API 添加 JSDoc 注释

### 4. 版本管理

- 使用 Changesets 管理版本
- 遵循语义化版本规范
- 记录 CHANGELOG

### 5. 文档

每个包应该有 README.md：

```markdown
# @juanie/core-my-package

简短描述

## 安装

\`\`\`bash
bun add @juanie/core-my-package
\`\`\`

## 使用

\`\`\`typescript
import { myFunction } from '@juanie/core-my-package'
\`\`\`

## API

### myFunction()

描述...
```

## 常见问题

### Q: 如何检查循环依赖？

使用 `madge` 工具：

```bash
bun add -D madge
npx madge --circular --extensions ts ./packages
```

### Q: 包构建失败怎么办？

1. 检查 TypeScript 配置
2. 确保所有依赖已安装
3. 清理并重新构建：

```bash
bun run clean
bun run build
```

### Q: 如何调试包？

使用 `dev` 脚本进行监听模式开发：

```bash
bun run dev
```

### Q: 如何发布包？

内部包不需要发布到 npm。使用 `workspace:*` 协议即可。

## 相关文档

- [Turborepo 文档](https://turbo.build/repo/docs)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [TypeScript 配置](./TYPESCRIPT_CONFIG.md)
