# 文档和脚本清理计划

## 📋 清理策略

### 保留（核心文档）
- README.md - 项目主文档
- docs/ARCHITECTURE.md - 架构说明
- docs/CONFIGURATION.md - 配置指南
- docs/DEPLOYMENT.md - 部署指南
- docs/SERVICES.md - 服务说明
- docs/SHADCN_BEST_PRACTICE.md - UI 组件最佳实践

### 归档（过时但可能有用）
- 移动到 `docs/archive/`
- TYPE_*.md - 类型迁移相关（已完成）
- BACKEND_COMPLETE.md - 后端完成标记
- READY_FOR_TESTING.md - 测试就绪标记
- *_COMPLETE.md, *_FINAL.md - 各种完成标记

### 删除（重复或无用）
- QUICK_START.md - 被 QUICK_START_FIXED.md 替代
- TROUBLESHOOTING_BUILD.md - 合并到主故障排查文档
- 各种临时分析文档

### 脚本整理
- 保留常用脚本
- 删除一次性脚本
- 添加清晰的注释
