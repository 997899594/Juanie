# 操作指南索引

> 如何使用和操作系统的指南文档

## 快速开始

- [快速开始指南](./quick-start.md) - 项目快速上手
- [K3s 远程访问配置](./k3s-remote-access.md) - 配置 K3s 集群远程访问
- [Flux 安装指南](./flux-installation.md) - 安装和配置 Flux CD
- [部署测试指南](./deployment-test.md) - 测试部署流程

## 技术指南

### 现代化改进

- [现代化进度总结](./MODERNIZATION_PROGRESS.md) - 整体进度、成果和经验总结 ⭐
- [现代化任务清单](./MODERNIZATION_TASKS.md) - 完整的任务列表和详细进度
- [2025 实用技术指南](./pragmatic-2025-guide.md) - 2025 年的技术选型和最佳实践

### 可观测性

- [OpenTelemetry 集成指南](./opentelemetry-integration.md) - 完整的可观测性解决方案
  - 后端追踪和指标
  - 前端错误监控
  - 部署配置
  - 使用示例

### TypeScript 高级特性

- [Using Declarations 使用指南](./using-declarations.md) - TypeScript 5.2+ 自动资源管理
  - 配置说明
  - 使用示例
  - 最佳实践
  - 迁移指南

## 开发指南

- [TODO 清理 Issues 清单](./TODO_CLEANUP_ISSUES.md) - 代码中的 TODO 注释整理和 GitHub Issues 模板

## 相关文档

- [架构文档](../architecture/) - 系统架构设计
- [故障排查](../troubleshooting/) - 问题诊断和解决方案
- [API 参考](../API_REFERENCE.md) - API 文档
- [文档变更日志](../CHANGELOG.md) - 所有文档的更新记录

## 文档组织规则

根据 [文档组织规则](../../.kiro/steering/documentation.md)：

- **guides/** - 操作指南（本目录）
- **architecture/** - 架构设计
- **troubleshooting/** - 问题排查
- **tutorials/** - 深入教程
- **api/** - API 文档

## 贡献指南

添加新文档时，请：

1. 确保文档放在正确的目录
2. 使用清晰的文件命名（kebab-case）
3. 在本 README 中添加索引链接
4. 遵循项目的文档模板和风格
