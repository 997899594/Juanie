# 文档组织结构

本文档说明 docs 目录的组织方式和各目录的用途。

## 目录结构

```
docs/
├── README.md                    # 文档总览
├── API_REFERENCE.md             # API 参考
├── ORGANIZATION.md              # 本文件
├── guides/                      # 操作指南
├── architecture/                # 架构设计文档
├── troubleshooting/             # 问题排查和解决方案
├── tutorials/                   # 教程
└── api/                         # API 详细文档
```

## 各目录说明

### guides/ - 操作指南

**用途：** 如何使用和操作系统的指南

**包含：**
- `quick-start.md` - 快速开始指南
- `development.md` - 开发环境设置
- `deployment.md` - 部署指南
- `flux-installation.md` - Flux 安装指南
- `k3s-remote-access.md` - K3s 远程访问配置
- `KNOWN_HOSTS_SERVICE.md` - KnownHostsService 使用指南
- `deployment-test.md` - 部署测试

**特点：**
- 面向操作和使用
- 提供步骤说明
- 包含配置示例

### architecture/ - 架构设计

**用途：** 系统架构设计和技术决策文档

**包含：**
- `architecture.md` - 总体架构
- `gitops.md` - GitOps 架构
- `gitops-deep-dive.md` - GitOps 深入解析
- `simplified-sse-architecture.md` - SSE 架构
- `three-tier-architecture.md` - 三层架构
- `TODO_FEATURES.md` - 待实现功能

**特点：**
- 描述系统设计
- 解释技术选型
- 记录架构决策

### troubleshooting/ - 问题排查

**用途：** 记录遇到的问题和解决方案

**子目录：**

#### flux/ - Flux GitOps 问题
- SSH 认证问题
- 网络策略问题
- GitOps 初始化问题

#### git/ - Git 认证问题
- OAuth Token 管理
- GitLab/GitHub 认证
- Deploy Key 配置

#### kubernetes/ - Kubernetes 问题
- 资源创建时机
- Namespace 管理
- Secret 配置

#### architecture/ - 架构问题
- 代码冗余
- 设计缺陷

#### refactoring/ - 重构记录
- 清理记录
- 重构方案
- 架构审查

**特点：**
- 问题导向
- 包含症状、原因、解决方案
- 提供诊断工具

### tutorials/ - 教程

**用途：** 深入的技术教程和最佳实践

**包含：**
- `monorepo-turborepo.md` - Monorepo 管理
- `ollama-ai-integration.md` - AI 集成
- `trpc-fullstack-typesafety.md` - tRPC 类型安全

**特点：**
- 深入讲解
- 完整示例
- 最佳实践

### api/ - API 文档

**用途：** API 接口详细文档

**特点：**
- 接口定义
- 参数说明
- 示例代码

## 文档命名规范

### 文件命名

- **小写 + 连字符**：`quick-start.md`, `k3s-remote-access.md`
- **大写（特殊情况）**：`README.md`, `API_REFERENCE.md`
- **临时文档**：使用大写 + 下划线，如 `FIXES_SUMMARY.md`

### 标题规范

- 使用中文或英文，保持一致
- 清晰描述内容
- 避免过长

## 文档编写指南

### guides/ 文档模板

```markdown
# 标题

## 概述
简要说明本指南的目的

## 前置条件
- 需要的环境
- 需要的权限

## 步骤

### 1. 第一步
详细说明...

### 2. 第二步
详细说明...

## 验证
如何验证操作成功

## 故障排查
常见问题和解决方法

## 参考资料
相关链接
```

### troubleshooting/ 文档模板

```markdown
# 问题标题

## 问题描述
简要描述问题现象

## 症状
- 错误信息
- 日志输出
- 观察到的行为

## 根本原因
解释为什么会出现这个问题

## 解决方案

### 方案 1: 标题
步骤...

### 方案 2: 标题（如果有）
步骤...

## 预防措施
如何避免再次出现

## 相关问题
链接到相关的问题文档

## 参考资料
- 官方文档链接
- 相关 Issue 链接
```

### architecture/ 文档模板

```markdown
# 架构名称

## 概述
架构的目的和范围

## 设计目标
- 目标 1
- 目标 2

## 架构图
[图片或 ASCII 图]

## 组件说明

### 组件 1
职责和实现

### 组件 2
职责和实现

## 技术选型
为什么选择这些技术

## 权衡和决策
设计中的权衡考虑

## 未来改进
可能的优化方向
```

## 文档维护

### 添加新文档

1. 确定文档类型（指南/架构/问题）
2. 选择合适的目录
3. 使用规范的命名
4. 遵循模板编写
5. 更新相关索引

### 更新现有文档

1. 保持文档最新
2. 删除过时内容
3. 更新链接
4. 标注更新日期

### 清理文档

1. 定期审查文档
2. 移动临时文档到 troubleshooting/
3. 删除重复内容
4. 合并相似文档

## 文档查找

### 按需求查找

| 需求 | 目录 |
|------|------|
| 学习如何使用 | guides/ |
| 了解系统设计 | architecture/ |
| 解决遇到的问题 | troubleshooting/ |
| 深入学习技术 | tutorials/ |
| 查看 API 接口 | api/ |

### 按组件查找

| 组件 | 相关文档 |
|------|----------|
| Flux | guides/flux-installation.md<br>troubleshooting/flux/ |
| K3s | guides/k3s-remote-access.md<br>troubleshooting/kubernetes/ |
| Git 认证 | troubleshooting/git/ |
| 架构 | architecture/ |

## 贡献指南

### 添加问题解决方案

1. 在 `troubleshooting/` 对应子目录创建文档
2. 使用问题模板
3. 更新 `troubleshooting/README.md` 索引
4. 添加到快速索引表格

### 添加操作指南

1. 在 `guides/` 创建文档
2. 使用指南模板
3. 提供完整的步骤
4. 包含验证方法

### 添加架构文档

1. 在 `architecture/` 创建文档
2. 使用架构模板
3. 包含架构图
4. 解释设计决策

## 相关资源

- [README.md](./README.md) - 项目总览
- [API_REFERENCE.md](./API_REFERENCE.md) - API 参考
- [troubleshooting/README.md](./troubleshooting/README.md) - 问题排查索引
