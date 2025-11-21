# 📚 Juanie DevOps Platform - 文档索引

> 快速找到你需要的文档

---

## 🎯 快速开始

### 新用户必读
1. 📖 [README.md](./README.md) - 项目介绍和快速开始
2. 📊 [PROJECT_STATUS.md](./PROJECT_STATUS.md) - 当前项目状态
3. 💻 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - 开发环境设置

### 开发者必读
1. 📋 [ROADMAP_2025.md](./ROADMAP_2025.md) - 2025 技术路线图
2. 🏗️ [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 架构设计
3. 🔌 [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) - API 文档

---

## 📋 核心文档

### 规划和路线图
| 文档 | 描述 | 状态 |
|------|------|------|
| [ROADMAP_2025.md](./ROADMAP_2025.md) | 2025 年完整技术路线图 | ✅ 最新 |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 当前项目状态和进度 | ✅ 最新 |
| [MODERN_BEST_PRACTICES_2025.md](./MODERN_BEST_PRACTICES_2025.md) | 2025 年最佳实践 | ✅ 参考 |

### 功能文档
| 文档 | 描述 | 状态 |
|------|------|------|
| [TEMPLATE_SYSTEM_STATUS.md](./TEMPLATE_SYSTEM_STATUS.md) | 模板系统实施状态 | ✅ 最新 |
| [OAUTH_MULTI_SERVER_COMPLETE.md](./OAUTH_MULTI_SERVER_COMPLETE.md) | OAuth 多服务器支持 | ✅ 已完成 |
| [TEMPLATE_EXAMPLES.md](./TEMPLATE_EXAMPLES.md) | 模板使用示例 | ✅ 参考 |

### 开发文档
| 文档 | 描述 | 状态 |
|------|------|------|
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 开发环境和工作流 | ✅ 最新 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统架构设计 | ✅ 最新 |
| [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md) | 项目概览 | ✅ 最新 |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | API 接口文档 | ✅ 最新 |
| [docs/DEVOPS_WORKFLOW_GUIDE.md](./docs/DEVOPS_WORKFLOW_GUIDE.md) | DevOps 工作流指南 | ✅ 参考 |
| [docs/DEVOPS_FLOW_DIAGRAM.md](./docs/DEVOPS_FLOW_DIAGRAM.md) | DevOps 流程图 | ✅ 参考 |
| [docs/QUICK_START_CHECKLIST.md](./docs/QUICK_START_CHECKLIST.md) | 快速开始检查清单 | ✅ 参考 |

---

## 🎨 模板文档

### 模板系统
| 文档 | 描述 | 状态 |
|------|------|------|
| [TEMPLATE_SYSTEM_STATUS.md](./TEMPLATE_SYSTEM_STATUS.md) | 模板系统实施状态 | ✅ 最新 |
| [TEMPLATE_EXAMPLES.md](./TEMPLATE_EXAMPLES.md) | 模板使用示例 | ✅ 参考 |

### 具体模板
| 模板 | 文档 | 状态 |
|------|------|------|
| Next.js 15 | [templates/nextjs-15-app/README.md](./templates/nextjs-15-app/README.md) | ✅ 完整 |
| Next.js 15 | [templates/nextjs-15-app/TEMPLATE_SUMMARY.md](./templates/nextjs-15-app/TEMPLATE_SUMMARY.md) | ✅ 完整 |
| Next.js 15 | [templates/nextjs-15-app/docs/GITLAB_SETUP.md](./templates/nextjs-15-app/docs/GITLAB_SETUP.md) | ✅ 完整 |

---

## 🔧 技术文档

### 数据库
| 文档 | 描述 | 位置 |
|------|------|------|
| Schema 定义 | 数据库表结构 | `packages/core/database/src/schemas/` |
| 迁移文件 | 数据库迁移 | `packages/core/database/drizzle/` |
| 迁移脚本 | 数据迁移脚本 | `packages/core/database/src/scripts/` |

### 服务
| 服务 | 描述 | 位置 |
|------|------|------|
| Auth | 认证和授权 | `packages/services/auth/` |
| Projects | 项目管理 | `packages/services/projects/` |
| Repositories | 仓库管理 | `packages/services/repositories/` |
| Environments | 环境管理 | `packages/services/environments/` |
| Git Providers | Git 提供商 | `packages/services/git-providers/` |
| Flux | GitOps 部署 | `packages/services/flux/` |
| K3s | Kubernetes | `packages/services/k3s/` |

---

## 📖 使用场景

### 我想...

#### 开始开发
1. 阅读 [README.md](./README.md)
2. 设置开发环境 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
3. 了解架构 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

#### 了解项目进度
1. 查看 [PROJECT_STATUS.md](./PROJECT_STATUS.md)
2. 查看 [ROADMAP_2025.md](./ROADMAP_2025.md)

#### 实现新功能
1. 查看路线图 [ROADMAP_2025.md](./ROADMAP_2025.md)
2. 了解架构 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. 参考 API 文档 [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

#### 使用模板系统
1. 查看状态 [TEMPLATE_SYSTEM_STATUS.md](./TEMPLATE_SYSTEM_STATUS.md)
2. 查看示例 [TEMPLATE_EXAMPLES.md](./TEMPLATE_EXAMPLES.md)
3. 查看具体模板 [templates/nextjs-15-app/README.md](./templates/nextjs-15-app/README.md)

#### 部署项目
1. 阅读工作流指南 [docs/DEVOPS_WORKFLOW_GUIDE.md](./docs/DEVOPS_WORKFLOW_GUIDE.md)
2. 查看流程图 [docs/DEVOPS_FLOW_DIAGRAM.md](./docs/DEVOPS_FLOW_DIAGRAM.md)

#### 配置 OAuth
1. 查看完整文档 [OAUTH_MULTI_SERVER_COMPLETE.md](./OAUTH_MULTI_SERVER_COMPLETE.md)

---

## 🗂️ 文档分类

### 按类型分类

#### 📋 规划文档
- [ROADMAP_2025.md](./ROADMAP_2025.md)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- [MODERN_BEST_PRACTICES_2025.md](./MODERN_BEST_PRACTICES_2025.md)

#### 📖 指南文档
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- [docs/DEVOPS_WORKFLOW_GUIDE.md](./docs/DEVOPS_WORKFLOW_GUIDE.md)
- [docs/QUICK_START_CHECKLIST.md](./docs/QUICK_START_CHECKLIST.md)

#### 🏗️ 架构文档
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md)
- [docs/DEVOPS_FLOW_DIAGRAM.md](./docs/DEVOPS_FLOW_DIAGRAM.md)

#### 🔌 API 文档
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

#### 🎨 模板文档
- [TEMPLATE_SYSTEM_STATUS.md](./TEMPLATE_SYSTEM_STATUS.md)
- [TEMPLATE_EXAMPLES.md](./TEMPLATE_EXAMPLES.md)
- [templates/nextjs-15-app/](./templates/nextjs-15-app/)

#### ✅ 功能文档
- [OAUTH_MULTI_SERVER_COMPLETE.md](./OAUTH_MULTI_SERVER_COMPLETE.md)

### 按状态分类

#### ✅ 最新文档（经常更新）
- [ROADMAP_2025.md](./ROADMAP_2025.md)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- [TEMPLATE_SYSTEM_STATUS.md](./TEMPLATE_SYSTEM_STATUS.md)
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

#### 📚 参考文档（稳定）
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)
- [TEMPLATE_EXAMPLES.md](./TEMPLATE_EXAMPLES.md)

#### ✅ 完成文档（归档）
- [OAUTH_MULTI_SERVER_COMPLETE.md](./OAUTH_MULTI_SERVER_COMPLETE.md)

---

## 🔍 搜索提示

### 关键词索引

- **AI**: [ROADMAP_2025.md](./ROADMAP_2025.md) - P0 优先级
- **模板**: [TEMPLATE_SYSTEM_STATUS.md](./TEMPLATE_SYSTEM_STATUS.md)
- **OAuth**: [OAUTH_MULTI_SERVER_COMPLETE.md](./OAUTH_MULTI_SERVER_COMPLETE.md)
- **GitOps**: [docs/DEVOPS_WORKFLOW_GUIDE.md](./docs/DEVOPS_WORKFLOW_GUIDE.md)
- **架构**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **API**: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)
- **开发**: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- **部署**: [docs/DEVOPS_FLOW_DIAGRAM.md](./docs/DEVOPS_FLOW_DIAGRAM.md)

---

## 📝 文档维护

### 更新频率
- **每日**: [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- **每周**: [ROADMAP_2025.md](./ROADMAP_2025.md)
- **按需**: 其他文档

### 文档规范
- 使用 Markdown 格式
- 包含更新日期
- 清晰的标题结构
- 代码示例使用语法高亮
- 链接使用相对路径

---

## 🤝 贡献

发现文档问题或有改进建议？
1. 提交 Issue
2. 创建 Pull Request
3. 联系团队

---

**文档索引最后更新**: 2025-11-20
