# Git 仓库名称验证问题

## 问题描述

创建项目时，如果项目名称包含非法字符（如中文、特殊符号等），GitHub/GitLab API 会返回 422 错误：

```
Error: github API error: 422 - Repository creation failed.
```

## 根本原因

GitHub 和 GitLab 对仓库名称有严格的命名规范：

### GitHub 规则
- 只能包含字母、数字、连字符（`-`）和下划线（`_`）
- 不能以连字符开头
- 最长 100 个字符
- 区分大小写，但推荐使用小写

### GitLab 规则
- 类似 GitHub，但更严格
- 不能包含某些保留字
- 路径名称必须唯一

## 解决方案

在 `GitProviderService` 中添加了 `sanitizeRepositoryName` 方法，自动清理仓库名称：

```typescript
private sanitizeRepositoryName(name: string): string {
  let sanitized = name
    .toLowerCase()                    // 转换为小写
    .replace(/[^a-z0-9-_]/g, '-')    // 非法字符替换为连字符
    .replace(/^-+/, '')               // 移除开头的连字符
    .replace(/-+/g, '-')              // 合并多个连续的连字符
    .replace(/-+$/, '')               // 移除结尾的连字符
    .substring(0, 100)                // 限制长度

  // 如果清理后为空，使用默认名称
  if (!sanitized) {
    sanitized = 'project-' + Date.now()
  }

  return sanitized
}
```

## 清理示例

| 原始名称 | 清理后 | 说明 |
|---------|--------|------|
| `天赋vu句v聚聚` | `vu-v` | 移除中文字符 |
| `My Project` | `my-project` | 空格替换为连字符 |
| `test@#$%project` | `test-project` | 特殊符号替换为连字符 |
| `---test---` | `test` | 移除开头和结尾的连字符 |
| `Test___Project` | `test___project` | 保留下划线 |
| `UPPERCASE` | `uppercase` | 转换为小写 |
| `中文项目名称` | `project-1234567890` | 全部非法字符，使用默认名称 |

## 影响范围

### 修改的文件
- `packages/services/business/src/gitops/git-providers/git-provider.service.ts`

### 影响的功能
- 项目创建流程
- GitHub 仓库创建
- GitLab 仓库创建

## 用户体验改进

### 之前
1. 用户输入包含中文或特殊字符的项目名称
2. 系统尝试创建 GitHub 仓库
3. GitHub API 返回 422 错误
4. 项目初始化失败
5. 用户需要手动修改项目名称并重试

### 之后
1. 用户输入包含中文或特殊字符的项目名称
2. 系统自动清理名称为合法格式
3. 显示警告日志：`Repository name sanitized: "原名称" -> "清理后"`
4. 成功创建 GitHub 仓库
5. 项目初始化继续

## 最佳实践

### 推荐的项目命名
- ✅ `my-project`
- ✅ `web-app-2024`
- ✅ `user_service`
- ✅ `api-gateway`

### 避免的命名
- ❌ `我的项目` (中文)
- ❌ `My Project!` (特殊符号)
- ❌ `test@project` (特殊符号)
- ❌ `-test-` (以连字符开头)

## 前端改进建议

可以在前端添加实时验证，提前提示用户：

```typescript
function validateRepositoryName(name: string): {
  valid: boolean
  message?: string
  suggestion?: string
} {
  // 检查是否包含非法字符
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    const sanitized = sanitizeRepositoryName(name)
    return {
      valid: false,
      message: '仓库名称只能包含字母、数字、连字符和下划线',
      suggestion: sanitized
    }
  }

  // 检查是否以连字符开头
  if (name.startsWith('-')) {
    return {
      valid: false,
      message: '仓库名称不能以连字符开头',
      suggestion: name.replace(/^-+/, '')
    }
  }

  // 检查长度
  if (name.length > 100) {
    return {
      valid: false,
      message: '仓库名称不能超过 100 个字符',
      suggestion: name.substring(0, 100)
    }
  }

  return { valid: true }
}
```

## 测试

运行测试脚本验证清理功能：

```bash
bun run scripts/test-repo-name-sanitization.ts
```

## 相关问题

- [GitHub 仓库命名规范](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories#repository-name-requirements)
- [GitLab 项目命名规范](https://docs.gitlab.com/ee/user/reserved_names.html)

## 更新日志

- 2025-11-28: 添加仓库名称自动清理功能
- 2025-11-28: 创建测试脚本验证清理逻辑
