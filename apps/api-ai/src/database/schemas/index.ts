// Database Schemas Export - 简化版
// This file serves as the main entry point for all database schemas

// =====================================================
// AI-Native DevOps (保留多模型配置)
// =====================================================
export * from "./ai-assistants.schema";
export * from "./ai-recommendations.schema";
export * from "./code-analysis-results.schema";
export * from "./intelligent-alerts.schema";
export * from "./performance-metrics.schema"; // 已简化

// =====================================================
// Platform Engineering
// =====================================================
export * from "./projects.schema";
export * from "./environments.schema";
export * from "./repositories.schema";
export * from "./pipelines.schema";
export * from "./pipeline-runs.schema";
export * from "./deployments.schema";
export * from "./monitoring-configs.schema";

// =====================================================
// Security & Compliance (简化版)
// =====================================================
export * from "./security-policies.schema"; // 新简化版
export * from "./vulnerability-scans.schema";
// 移除: export * from "./zero-trust-policies.schema"; // 已合并到security-policies

// =====================================================
// FinOps & Sustainability (简化版)
// =====================================================
export * from "./cost-tracking.schema"; // 已简化
// 移除: export * from "./sustainability-metrics.schema"; // 功能已移除
// 移除: export * from "./resource-optimization.schema"; // 已删除，功能已简化

// =====================================================
// Advanced Features
// =====================================================
export * from "./experiments.schema";

// =====================================================
// User Management & Organizations
// =====================================================
export * from "./users.schema";
export * from "./organizations.schema";
export * from "./oauth-accounts.schema";
export * from "./roles.schema";
export * from "./teams.schema";
export * from "./team-members.schema";
export * from "./project-memberships.schema";
export * from "./role-assignments.schema";
export * from "./identity-providers.schema";

// =====================================================
// Observability & Monitoring
// =====================================================
export * from "./incidents.schema";

// =====================================================
// Integrations: Webhooks & Events
// =====================================================
export * from "./webhook-endpoints.schema";
export * from "./webhook-events.schema";
export * from "./events.schema";

// =====================================================
// Auth Sessions & Flows
// =====================================================
export * from "./auth-sessions.schema";
export * from "./oauth-flows.schema";

// =====================================================
// Audit Logs
// =====================================================
export * from "./audit-logs.schema";
