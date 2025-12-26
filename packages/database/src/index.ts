/**
 * @juanie/database - Database Schemas Package
 *
 * 按领域组织的数据库 Schema，供所有服务层使用
 *
 * 领域划分：
 * - auth: 认证（用户、会话、Git 连接）
 * - organization: 组织（组织、团队、成员）
 * - project: 项目（项目、模板、初始化）
 * - deployment: 部署（环境、部署、流水线）
 * - repository: 仓库（代码仓库）
 * - gitops: GitOps（资源、同步）
 * - ai: AI（助手、对话、模板）
 * - monitoring: 监控（事件、成本、安全）
 * - system: 系统（通知、审计、事件）
 */

// Export relations
export * from './relations'
export * from './schemas/ai'
// Export all schemas by domain
export * from './schemas/auth'
export * from './schemas/deployment'
export * from './schemas/gitops'
export * from './schemas/monitoring'
export * from './schemas/organization'
export * from './schemas/project'
export * from './schemas/repository'
export * from './schemas/system'
