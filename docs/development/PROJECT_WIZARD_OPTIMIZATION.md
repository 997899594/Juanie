# 项目创建向导优化文档

## 优化概述

本次优化简化了项目创建流程，使其更符合后端设计和用户体验。

## 优化前的问题

### 1. 流程冗余
- **6 个步骤**过于复杂，用户需要点击多次才能完成
- 环境配置步骤多余，因为模板已经包含了默认环境配置
- 初始化进度作为独立步骤，打断了用户流程

### 2. 信息重复
- 基本信息中可能填写 Git URL
- 仓库配置步骤又要填写 Git URL 和访问令牌
- 用户困惑：为什么要填两次？

### 3. 缺少模板选择
- 虽然后端支持模板驱动，但前端没有明显的模板选择
- 用户不知道可以选择不同的技术栈模板

### 4. 环境配置过早
- 用户在不了解模板的情况下就要配置环境
- 实际上模板已经包含了最佳实践的环境配置

## 优化后的流程

### 新的 4 步流程

```
步骤 1: 基本信息
  - 项目名称
  - 项目标识（自动生成）
  - 项目描述
  - 可见性

步骤 2: 选择模板
  - React 应用
  - Node.js API
  - Go 微服务
  - Python API
  - 静态网站
  - 查看模板详情（技术栈、默认配置）

步骤 3: Git 仓库
  选项 A - 关联现有仓库：
    - Git 提供商（GitHub/GitLab）
    - 仓库 URL
    - 访问令牌
    - 默认分支（可选）
  
  选项 B - 创建新仓库：
    - Git 提供商（GitHub/GitLab）
    - 仓库名称
    - 可见性（public/private）
    - 访问令牌
    - 包含应用代码模板（可选）

步骤 4: 确认创建
  - 显示所有配置摘要
  - 基本信息
  - 选择的模板
  - Git 仓库配置
  - 环境配置（来自模板）
  - 点击"创建项目"
```

### 优化点

#### 1. 简化步骤（6步 → 4步）
- ✅ 移除独立的环境配置步骤
- ✅ 移除独立的初始化进度步骤
- ✅ 环境配置由模板自动提供
- ✅ 初始化进度在项目详情页显示

#### 2. 清晰的模板选择
- ✅ 第 2 步专注于模板选择
- ✅ 显示模板的技术栈和默认配置
- ✅ 用户可以查看模板详情
- ✅ 模板包含环境配置的最佳实践

#### 3. 统一的 Git 配置
- ✅ 只在步骤 3 配置 Git 仓库
- ✅ 清晰的两种模式：关联现有 vs 创建新仓库
- ✅ 访问令牌只需要填写一次
- ✅ 创建新仓库时可选择是否包含代码模板

#### 4. 更好的确认页面
- ✅ 显示完整的配置摘要
- ✅ 包含模板的默认环境配置
- ✅ 用户可以清楚看到将要创建什么
- ✅ 提示创建后可以调整配置

## 用户体验改进

### 创建流程对比

**优化前：**
```
1. 填写基本信息（可能包含 Git URL）
2. 选择模板（不明显）
3. 配置 Git 仓库（重复填写 URL 和令牌）
4. 配置环境（复杂，不知道填什么）
5. 确认创建
6. 等待初始化（阻塞在向导中）
```

**优化后：**
```
1. 填写基本信息（清晰简洁）
2. 选择模板（明确的技术栈选择）
3. 配置 Git 仓库（一次性配置，两种模式清晰）
4. 确认创建（完整摘要，包含模板的环境配置）
   ↓
   创建成功 → 跳转到项目详情页
   ↓
   在项目详情页查看初始化进度（不阻塞）
```

### 关键改进

1. **减少点击次数**：从 6 步减少到 4 步
2. **消除困惑**：Git 配置只需要填写一次
3. **明确选择**：模板选择更加突出
4. **非阻塞初始化**：创建后立即跳转，在项目页面查看进度
5. **智能默认值**：环境配置来自模板，无需手动配置

## 技术实现

### 数据流

```typescript
// 步骤 1: 基本信息
formData = {
  name: "My React App",
  slug: "my-react-app",
  description: "...",
  visibility: "private"
}

// 步骤 2: 选择模板
formData.templateId = "react-app-template"
selectedTemplate = {
  name: "React Application",
  techStack: ["React 18", "Nginx"],
  defaultConfig: {
    environments: [
      { name: "Development", type: "development", replicas: 1, ... },
      { name: "Staging", type: "staging", replicas: 2, ... },
      { name: "Production", type: "production", replicas: 3, ... }
    ]
  }
}

// 步骤 3: Git 仓库
formData.repository = {
  mode: "create",
  provider: "github",
  name: "my-react-app",
  visibility: "private",
  accessToken: "ghp_xxx",
  includeAppCode: true
}

// 步骤 4: 提交创建
POST /api/projects/create
{
  organizationId: "org-123",
  name: "My React App",
  slug: "my-react-app",
  description: "...",
  visibility: "private",
  templateId: "react-app-template",
  repository: { ... }
}

// 后端自动处理：
// 1. 创建项目记录
// 2. 基于模板创建 3 个环境
// 3. 创建 Git 仓库（如果选择创建新仓库）
// 4. 生成 K8s 配置文件
// 5. 提交到 Git
// 6. 创建 GitOps 资源
// 7. 更新项目状态

// 前端跳转到项目详情页
router.push(`/projects/${project.id}`)

// 项目详情页显示初始化进度
<InitializationProgress :project-id="project.id" />
```

### 组件变更

#### ProjectWizard.vue
- ✅ 步骤从 6 个减少到 4 个
- ✅ 移除 `environments` 字段
- ✅ 添加 `templateConfig` 字段
- ✅ 移除独立的初始化进度步骤
- ✅ 创建成功后直接跳转到项目详情页

#### RepositoryConfig.vue
- ✅ 接收 `template` prop，用于显示相关提示
- ✅ 清晰的两种模式切换
- ✅ 创建新仓库时显示"包含代码模板"选项

#### TemplateSelector.vue
- ✅ 突出显示模板选择
- ✅ 显示技术栈和默认配置
- ✅ 提供模板详情查看

#### 移除的组件
- ❌ EnvironmentConfig.vue（不再需要独立配置）

## 后续优化建议

### 1. 模板预览
- 在选择模板时显示更详细的预览
- 包括生成的 K8s 配置示例
- 包括 CI/CD 配置示例

### 2. 智能推荐
- 根据仓库内容自动推荐模板
- 例如：检测到 package.json → 推荐 Node.js 模板

### 3. 快速创建
- 提供"快速创建"选项，使用默认配置
- 只需要填写项目名称和选择模板

### 4. 模板市场
- 允许组织创建自定义模板
- 分享模板给其他组织
- 模板评分和评论

### 5. 批量创建
- 支持从 CSV 或 YAML 批量创建项目
- 适用于迁移场景

## 相关文档

- [项目创建指南](../guides/PROJECT_CREATION_GUIDE.md)
- [模板使用指南](../guides/TEMPLATE_GUIDE.md)
- [项目生产就绪设计](../../.kiro/specs/project-production-readiness/design.md)
