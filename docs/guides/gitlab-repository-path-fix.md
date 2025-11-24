# GitLab 仓库路径验证错误修复

## 🐛 问题描述

创建项目时遇到 GitLab API 错误：

```
gitlab API error: 400 - project_namespace.path: can't be blank, 
can only include non-accented letters, digits, '_', '-' and '.'. 
It must not start with '-', '_', or '.', nor end with '-', '_', '.', '.git', or '.atom'.
```

## 🔍 根本原因

项目名称包含特殊字符（如中文、空格、特殊符号）时，简单的字符替换会导致生成空字符串或不符合 GitLab 规则的路径。

### GitLab 路径规则

1. **允许的字符**: 字母、数字、下划线 `_`、连字符 `-`、点 `.`
2. **不能以这些开头**: `-`, `_`, `.`
3. **不能以这些结尾**: `-`, `_`, `.`, `.git`, `.atom`
4. **不能为空**

## ✅ 解决方案

改进了路径清理逻辑，确保生成的路径始终符合 GitLab 规则。

### 修改内容

**文件**: `packages/core/queue/src/workers/project-initialization.worker.ts`

```typescript
// 为 GitLab 生成安全的 path
let basePath = name
  .toLowerCase()
  .replace(/[^a-z0-9_.-]/g, '-') // 只保留允许的字符
  .replace(/-+/g, '-') // 合并多个连字符
  .replace(/^[-_.]+|[-_.]+$/g, '') // 移除开头和结尾的特殊字符
  .replace(/\.git$|\.atom$/g, '') // 移除 .git 和 .atom 后缀

// 如果处理后为空，使用默认名称
if (!basePath || basePath.length === 0) {
  basePath = 'project'
}

// 确保以字母或数字开头
if (!/^[a-z0-9]/.test(basePath)) {
  basePath = 'p' + basePath
}
```

### 处理示例

| 输入 | 输出 |
|------|------|
| `my-project` | `my-project` ✅ |
| `My Project` | `my-project` ✅ |
| `项目名称` | `project` ✅ |
| `---test` | `test` ✅ |
| `test.git` | `test` ✅ |
| `@#$%` | `project` ✅ |
| `_my_project_` | `my_project` ✅ |

## 🔄 重试机制

如果路径验证失败或冲突，系统会自动重试（最多 3 次），每次添加随机后缀：

```
第 1 次: my-project
第 2 次: my-project-a1b2c3
第 3 次: my-project-d4e5f6
```

## 🧪 测试

创建了完整的测试套件验证路径清理逻辑：

```bash
bun run packages/core/queue/src/workers/__tests__/gitlab-path-sanitizer.test.ts
```

测试覆盖：
- ✅ 正常字符（字母、数字、下划线、连字符、点）
- ✅ 特殊字符（空格、@、#、!等）
- ✅ 中文和其他非 ASCII 字符
- ✅ 开头特殊字符（-、_、.）
- ✅ 结尾特殊字符（-、_、.、.git、.atom）
- ✅ 空字符串和全特殊字符
- ✅ 混合情况

## 📋 用户体验改进

### 1. 更友好的错误提示

如果仍然失败，会显示清晰的错误信息：

```
GitLab 仓库创建失败：项目名称 "###" 包含无效字符。
请使用字母、数字、下划线、连字符或点。
```

### 2. 自动重试提示

```
⚠️ 仓库路径验证失败，正在重试...
```

### 3. 进度反馈

```
正在创建仓库: my-project
正在创建仓库: my-project (尝试 2)
正在创建仓库: my-project (尝试 3)
```

## 🎯 最佳实践

### 推荐的项目名称格式

✅ **推荐**:
- `my-project`
- `my_project`
- `project-2024`
- `api.service`

❌ **避免**:
- 纯中文名称（会被转换为 `project`）
- 纯特殊字符（会被转换为 `project`）
- 以特殊字符开头或结尾
- 包含 `.git` 或 `.atom` 后缀

### 前端验证建议

可以在前端添加实时验证：

```typescript
function validateProjectName(name: string): { valid: boolean; message?: string } {
  // 检查是否为空
  if (!name || name.trim().length === 0) {
    return { valid: false, message: '项目名称不能为空' }
  }
  
  // 检查是否包含有效字符
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  
  if (!sanitized || sanitized.length === 0) {
    return { 
      valid: false, 
      message: '项目名称必须包含字母或数字' 
    }
  }
  
  return { valid: true }
}
```

## 🔧 故障排查

### 问题 1: 仍然收到路径验证错误

**可能原因**: GitLab 实例有自定义验证规则

**解决方案**:
1. 检查 GitLab 实例的配置
2. 使用更简单的项目名称（只包含字母和数字）
3. 联系 GitLab 管理员

### 问题 2: 路径冲突

**症状**: 错误信息包含 "path has already been taken"

**解决方案**: 系统会自动重试并添加随机后缀，无需手动处理

### 问题 3: 项目名称被转换为 "project"

**原因**: 原始名称不包含任何有效字符（如纯中文、纯特殊符号）

**建议**: 使用包含英文字母或数字的名称

## 📚 相关文档

- [GitLab API 文档](https://docs.gitlab.com/ee/api/projects.html)
- [项目初始化流程](./gitops-initialization-summary.md)
- [快速开始指南](./quick-start.md)

## 🎉 总结

通过改进路径清理逻辑和错误处理，现在可以：

1. ✅ 处理任何字符的项目名称
2. ✅ 自动生成符合 GitLab 规则的路径
3. ✅ 自动重试失败的请求
4. ✅ 提供清晰的错误提示
5. ✅ 确保用户体验流畅

用户现在可以使用任何名称创建项目，系统会自动处理路径转换！
