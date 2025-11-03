# 📚 文档索引

## 🚀 快速开始

- [QUICK_START.md](../QUICK_START.md) - 项目快速启动指南
- [README.md](../README.md) - 项目概述

## 📖 核心文档

### 架构与设计
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构说明
- [SERVICES.md](./SERVICES.md) - 微服务说明

### 配置与部署
- [CONFIGURATION.md](./CONFIGURATION.md) - 配置指南
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - 环境变量说明
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [DOCKER_ENV_SHARING.md](./DOCKER_ENV_SHARING.md) - Docker 环境配置

### 数据库与监控
- [DATABASE_CONFIG.md](./DATABASE_CONFIG.md) - 数据库配置
- [MONITORING.md](./MONITORING.md) - 监控配置

### 开发指南
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
- [SHADCN_BEST_PRACTICE.md](./SHADCN_BEST_PRACTICE.md) - UI 组件最佳实践
- [PACKAGE_DEVELOPMENT.md](./PACKAGE_DEVELOPMENT.md) - 包开发指南

### 故障排查
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 常见问题排查

## 📦 归档文档

历史文档和已完成的迁移指南存放在 [archive/](./archive/) 目录。

## 🔧 脚本说明

### 常用脚本（scripts/）

- `check-env.sh` - 检查环境变量配置
- `check-config-deps.sh` - 检查配置依赖
- `fix-vite-freeze.sh` - 修复 Vite 卡死问题
- `kill-stuck-processes.sh` - 清理卡住的进程
- `diagnose-build.sh` - 诊断构建问题
- `dev-web-safe.sh` - 安全启动 Web 应用

### UI 包脚本（packages/ui/scripts/）

- `clean-build.sh` - 清理并重新构建

## 📝 文档维护

- 新增文档请添加到对应分类
- 过时文档移动到 `archive/` 目录
- 更新此索引文件
