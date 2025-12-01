# Git 相关问题总结

## 已解决的问题

### 1. 仓库名称验证问题 (2025-11-28)

**问题**: 创建项目时，如果项目名称包含中文或特殊字符，GitHub/GitLab API 返回 422 错误。

**解决方案**: 
- 后端自动清理仓库名称
- 前端实时验证和提示

**详细文档**: [repository-name-validation.md](./repository-name-validation.md)

**影响**: 
- ✅ 用户可以使用任意项目名称
- ✅ 系统自动转换为合法的仓库名称
- ✅ 前端提供实时反馈和建议

---

## 相关资源

### 测试脚本
- `scripts/test-repo-name-sanitization.ts` - 测试名称清理功能

### 工具函数
- `apps/web/src/utils/repository.ts` - 前端验证工具
- `GitProviderService.sanitizeRepositoryName()` - 后端清理方法

### 组件
- `RepositoryConfig.vue` - 仓库配置组件（包含验证）

---

## 最佳实践

### 推荐的命名方式
```
✅ my-project
✅ web-app-2024
✅ user_service
✅ api-gateway
```

### 避免的命名方式
```
❌ 我的项目 (中文)
❌ My Project! (特殊符号)
❌ test@project (特殊符号)
❌ -test- (以连字符开头)
```

---

## 未来改进

### 计划中的功能
- [ ] 支持自定义仓库名称模板
- [ ] 批量验证多个仓库名称
- [ ] 导出验证规则为独立包

### 可能的优化
- 支持更多 Git 提供商的特殊规则
- 添加仓库名称冲突检测
- 提供更智能的名称建议

---

## 相关文档

- [仓库名称验证详细文档](./repository-name-validation.md)
- [GitHub 仓库命名规范](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories#repository-name-requirements)
- [GitLab 项目命名规范](https://docs.gitlab.com/ee/user/reserved_names.html)
