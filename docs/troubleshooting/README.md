# 问题排查文档索引

本目录记录项目开发过程中遇到的问题、根本原因和解决方案。

---

## 📋 文档分类

### 🔧 基础设施 (Infrastructure)

#### K3s & Flux
- **[K3s + Flux 重装指南（中国网络环境）](./k3s-flux-reinstall-china-network.md)** ⭐ 推荐
  - 完整的 K3s 和 Flux 安装流程
  - 解决 GitHub、Docker Hub 访问问题
  - 配置国内镜像源
  - 适用于腾讯云等中国服务器

- **[Flux 性能优化](./flux-performance-optimization.md)**
  - GitRepository timeout 配置
  - 自动清理失败资源
  - 代理配置

- **[Flux Source Controller 过载](./flux-source-controller-overload.md)**
  - 大量失败资源导致的性能问题
  - 清理策略

#### GitOps
- **[GitOps 同步架构修复](./gitops-sync-architecture-fix.md)**
  - 从事件驱动改为同步调用
  - 解决状态一致性问题

- **[GitOps Kustomization 路径错误](./gitops-kustomization-path-not-found.md)**
  - Kustomization 路径配置问题
  - 环境名称规范

### 🏗️ 架构 (Architecture)

- **[统一模板系统实现](./unified-template-system-implementation.md)**
  - 删除硬编码的 pushInitialCode
  - 统一使用模板渲染系统
  - 内存渲染优化

### 🗄️ 数据库 (Database)

- **[Drizzle Relations 循环依赖](./drizzle-relations-circular-dependency.md)**
  - 关系定义循环依赖问题
  - 解决方案：分离 relations 到独立文件

- **[Drizzle Relations Undefined 错误](./drizzle-relations-undefined-error.md)**
  - 导入顺序导致的 undefined 问题
  - 解决方案：使用 `import * as schema`

---

## 🗂️ 子目录分类

### `/ai/` - AI 相关问题
AI 模块、Ollama 集成、内容过滤等

### `/architecture/` - 架构设计问题
系统架构、模块设计、重构记录

### `/bun/` - Bun 运行时问题
Bun 特定的问题和解决方案

### `/flux/` - Flux CD 问题
Flux 配置、同步、性能问题

### `/frontend/` - 前端问题
Vue、Vite、UI 组件相关

### `/git/` - Git 相关问题
Git 操作、凭证管理、同步问题

### `/kubernetes/` - Kubernetes 问题
K8s 资源、配置、网络问题

### `/nestjs/` - NestJS 问题
NestJS 框架、依赖注入、模块问题

### `/refactoring/` - 重构记录
代码重构、优化、清理记录

### `/startup/` - 启动问题
应用启动、初始化、配置问题

---

## 📝 文档编写规范

### 文档结构

```markdown
# 问题标题

**日期**: YYYY-MM-DD  
**状态**: 已解决 / 进行中 / 已归档  
**影响范围**: 描述影响的功能或模块

## 问题描述
清晰描述问题现象

## 根本原因
分析问题的根本原因

## 解决方案
详细的解决步骤

## 验证
如何验证问题已解决

## 相关文档
链接到相关文档
```

### 命名规范

- 使用 kebab-case
- 描述性名称，体现问题核心
- 例如：`flux-github-timeout-china.md`

### 状态标记

- ✅ **已解决** - 问题已完全解决
- 🔄 **进行中** - 正在解决
- 📦 **已归档** - 历史问题，仅供参考
- ⭐ **推荐** - 重要文档，建议阅读

---

## 🔍 快速查找

### 按问题类型

| 问题类型 | 相关文档 |
|---------|---------|
| 网络访问 | k3s-flux-reinstall-china-network.md |
| 性能问题 | flux-performance-optimization.md, flux-source-controller-overload.md |
| 配置错误 | gitops-kustomization-path-not-found.md |
| 架构优化 | gitops-sync-architecture-fix.md, unified-template-system-implementation.md |
| 数据库 | drizzle-relations-*.md |

### 按技术栈

| 技术 | 相关文档 |
|------|---------|
| K3s | k3s-flux-reinstall-china-network.md |
| Flux | flux-*.md, gitops-*.md |
| Drizzle ORM | drizzle-*.md |
| GitOps | gitops-*.md |

---

## 📚 相关资源

- [项目指南](../../.kiro/steering/project-guide.md) - 核心原则和规范
- [架构文档](../architecture/) - 系统架构设计
- [操作指南](../guides/) - 功能使用指南
- [教程](../tutorials/) - 深入学习教程

---

## 🤝 贡献指南

遇到新问题时：

1. **记录问题** - 创建新的 markdown 文档
2. **分析原因** - 找到根本原因，不只是表面现象
3. **提供方案** - 给出可行的解决方案
4. **验证结果** - 确保问题真正解决
5. **更新索引** - 在本文件中添加链接

---

**最后更新**: 2024-12-18
