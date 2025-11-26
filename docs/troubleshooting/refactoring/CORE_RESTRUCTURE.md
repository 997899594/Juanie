# Core 包结构重构

## 问题

当前结构不合理：
```
packages/
  core/
    core/          ← 多余的嵌套
      src/
        database/
        queue/
        observability/
        ...
    types/
```

## 目标结构

```
packages/
  core/
    database/      ← 独立包
    types/         ← 独立包
    queue/         ← 独立包
    observability/ ← 独立包
    tokens/        ← 独立包
```

## 重构步骤

### 1. 移动 database 包

```bash
# 从
packages/core/core/src/database/
# 到
packages/core/database/src/
```

### 2. 更新 package.json

```json
{
  "name": "@juanie/core-database",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

### 3. 更新所有导入

```typescript
// 从
import { DATABASE } from '@juanie/core/database'
// 到
import { DATABASE } from '@juanie/core-database'
```

## 暂时的解决方案

先不重构，直接生成迁移文件。重构留到后续优化。
