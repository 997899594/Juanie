# AI 模块导出修复总结

## 问题描述

API Gateway 启动时报错:
```
SyntaxError: Export named 'AIConfigGenerator' not found in module
```

## 根本原因

`packages/services/extensions/src/index.ts` 中缺少以下服务的导出:
- `AIConfigGenerator`
- `AITroubleshooter`  
- `CodeReviewService`

## 解决方案

### 1. 添加缺失的导出

在 `packages/services/extensions/src/index.ts` 中添加:

```typescript
export { AIConfigGenerator } from './ai/ai/ai-config-generator.service'
export { AITroubleshooter } from './ai/ai/ai-troubleshooter.service'
export { CodeReviewService } from './ai/code-review.service'
```

### 2. 修复类型重复导出问题

**问题**: `AIProvider` 和 `AIMessage` 在 `ai.types.ts` 和 `schemas.ts` 中都有定义,导致类型冲突。

**解决方案**: 
- 保留 `ai.types.ts` 中的手动类型定义(供前后端共享)
- 从 `schemas.ts` 中移除重复的类型导出
- 从 `packages/types/src/index.ts` 中移除 `./ai.types` 的直接导出(已通过 `./ai` 导出)

### 3. 清理未使用的依赖

**AIService**:
- 移除未使用的 `REDIS` 注入和 `_redis` 属性
- 移除未使用的 `BusinessError` 导入

**ContentFilterService**:
- 移除未使用的 `DATABASE` 注入和 `_db` 属性
- 移除未使用的 `BusinessError` 导入

## 验证

```bash
# 构建 extensions 包
bun run build --filter='@juanie/service-extensions'

# 类型检查
bun run type-check --filter='@juanie/service-extensions'
```

## 剩余问题

API Gateway 中还有一些类型不匹配的问题需要修复:
- `ai-code-review.router.ts`: `model` 类型不匹配
- `ai.router.ts`: 函数参数数量不匹配

这些是 API 使用层面的问题,不影响核心导出功能。

## 相关文件

- `packages/services/extensions/src/index.ts`
- `packages/services/extensions/src/ai/ai/ai.service.ts`
- `packages/services/extensions/src/ai/security/content-filter.service.ts`
- `packages/types/src/index.ts`
- `packages/types/src/ai.types.ts`
- `packages/types/src/schemas.ts`

## 日期

2024-12-10
