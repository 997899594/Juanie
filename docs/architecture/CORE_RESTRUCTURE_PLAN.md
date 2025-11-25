# Core 包结构重构 - 详细计划

## 当前结构（不合理）

```
packages/
  core/
    core/                    ← 多余的嵌套！
      src/
        database/
        queue/
        observability/
        events/
        tokens/
      package.json (@juanie/core)
    types/
      src/
      package.json (@juanie/core-types)
```

## 目标结构（合理）

```
packages/
  core/
    database/
      src/
      package.json (@juanie/core-database)
    types/
      src/
      package.json (@juanie/core-types)
    queue/
      src/
      package.json (@juanie/core-queue)
    observability/
      src/
      package.json (@juanie/core-observability)
    events/
      src/
      package.json (@juanie/core-events)
    tokens/
      src/
      package.json (@juanie/core-tokens)
```

## 影响范围

### 需要移动的目录
1. `packages/core/core/src/database/` → `packages/core/database/src/`
2. `packages/core/core/src/queue/` → `packages/core/queue/src/`
3. `packages/core/core/src/observability/` → `packages/core/observability/src/`
4. `packages/core/core/src/events/` → `packages/core/events/src/`
5. `packages/core/core/src/tokens/` → `packages/core/tokens/src/`

### 需要更新的导入（估计 50+ 文件）

**从：**
```typescript
import { DATABASE } from '@juanie/core/database'
import { QUEUE } from '@juanie/core/queue'
import { Trace } from '@juanie/core/observability'
import { GitOpsEvents } from '@juanie/core/events'
```

**到：**
```typescript
import { DATABASE } from '@juanie/core-database'
import { QUEUE } from '@juanie/core-queue'
import { Trace } from '@juanie/core-observability'
import { GitOpsEvents } from '@juanie/core-events'
```

### 需要更新的 package.json

1. 根目录 `package.json` - workspaces 配置
2. 每个新包的 `package.json`
3. 所有依赖 core 包的 `package.json`

## 风险评估

### 高风险
- ❌ 可能破坏现有功能
- ❌ 需要更新大量文件
- ❌ 可能遗漏某些导入
- ❌ 编译错误需要逐个修复

### 建议
**暂时不重构，原因：**
1. 当前结构虽然不优雅，但能正常工作
2. 重构风险大，收益小
3. 可以在后续专门的重构阶段进行
4. 现在应该专注于测试新的 Git 认证功能

## 替代方案

### 方案 A：保持现状（推荐）
- 接受 `packages/core/core/` 的嵌套
- 在文档中标注为"历史遗留"
- 新功能正常工作即可

### 方案 B：渐进式重构
1. 先创建新的包结构
2. 保留旧的导出（兼容层）
3. 逐步迁移导入
4. 最后删除旧结构

### 方案 C：一次性重构（高风险）
1. 移动所有文件
2. 更新所有导入
3. 修复所有编译错误
4. 全面测试

## 建议

**现在不重构，理由：**
1. ✅ 新的 Git 认证功能已实现
2. ✅ 代码已编译通过
3. ✅ 应该先测试功能
4. ⏰ 重构留到功能稳定后

**如果一定要重构：**
- 选择方案 B（渐进式）
- 创建新包但保留旧导出
- 逐步迁移，降低风险
