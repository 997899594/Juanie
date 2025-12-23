# Handlebars 彻底清理计划

## 🎯 目标

彻底删除项目中所有 Handlebars 相关代码，确保只使用 EJS。

## 📋 发现的问题

### 1. 代码文件仍在使用 Handlebars

- `packages/services/business/src/projects/template-manager.service.ts` - **完全使用 Handlebars**
- `packages/services/business/src/templates/templates.service.ts` - **完全使用 Handlebars**
- `packages/services/business/src/projects/templates/templates.module.ts` - 注释提到 Handlebars

### 2. 文档中的引用

- 多个文档仍然提到 Handlebars（仅作为历史记录，可保留）

### 3. Spec 文件中的引用

- `.kiro/specs/` 中的多个文件提到 Handlebars

## ✅ 清理步骤

### 步骤 1: 删除使用 Handlebars 的服务文件

这些文件应该被删除或完全重写：

1. **删除 `template-manager.service.ts`**
   - 这个文件完全基于 Handlebars
   - 功能已被 `template-renderer.service.ts` (EJS) 替代
   - 如果有其他地方引用，需要迁移到 EJS 版本

2. **删除 `templates.service.ts`**
   - 这个文件用于生成 Dockerfile 和 CI/CD 配置
   - 使用 Handlebars 渲染模板
   - 需要重写为 EJS 或直接使用字符串模板

3. **更新 `templates.module.ts`**
   - 删除 Handlebars 相关注释
   - 确保只导出 EJS 相关服务

### 步骤 2: 检查依赖关系

检查哪些文件导入了这些服务：

```bash
# 搜索 template-manager 的使用
grep -r "TemplateManager" --include="*.ts" packages/ apps/

# 搜索 templates.service 的使用
grep -r "TemplatesService" --include="*.ts" packages/ apps/
```

### 步骤 3: 迁移到 EJS

对于需要保留的功能：

1. 使用 `TemplateRenderer` (EJS) 替代 `TemplateManager` (Handlebars)
2. 更新所有导入和调用
3. 确保模板文件使用 EJS 语法 (`<% %>`)

### 步骤 4: 更新 Spec 文件

更新 `.kiro/specs/` 中的文件，将 Handlebars 引用改为 EJS：

- `.kiro/specs/unified-template-system/requirements.md`
- `.kiro/specs/project-production-readiness/tasks.md`
- `.kiro/specs/project-production-readiness/design.md`

### 步骤 5: 清理文档引用

文档中的 Handlebars 引用可以保留作为历史记录，但需要明确标注：

- 在提到 Handlebars 的地方添加 "❌ 已废弃" 标记
- 确保所有新文档只提到 EJS

## 🚨 注意事项

### 不要删除的文档

以下文档应该保留，因为它们记录了迁移历史：

- `docs/troubleshooting/template-system-handlebars-github-actions-conflict.md`
- `docs/architecture/template-system-ejs-migration.md`

### 需要验证的功能

删除 Handlebars 服务后，需要验证：

1. 项目初始化流程是否正常
2. 模板渲染是否正常
3. K8s 配置生成是否正常
4. CI/CD 配置生成是否正常

## 📝 执行清单

- [ ] 删除 `template-manager.service.ts`
- [ ] 删除 `templates.service.ts`
- [ ] 更新 `templates.module.ts`
- [ ] 搜索并更新所有引用
- [ ] 更新 Spec 文件
- [ ] 运行测试验证功能
- [ ] 更新文档标注废弃状态
- [ ] 创建清理完成记录

---

**创建时间**: 2024-12-22  
**状态**: 待执行
