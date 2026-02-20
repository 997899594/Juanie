# 全栈工程师简历

---

## 个人信息
**姓名**：全栈工程师候选人  
**电话**：138-xxxx-xxxx  
**邮箱**：fullstack@example.com  
**LinkedIn**：linkedin.com/in/fullstack-dev  
**GitHub**：github.com/fullstack-dev  

---

## 职业概要
6+ 年全栈开发经验，专注于现代 Web 应用和云原生平台开发。曾主导设计并实现 AI 驱动的 DevOps 平台 Juanie，具备从 0 到 1 构建复杂分布式系统的能力。精通 Next.js、TypeScript、Kubernetes、PostgreSQL 等技术栈，对系统架构设计、性能优化和 DevOps 实践有深入理解。

---

## 核心技能
- **前端**：Next.js 16 (App Router)、React 19、TypeScript 5、Tailwind CSS 4、Radix UI
- **后端**：Node.js、NestJS、tRPC、Drizzle ORM、PostgreSQL、Redis
- **云原生**：Kubernetes、K3s、Flux CD (GitOps)、Docker、CI/CD (GitHub Actions)
- **AI/ML**：Google Gemini API、Vercel AI SDK、Ollama、多模态输入处理
- **可观测性**：OpenTelemetry、Jaeger、Prometheus、Grafana
- **工具**：Bun、Vite、ESLint、Biome、Zod

---

## 职业经历

### 全栈开发工程师 | Juanie DevOps 平台
**时间**：2024.06 - 至今  
**项目介绍**：构建现代化 AI 驱动的 DevOps 平台，支持多团队协作、项目管理、GitOps 部署和 Kubernetes 资源管理

**主要职责与成果**：
- **平台架构设计与实现**
  - 设计并实现三层服务架构（Foundation Layer、Business Layer、Extension Layer），确保系统可扩展性和可维护性
  - 采用 Next.js 16 App Router 构建全栈应用，实现端到端类型安全
  - 集成 Drizzle ORM 进行数据访问，比 Prisma 性能提升 2-3 倍

- **核心功能开发**
  - 实现多租户支持和 RBAC 权限系统，保障数据安全和访问控制
  - 开发项目管理系统，支持从模板创建项目、Git 仓库集成和自动化环境配置
  - 集成 Kubernetes API，实现命名空间管理、资源监控和部署管理功能
  - 实现 Flux CD GitOps 工作流，支持声明式部署和自动同步

- **AI 能力集成**
  - 集成 Google Gemini API，实现 AI 代码审查、智能诊断和多模态输入处理
  - 设计并实现工具驱动的动态 UI 系统，AI 可通过工具调用生成交互式组件
  - 实现 Context Caching，降低 API 成本 90% 并提升响应速度

- **可观测性与性能优化**
  - 集成 OpenTelemetry 实现全链路追踪、日志和指标采集
  - 配置 Jaeger、Prometheus 和 Grafana 构建完整的可观测性体系
  - 优化数据库查询，添加索引和连接池，提升查询性能 50%
  - 实现 Redis 缓存热点数据，减少数据库压力

- **DevOps 与部署**
  - 配置 GitHub Actions CI/CD 流水线，实现自动化测试、构建和部署
  - 使用 K3s 构建轻量级 Kubernetes 集群，降低资源占用
  - 实现 GitOps 部署流程，通过 Flux CD 自动同步代码变更

---

## 项目经历

### Juanie - AI 驱动的 DevOps 平台
**时间**：2024.06 - 至今  
**技术栈**：Next.js 16、TypeScript、PostgreSQL、Drizzle ORM、Kubernetes、Flux CD、Google Gemini

**项目描述**：一个现代化的 DevOps 平台，提供多团队协作、项目管理、GitOps 部署、Kubernetes 资源管理和 AI 辅助开发功能。

**主要贡献**：
- 从 0 到 1 设计并实现完整的平台架构
- 开发项目创建统一化流程（ProjectOrchestrator），支持多种创建场景
- 实现实时部署状态更新（Server-Sent Events）
- 构建审计日志系统，追踪所有团队活动
- 集成 GitHub/GitLab OAuth 认证

---

## 教育背景
**计算机科学与技术 | 本科**  
某某大学 | 2016.09 - 2020.06

---

## 项目亮点
- **项目创建统一化**：设计 ProjectOrchestrator 统一处理所有项目创建场景，减少代码重复，提升可维护性
- **AI 驱动架构**：采用 Gemini-First 架构，放弃复杂的 LangGraph，实现快速 MVP 和低成本运行
- **三层架构设计**：清晰的职责分离，Foundation Layer 提供基础服务，Business Layer 处理核心业务，Extension Layer 提供 AI 等扩展功能
- **GitOps 实践**：使用 Flux CD 实现声明式部署，确保基础设施即代码
