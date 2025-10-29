# ✨ 功能列表

## 🎯 核心功能

### 1. 认证和授权 ✅
- GitHub OAuth 2.0 登录
- GitLab OAuth 2.0 登录
- Redis 会话管理 (7天过期)
- RBAC 权限控制
- 认证中间件

### 2. 用户管理 ✅
- 用户 CRUD
- 用户偏好 (语言/主题/通知)
- 用户头像
- 用户搜索

### 3. 组织管理 ✅
- 组织 CRUD (支持软删除)
- 成员管理 (owner/admin/member)
- 配额管理 (项目/团队/成员/存储)
- Logo 上传 (MinIO)

### 4. 团队管理 ✅
- 团队 CRUD (支持软删除)
- 成员管理 (admin/member)
- 权限继承到项目

### 5. 项目管理 ✅
- 项目 CRUD (支持软删除)
- 成员管理 (admin/developer/viewer)
- 团队关联
- JSONB 灵活配置

### 6. 仓库集成 ✅
- GitHub/GitLab 仓库连接
- Webhook 处理 (push/pr)
- 仓库元数据同步
- 自动触发 Pipeline

### 7. 环境管理 ✅
- 环境 CRUD (支持软删除)
- JSONB 环境配置
- JSONB 权限管理
- 环境保护 (审批要求)

### 8. CI/CD Pipeline ✅
- Pipeline CRUD
- JSONB Pipeline 配置
- 手动/Webhook 触发
- 运行记录和日志

### 9. 部署管理 ✅
- 部署 CRUD
- 部署审批流程
- 部署策略 (滚动/蓝绿/金丝雀)
- 自动回滚

### 10. 成本追踪 ✅
- 成本记录 (JSONB 存储)
- 成本汇总和趋势
- 预算告警
- 成本优化建议

### 11. 安全策略 ✅
- 策略 CRUD
- JSONB 策略规则
- 策略评估引擎
- 违规拦截和记录

### 12. 审计日志 ✅
- 自动记录所有操作
- 日志查询和搜索
- JSONB 元数据存储
- 日志导出

### 13. 通知系统 ✅
- 通知 CRUD
- 邮件通知 (Resend)
- 应用内通知
- 通知偏好设置

### 14. AI 助手 ✅
- 助手 CRUD
- Ollama 本地 LLM
- 流式对话
- 模型管理
- 智能回退机制

**支持的助手类型**:
- 代码审查助手
- DevOps 工程师
- 成本优化专家
- 自定义助手

**支持的模型**:
- llama3.2:3b (轻量级)
- codellama:7b (代码专用)
- mistral:7b (高质量)

### 15. 对象存储 ✅
- MinIO 集成
- 文件上传/下载/删除
- Bucket 管理
- 存储配额

---

## 🔜 计划功能

### v1.1 - K3s 集成
- [ ] K3s 客户端
- [ ] 部署到 K3s
- [ ] Pod/Service 管理
- [ ] 资源监控

### v1.2 - BullMQ 队列
- [ ] 任务队列
- [ ] Pipeline 异步执行
- [ ] 任务重试
- [ ] 任务监控

### v1.3 - 实时功能
- [ ] WebSocket 服务
- [ ] 实时日志流
- [ ] 实时通知
- [ ] 实时状态更新

### v1.4 - 测试完善
- [ ] 单元测试 (> 80%)
- [ ] 集成测试
- [ ] E2E 测试

---

## 🏗️ 技术特性

### 类型安全
- ✅ 端到端 TypeScript
- ✅ tRPC 自动类型推导
- ✅ Drizzle 类型安全查询
- ✅ Zod 运行时验证
- ✅ 0 类型错误

### 高性能
- ✅ Bun 运行时 (3x 快于 Node.js)
- ✅ Fastify (2x 快于 Express)
- ✅ Drizzle (接近原生 SQL)
- ✅ Dragonfly Redis (25x 性能提升)
- ✅ 连接池优化

### 可扩展性
- ✅ 模块化架构 (17 个模块)
- ✅ JSONB 灵活配置
- ✅ 插件化设计
- ✅ 微服务就绪

### 安全性
- ✅ OAuth 2.0 认证
- ✅ RBAC 权限控制
- ✅ SQL 注入防护
- ✅ XSS/CSRF 防护
- ✅ 审计日志

### 可观测性
- ✅ Prometheus 指标
- ✅ Grafana 可视化
- ✅ Loki 日志聚合
- ✅ Tempo 分布式追踪
- ✅ 健康检查

---

## 📊 数据库设计

### 核心表 (17 张)
1. users - 用户表
2. oauth_accounts - OAuth 账号
3. organizations - 组织表
4. organization_members - 组织成员
5. teams - 团队表
6. team_members - 团队成员
7. projects - 项目表
8. project_members - 项目成员
9. team_projects - 团队项目关联
10. repositories - 仓库表
11. environments - 环境表
12. pipelines - Pipeline 表
13. pipeline_runs - Pipeline 运行记录
14. deployments - 部署表
15. deployment_approvals - 部署审批
16. cost_tracking - 成本追踪
17. security_policies - 安全策略
18. incidents - 事件表
19. audit_logs - 审计日志
20. notifications - 通知表
21. ai_assistants - AI 助手

### 设计特点
- ✅ 软删除支持 (deletedAt)
- ✅ JSONB 灵活配置
- ✅ 外键约束
- ✅ 索引优化
- ✅ 事务支持

---

## 🎯 API 端点

### 统计
- **总端点数**: 100+
- **认证端点**: 6
- **用户端点**: 4
- **组织端点**: 10
- **团队端点**: 8
- **项目端点**: 10
- **仓库端点**: 6
- **环境端点**: 8
- **Pipeline 端点**: 10
- **部署端点**: 6
- **成本端点**: 3
- **安全端点**: 5
- **审计端点**: 3
- **通知端点**: 4
- **AI 端点**: 7

### API 特点
- ✅ tRPC 类型安全
- ✅ 自动验证 (Zod)
- ✅ 错误处理
- ✅ 批量请求
- ✅ 分页支持

---

## 📚 相关文档

- [README](./README.md) - 项目说明
- [快速开始](./GETTING_STARTED.md) - 安装配置
- [项目状态](./PROJECT_STATUS.md) - 当前状态
- [技术路线图](./TECH_ROADMAP.md) - 未来规划
- [待办事项](./TODO.md) - 任务清单
- [Ollama 指南](./OLLAMA_GUIDE.md) - AI 使用
- [架构设计](./ARCHITECTURE_UPGRADE.md) - 技术架构

---

**最后更新**: 2025-01-XX
