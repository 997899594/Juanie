# 错误架构迁移完成报告

## ✅ 已完成的工作

### 1. 创建新的错误包

**位置**: `packages/core/errors/`

**结构**:
```
packages/core/errors/
├── src/
│   ├── base.ts              # AppError 基类
│   ├── common.ts            # 通用错误
│   ├── user.ts              # 用户相关
│   ├── organization.ts      # 组织相关
│   ├── team.ts              # 团队相关
│   ├── auth.ts              # 认证相关
│   ├── gitops.ts            # GitOps 相关
│   ├── notification.ts      # 通知相关
│   ├── storage.ts           # 存储相关
│   ├── permission.ts        # 权限相关
│   └── index.ts             # 统一导出
├── package.json
└── tsconfig.json
```

### 2. 清理旧代码

**已清理**:
- ✅ `packages/types/src/errors/` - 已删除（重复定义）
- ✅ `packages/services/foundation/src/errors.ts` - 改为重新导出
- ✅ `packages/core/src/errors/base-errors.ts` - 改为重新导出
- ✅ `packages/services/foundation/src/storage/storage.service.ts` - 移除内联错误类

**保留向后兼容**:
- ✅ Foundation 层的 `errors.ts` 重新导出所有错误
- ✅ Core 层的 `base-errors.ts` 重新导出所有错误
- ✅ `BaseError` 作为 `AppError` 的别名保留

### 3. 更新配置

- ✅ 添加到 workspace: `packages/core/errors`
- ✅ 创建 `package.json` 和 `tsconfig.json`
- ✅ 运行 `bun install` 安装依赖

---

## 📦 新的错误包使用方式

### 导入错误

```typescript
// ✅ 推荐：直接从新包导入
import { 
  OrganizationNotFoundError,
  NotOrganizationMemberError,
  GitConnectionNotFoundError,
} from '@juanie/core-errors'

// ✅ 也可以：从 Foundation 层导入（向后兼容）
import { 
  OrganizationNotFoundError 
} from '@juanie/service-foundation'

// ✅ 也可以：从 Core 层导入（向后兼容）
import { 
  NotFoundError,
  ValidationError 
} from '@juanie/core/errors'
```

### 使用错误

```typescript
// 抛出错误
throw new OrganizationNotFoundError(orgId)

// 捕获并转换为 TRPCError
try {
  await service.doSomething()
} catch (error) {
  if (error instanceof AppError) {
    throw error.toTRPCError()
  }
  throw error
}
```

---

## 🔄 迁移指南

### 对于现有代码

**不需要立即修改**！所有旧的导入路径仍然有效：

```typescript
// ✅ 这些都能正常工作
import { OrganizationNotFoundError } from '@juanie/service-foundation'
import { NotFoundError } from '@juanie/core/errors'
import { BaseError } from '@juanie/core/errors' // 现在是 AppError 的别名
```

### 对于新代码

**推荐使用新的导入路径**：

```typescript
// ✅ 新代码推荐这样写
import { 
  OrganizationNotFoundError,
  NotOrganizationMemberError,
  GitConnectionNotFoundError,
  StorageError,
} from '@juanie/core-errors'
```

### 逐步迁移

可以在方便的时候逐步迁移：

1. **不着急** - 旧代码继续工作
2. **新功能** - 使用新的导入路径
3. **重构时** - 顺便更新导入路径

---

## 📊 架构对比

### 之前（多层定义）

```
Core 层: BaseError + 通用错误
    ↓
Foundation 层: 领域错误（Git, Org, Team...）
    ↓
Types 层: AppError + ErrorFactory（重复！）
    ↓
问题：不知道该在哪定义新错误
```

### 现在（单层定义）

```
@juanie/core-errors: 所有错误定义
    ↓ 导出
所有其他层: 只使用，不定义
    ↓
清晰：所有错误都在一个地方
```

---

## 🎯 优势

1. **易维护** - 所有错误在一个包
2. **易查找** - 不用猜在哪一层
3. **无重复** - 单一定义源
4. **易扩展** - 按模块组织清晰
5. **向后兼容** - 旧代码无需修改

---

## 📝 下一步（可选）

### 短期（1-2周）

1. 新功能使用新的导入路径
2. 重构时顺便更新导入

### 中期（1-2月）

1. 批量更新所有导入路径
2. 删除 Foundation 和 Core 层的重新导出文件

### 长期

1. 添加更多领域错误（Project, Deployment, AI...）
2. 完善错误上下文和用户消息
3. 添加错误监控和告警

---

## 🚀 总结

**核心改变**: 从"多层分散定义"到"单层集中定义"

**原则**: "错误定义集中，错误使用分散"

**结果**: 简单、清晰、易维护的错误架构！

所有错误现在都在 `@juanie/core-errors` 包中，按业务领域组织（user, org, team, gitops...），其他层只需要导入使用即可。
