# 系统架构文档

## 概述

AI DevOps Platform 是一个现代化的 DevOps 平台，采用 Monorepo 架构，提供项目管理、CI/CD、环境管理、成本追踪等功能。

## 技术栈

### 后端
- **框架**: NestJS + tRPC
- **语言**: TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **缓存**: Redis
- **消息队列**: BullMQ
- **容器编排**: K3s (Kubernetes)

### 前端
- **框架**: Vue 3 + Vite
- **状态管理**: Pinia
- **UI 库**: Element Plus
- **类型安全**: TypeScript + tRPC Client

### 基础设施
- **容器**: Docker
- **编排**: Docker Compose / K3s
- **监控**: Prometheus + Grafana
- **日志**: OpenTelemetry
- **CI/CD**: GitHub Actions / GitLab CI

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Vue 3 Web   │  │  Mobile App  │  │   CLI Tool   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                           │                                  │
│                      tRPC Client                             │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                      API Gateway                             │
│                    (NestJS + tRPC)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              tRPC Router                              │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │   │
│  │  │Projects│ │Pipelines│ │Deploy │ │  AI   │  ...  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                       服务层                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Projects │  │Pipelines │  │Deployments│  │   AI    │    │
│  │ Service  │  │ Service  │  │  Service  │  │Assistants│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │              │             │           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Teams   │  │   Auth   │  │   Audit  │  │   Cost   │    │
│  │ Service  │  │ Service  │  │   Logs   │  │ Tracking │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼──────────────┼─────────────┼───────────┘
        │             │              │             │
┌───────┼─────────────┼──────────────┼─────────────┼───────────┐
│                    核心层                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Database │  │  Types   │  │  Queue   │  │  Cache   │    │
│  │ (Drizzle)│  │  (Zod)   │  │(BullMQ)  │  │ (Redis)  │    │
│  └────┬─────┘  └──────────┘  └────┬─────┘  └────┬─────┘    │
└───────┼────────────────────────────┼─────────────┼───────────┘
        │                            │             │
┌───────┼────────────────────────────┼─────────────┼───────────┐
│                    数据层                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │PostgreSQL│  │  Redis   │  │   S3     │  │   K3s    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└───────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 项目管理 (Projects)
- 项目创建、更新、删除
- 成员管理
- 团队分配
- 权限控制

### 2. CI/CD (Pipelines)
- Pipeline 配置
- 自动触发（Push/PR/Schedule）
- 构建、测试、部署
- 日志查看

### 3. 部署管理 (Deployments)
- 多环境部署
- 部署审批流程
- 回滚功能
- 部署历史

### 4. 环境管理 (Environments)
- 环境配置
- 权限管理
- 环境变量
- 密钥管理

### 5. AI 助手 (AI Assistants)
- 代码审查
- DevOps 建议
- 成本优化
- 安全分析

### 6. 成本追踪 (Cost Tracking)
- 资源使用统计
- 成本分析
- 预算告警
- 成本优化建议

### 7. 审计日志 (Audit Logs)
- 操作记录
- 安全审计
- 合规性检查
- 日志导出

## 数据流

### 1. 请求流程

```
用户请求
  ↓
前端 (Vue 3)
  ↓
tRPC Client
  ↓
API Gateway (NestJS)
  ↓
tRPC Router
  ↓
Service Layer
  ↓
Database / Cache / Queue
  ↓
响应返回
```

### 2. 认证流程

```
用户登录
  ↓
OAuth Provider (GitHub/GitLab)
  ↓
Auth Service
  ↓
生成 Session
  ↓
存储到 Redis
  ↓
返回 Session ID
  ↓
前端存储 (Cookie/LocalStorage)
  ↓
后续请求携带 Session ID
  ↓
API Gateway 验证
  ↓
从 Redis 获取用户信息
  ↓
注入到 Context
```

### 3. Pipeline 执行流程

```
代码提交
  ↓
Webhook 触发
  ↓
Pipeline Service
  ↓
创建 Pipeline Run
  ↓
添加到 BullMQ 队列
  ↓
Worker 处理
  ↓
执行各个 Stage
  ↓
更新状态
  ↓
发送通知
```

## 安全设计

### 1. 认证
- OAuth 2.0 (GitHub/GitLab)
- Session 管理 (Redis)
- Token 刷新机制

### 2. 授权
- 基于角色的访问控制 (RBAC)
- 组织级权限
- 项目级权限
- 环境级权限

### 3. 数据安全
- 密码加密 (bcrypt)
- 敏感数据加密
- SQL 注入防护 (Drizzle ORM)
- XSS 防护

### 4. 审计
- 操作日志记录
- 安全事件追踪
- 合规性报告

## 可扩展性

### 1. 水平扩展
- API Gateway 无状态设计
- Session 存储在 Redis
- 使用消息队列解耦

### 2. 垂直扩展
- 数据库连接池
- Redis 集群
- K3s 资源调度

### 3. 微服务化
- 服务独立部署
- 服务间通信 (tRPC)
- 服务发现

## 监控和可观测性

### 1. 指标监控
- Prometheus 采集
- Grafana 可视化
- 告警规则

### 2. 日志
- OpenTelemetry
- 结构化日志
- 日志聚合

### 3. 追踪
- 分布式追踪
- 性能分析
- 错误追踪

## 部署架构

### 开发环境
```
Docker Compose
  ├── PostgreSQL
  ├── Redis
  ├── API Gateway
  └── Web Frontend
```

### 生产环境
```
K3s Cluster
  ├── Ingress (Traefik)
  ├── API Gateway (3 replicas)
  ├── Web Frontend (2 replicas)
  ├── PostgreSQL (StatefulSet)
  ├── Redis (StatefulSet)
  └── Monitoring Stack
      ├── Prometheus
      └── Grafana
```

## 性能优化

### 1. 数据库
- 索引优化
- 查询优化
- 连接池管理
- 读写分离

### 2. 缓存
- Redis 缓存热点数据
- CDN 缓存静态资源
- 浏览器缓存

### 3. API
- 响应压缩
- 批量查询
- 分页加载
- 懒加载

## 相关文档

- [服务说明](./services.md)
- [数据库设计](./database.md)
- [Docker 部署](../deployment/docker.md)
- [监控配置](../deployment/monitoring.md)
- [常见问题](../troubleshooting/common-issues.md)
