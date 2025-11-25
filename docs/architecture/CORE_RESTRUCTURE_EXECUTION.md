# Core 包重构 - 执行方案

## 问题

由于 Kiro 的文件操作限制，无法直接移动大量文件。需要你手动执行。

## 推荐方案：使用 Git 和 IDE

### 步骤 1：使用 Git 移动文件（保留历史）

```bash
# 1. 创建新目录
mkdir -p packages/core/database
mkdir -p packages/core/queue  
mkdir -p packages/core/observability
mkdir -p packages/core/events
mkdir -p packages/core/tokens

# 2. 使用 git mv 移动文件（保留历史）
git mv packages/core/core/src/database packages/core/database/src
git mv packages/core/core/src/queue packages/core/queue/src
git mv packages/core/core/src/observability packages/core/observability/src
git mv packages/core/core/src/events packages/core/events/src
git mv packages/core/core/src/tokens packages/core/tokens/src

# 3. 提交
git add .
git commit -m "refactor: restructure core packages"
```

### 步骤 2：创建 package.json 文件

为每个新包创建 `package.json`：

**packages/core/database/package.json:**
```json
{
  "name": "@juanie/core-database",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "drizzle-orm": "0.44.7",
    "postgres": "^3.4.7"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "drizzle-kit": "^0.31.5"
  }
}
```

**packages/core/queue/package.json:**
```json
{
  "name": "@juanie/core-queue",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.2"
  }
}
```

类似地创建其他包的 package.json...

### 步骤 3：更新根目录 package.json

```json
{
  "workspaces": [
    "apps/*",
    "packages/*",
    "packages/config/*",
    "packages/core/database",
    "packages/core/types",
    "packages/core/queue",
    "packages/core/observability",
    "packages/core/events",
    "packages/core/tokens",
    "packages/services/foundation",
    "packages/services/business",
    "packages/services/extensions"
  ]
}
```

### 步骤 4：批量更新导入（使用 IDE）

使用 VSCode 的 "Find and Replace in Files" (Cmd+Shift+H):

1. **更新 database 导入:**
   - Find: `from '@juanie/core/database'`
   - Replace: `from '@juanie/core-database'`

2. **更新 queue 导入:**
   - Find: `from '@juanie/core/queue'`
   - Replace: `from '@juanie/core-queue'`

3. **更新 observability 导入:**
   - Find: `from '@juanie/core/observability'`
   - Replace: `from '@juanie/core-observability'`

4. **更新 events 导入:**
   - Find: `from '@juanie/core/events'`
   - Replace: `from '@juanie/core-events'`

5. **更新 tokens 导入:**
   - Find: `from '@juanie/core/tokens'`
   - Replace: `from '@juanie/core-tokens'`

### 步骤 5：删除旧目录

```bash
# 确认所有文件都已移动
rm -rf packages/core/core

# 提交
git add .
git commit -m "refactor: remove old core directory"
```

### 步骤 6：重新安装依赖

```bash
bun install
```

### 步骤 7：编译验证

```bash
bun run build
```

## 预期问题和解决方案

### 问题 1：TypeScript 路径映射

可能需要更新 `tsconfig.json` 的 paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@juanie/core-database": ["./packages/core/database/src"],
      "@juanie/core-queue": ["./packages/core/queue/src"],
      "@juanie/core-observability": ["./packages/core/observability/src"],
      "@juanie/core-events": ["./packages/core/events/src"],
      "@juanie/core-tokens": ["./packages/core/tokens/src"]
    }
  }
}
```

### 问题 2：循环依赖

如果出现循环依赖，需要调整导入顺序或拆分文件。

### 问题 3：编译错误

逐个修复，主要是导入路径问题。

## 估计工作量

- 文件移动：10 分钟
- 创建 package.json：20 分钟
- 更新导入：30 分钟（使用 Find & Replace）
- 修复编译错误：30-60 分钟
- 测试：30 分钟

**总计：2-3 小时**

## 建议

鉴于工作量较大，建议：

1. **创建新分支**：`git checkout -b refactor/core-packages`
2. **分步提交**：每完成一个包就提交一次
3. **保留旧代码**：先不删除 `packages/core/core`，确保新结构工作后再删
4. **增量迁移**：可以先迁移一个包（如 database），测试通过后再迁移其他

## 快速开始

```bash
# 1. 创建分支
git checkout -b refactor/core-packages

# 2. 执行脚本
chmod +x scripts/restructure-core.sh
./scripts/restructure-core.sh

# 3. 按照上述步骤手动完成剩余工作
```

需要我帮你生成所有新包的 package.json 文件吗？
