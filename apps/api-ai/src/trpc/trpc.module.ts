/**
 * tRPC 模块 - 端到端类型安全的API层
 * 集成 NestJS + tRPC + Zod 验证
 */

import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { UsersModule } from '../modules/users/users.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AiAssistantsModule } from '../modules/ai-assistants/ai-assistants.module';
import { AiRecommendationsModule } from '../modules/ai-recommendations/ai-recommendations.module';
import { WorkflowsModule } from '../modules/workflows/workflows.module';
import { EnvironmentsModule } from '../modules/environments/environments.module';
import { DeploymentsModule } from '../modules/deployments/deployments.module';
import { PipelinesModule } from '../modules/pipelines/pipelines.module';
import { PipelineRunsModule } from '../modules/pipeline-runs/pipeline-runs.module';
import { MonitoringConfigsModule } from '../modules/monitoring-configs/monitoring-configs.module';
import { PerformanceMetricsModule } from '../modules/performance-metrics/performance-metrics.module';
import { IntelligentAlertsModule } from '../modules/intelligent-alerts/intelligent-alerts.module';
import { IncidentsModule } from '../modules/incidents/incidents.module';
import { EventsModule } from '../modules/events/events.module';
import { RepositoriesModule } from '../modules/repositories/repositories.module';
import { CodeAnalysisResultsModule } from '../modules/code-analysis-results/code-analysis-results.module';
import { VulnerabilityScansModule } from '../modules/vulnerability-scans/vulnerability-scans.module';
import { SecurityPoliciesModule } from '../modules/security-policies/security-policies.module';
import { CostTrackingModule } from '../modules/cost-tracking/cost-tracking.module';
import { ExperimentsModule } from '../modules/experiments/experiments.module';
import { TeamMembersModule } from '../modules/team-members/team-members.module';
import { TeamsModule } from '../modules/teams/teams.module';
import { ProjectMembershipsModule } from '../modules/project-memberships/project-memberships.module';
import { RolesModule } from '../modules/roles/roles.module';
import { RoleAssignmentsModule } from '../modules/role-assignments/role-assignments.module';
import { IdentityProvidersModule } from '../modules/identity-providers/identity-providers.module';
import { OAuthFlowsModule } from '../modules/oauth-flows/oauth-flows.module';
import { OAuthAccountsModule } from '../modules/oauth-accounts/oauth-accounts.module';
import { AuthSessionsModule } from '../modules/auth-sessions/auth-sessions.module';
import { WebhookEndpointsModule } from '../modules/webhook-endpoints/webhook-endpoints.module';
import { WebhookEventsModule } from '../modules/webhook-events/webhook-events.module';
import { AuditLogsModule } from '../modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    // 核心模块
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    
    // 认证授权模块
    AuthModule,
    RolesModule,
    RoleAssignmentsModule,
    IdentityProvidersModule,
    OAuthFlowsModule,
    OAuthAccountsModule,
    AuthSessionsModule,
    
    // AI 智能模块
    AiAssistantsModule,
    AiRecommendationsModule,
    WorkflowsModule,
    
    // 部署运维模块
    EnvironmentsModule,
    DeploymentsModule,
    PipelinesModule,
    PipelineRunsModule,
    
    // 监控告警模块
    MonitoringConfigsModule,
    PerformanceMetricsModule,
    IntelligentAlertsModule,
    IncidentsModule,
    EventsModule,
    
    // 代码管理模块
    RepositoriesModule,
    CodeAnalysisResultsModule,
    VulnerabilityScansModule,
    SecurityPoliciesModule,
    
    // 成本管理模块
    CostTrackingModule,
    
    // 实验和测试模块
    ExperimentsModule,
    
    // 团队管理模块
    TeamMembersModule,
    TeamsModule,
    ProjectMembershipsModule,
    
    // Webhook 模块
    WebhookEndpointsModule,
    WebhookEventsModule,
    
    // 审计日志模块
    AuditLogsModule,
  ],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}