# Bun 依赖扁平化修复记录

## 问题描述

项目因为 Bun 的推荐方式（扁平化依赖结构）导致无法运行。Bun 推荐在 monorepo 中不应该让每个子包都有自己的 node_modules，而是使用扁平化的依赖结构，所有依赖都提升到根目录。

## 修复步骤

### 1. 配置 Bun 扁平化依赖

修改 `bunfig.toml`：

```toml
[install]
linkNativeModules = false
hoisting = true           # 完全提升所有依赖
flattenWorkspace = true   # 不在子包中创建 node_modules
symlink = false           # 不创建符号链接
```

### 2. 清理现有 node_modules

```bash
rm -rf node_modules packages/*/node_modules packages/*/*/node_modules apps/*/node_modules bun.lockb
```

### 3. 重新安装依赖

```bash
bun install
```

### 4. 修复循环依赖

**问题**: Foundation 层不应该依赖 Business 层

**修复**: 
- `packages/services/foundation/src/git-accounts/git-account-linking.service.ts`
- 将 `import { EncryptionService } from '@juanie/service-business'` 
- 改为 `import { EncryptionService } from '../encryption/encryption.service'`

### 5. 修复类型错误

创建自动化脚本 `scripts/fix-type-errors.ts` 批量修复：

1. **Error 类型守卫**: 
   - `error.message` → `(error instanceof Error ? error.message : String(error))`
   - `error.stack` → `(error instanceof Error ? error.stack : undefined)`

2. **方法名修复**:
   - `.decryptData(` → `.decrypt(`

3. **导出修复**:
   - 确保 `mapGitPermissionToProjectRole` 正确导出

### 6. 修复导入问题

- 修复 `Logger` 导入：添加到 `@nestjs/common` 导入列表
- 修复数组解构类型问题
- 修复重复导出问题

## 结果

✅ **Bun 依赖配置完成**：
- 所有依赖现在都提升到根目录的 node_modules
- 子包不再有自己的 node_modules（除了少数 Bun 自动创建的特殊依赖）
- 使用扁平化依赖结构

✅ **已修复的关键问题**：
- 循环依赖（foundation → business）
- Logger 导入
- 数组解构类型
- Export 重复导出
- Error 类型守卫（批量修复）
- 方法名不匹配

## 验证

```bash
# 检查依赖结构
find packages apps -name "node_modules" -type d -maxdepth 3

# 构建项目
bun run build

# 运行项目
bun run dev:api
```

## 注意事项

1. Bun 可能会为某些特殊包创建子目录的 node_modules（如 @opentelemetry, zod 等），这是正常的
2. 所有主要依赖都应该在根目录的 node_modules 中
3. 子包的 package.json 仍然需要声明依赖，但实际安装位置在根目录

## 相关文件

- `bunfig.toml` - Bun 配置
- `scripts/fix-type-errors.ts` - 类型错误修复脚本
- `packages/services/foundation/src/encryption/encryption.service.ts` - EncryptionService
- `packages/services/business/src/index.ts` - Business 层导出

## 日期

2024-12-03
