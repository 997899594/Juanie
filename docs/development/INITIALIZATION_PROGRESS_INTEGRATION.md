# 项目初始化进度集成

## 概述

将 `InitializationProgress.vue` 组件集成到项目详情页，提供详细的项目初始化进度展示。

## 改动说明

### 1. ProjectDetail.vue
- **添加导入**: 导入 `InitializationProgress` 组件
- **替换简单横幅**: 用详细的初始化进度组件替换原来的简单状态横幅
- **添加事件处理**: 
  - `handleInitializationComplete()`: 初始化完成后重新加载项目数据
  - `handleInitializationError()`: 处理初始化错误

### 2. InitializationProgress.vue
- **优化步骤定义**: 将步骤定义提取为常量 `INIT_STEPS`
- **改进步骤状态逻辑**: 根据当前步骤索引判断之前的步骤是否完成
- **完善重试功能**: 重置所有步骤状态并重新开始轮询

### 3. ProjectWizard.vue
- **清理未使用导入**: 移除 `InitializationProgress` 和 `EnvironmentConfig` 的未使用导入

## 用户流程

```
用户创建项目 (ProjectWizard)
    ↓
后端开始异步初始化 (project-orchestrator)
    ↓
跳转到项目详情页 (ProjectDetail)
    ↓
显示详细的初始化进度卡片 (InitializationProgress)
    ├─ 10 步初始化流程
    ├─ 实时进度更新（每 2 秒轮询）
    ├─ 错误提示和建议操作
    └─ 重试功能
    ↓
初始化完成后自动刷新项目数据
```

## 初始化步骤

1. **创建项目记录** - 在数据库中创建项目
2. **加载模板配置** - 读取项目模板配置
3. **创建环境** - 创建开发、测试和生产环境
4. **配置 Git 仓库** - 连接或创建 Git 仓库
5. **生成 Kubernetes 配置** - 基于模板生成 K8s YAML 文件
6. **提交配置到 Git** - 将配置文件提交到仓库
7. **创建 GitOps 资源** - 创建 Flux Kustomization/HelmRelease
8. **同步 GitOps 资源** - 等待 Flux 同步配置
9. **验证部署** - 检查 Pod 和服务状态
10. **完成初始化** - 更新项目状态

## 技术细节

### 轮询机制
- 每 2 秒轮询一次项目状态
- 根据 `project.initializationStatus` 更新步骤状态
- 项目状态变为 `active` 或 `failed` 时停止轮询

### 状态映射
- `completed`: 步骤已完成（绿色）
- `running`: 步骤进行中（蓝色，带动画）
- `failed`: 步骤失败（红色，显示错误信息）
- `pending`: 等待执行（灰色）

### 错误处理
- 显示错误信息和建议操作
- 提供重试按钮
- 支持查看日志（功能待实现）

## 待完成功能

1. **后端 API**: 实现重试初始化的 API 端点
2. **日志查看**: 实现查看详细初始化日志的功能
3. **建议操作**: 实现各步骤失败时的建议操作（如重新配置仓库、检查权限等）
4. **WebSocket**: 考虑使用 WebSocket 替代轮询，实现实时更新

## 相关组件

- **InitializationProgress.vue**: 项目初始化进度组件
- **GitOpsDeploymentProgress.vue**: GitOps 部署进度组件（类似功能，用于部署场景）
- **ProjectDetail.vue**: 项目详情页
- **ProjectWizard.vue**: 项目创建向导

## 后端对应

- `packages/services/projects/src/project-orchestrator.service.ts`: 项目编排服务
- `packages/core/database/src/schemas/projects.schema.ts`: 项目数据模型（包含 initializationStatus 字段）
