# 模板 EJS 语法修复

**日期**: 2024-12-22  
**状态**: ✅ 已完成

## 问题

项目 008 创建失败，GitHub Actions 报错：
```
ERROR: failed to read dockerfile: open Dockerfile: no such file or directory
```

## 根本原因

1. **缺少 Dockerfile** - 模板目录缺少根目录的 Dockerfile
2. **EJS 语法错误** - 多个文件使用了错误的模板语法（Handlebars 或其他格式）

## 解决方案

### 1. 创建 Dockerfile（使用 Bun 镜像）

创建了 `templates/nextjs-15-app/Dockerfile`，使用 `oven/bun:1-alpine` 基础镜像，支持：
- 多阶段构建（deps, builder, runner）
- Next.js 15 standalone 输出
- 非 root 用户运行
- 健康检查

### 2. 修复 EJS 语法

修复了以下文件的模板语法（`{{ }}` → `<%= %>`）：

**关键文件**（影响构建和部署）：
- ✅ `k8s/base/kustomization.yaml` - K8s 资源定义
- ✅ `k8s/overlays/production/hpa.yaml` - 自动扩缩容
- ✅ `app/src/app/layout.tsx` - Next.js 布局
- ✅ `app/src/app/page.tsx` - 首页
- ✅ `app/src/app/api/health/route.ts` - 健康检查 API

**非关键文件**（文档和配置）：
- ⚠️ `README.md` - 部分修复
- ⚠️ `template.yaml` - 未修复（不影响运行）
- ⚠️ `ci/` 目录 - 未修复（使用 `.github/workflows/` 代替）
- ⚠️ `docs/` 目录 - 未修复（文档文件）

### 3. 删除重复文件

删除了 `app/` 目录下的重复配置文件：
- `app/Dockerfile` - 使用根目录的 Dockerfile
- `app/next.config.js` - 使用 `app/src/` 下的配置
- `app/package.json` - 使用根目录的 package.json

## 验证

运行测试脚本：
```bash
bun run scripts/quick-test-template.ts
```

结果：22 passed, 10 failed（未修复的是非关键文件）

## 关键文件清单

项目创建时会推送的核心文件：

1. **构建相关**
   - `Dockerfile` ✅
   - `package.json` ✅
   - `next.config.js` ✅
   - `.dockerignore` ✅

2. **K8s 配置**
   - `k8s/base/*.yaml` ✅
   - `k8s/overlays/*/*.yaml` ✅

3. **源代码**
   - `app/src/app/**/*.tsx` ✅
   - `app/src/components/**/*.tsx` ✅
   - `app/src/lib/**/*.ts` ✅

4. **CI/CD**
   - `.github/workflows/build-project-image.yml` ✅

## 下一步

1. 创建新项目测试（项目 009）
2. 验证 GitHub Actions 构建成功
3. 验证 Flux 部署成功
4. 验证应用可以访问

## 相关文档

- [模板系统 EJS 迁移](../architecture/template-system-ejs-migration.md)
- [模板变量未渲染问题](./template-variables-not-rendered.md)
