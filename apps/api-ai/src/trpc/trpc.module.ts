import { Global, Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { TrpcController } from './trpc.controller';

// 导入所有业务模块
import { ProjectsModule } from '../modules/projects/projects.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { UsersModule } from '../modules/users/users.module';
import { TeamsModule } from '../modules/teams/teams.module';
import { TeamMembersModule } from '../modules/team-members/team-members.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AuthSessionsModule } from '../modules/auth-sessions/auth-sessions.module';
import { EnvironmentsModule } from '../modules/environments/environments.module';
import { DeploymentsModule } from '../modules/deployments/deployments.module';
import { PipelinesModule } from '../modules/pipelines/pipelines.module';
import { PipelineRunsModule } from '../modules/pipeline-runs/pipeline-runs.module';
import { RepositoriesModule } from '../modules/repositories/repositories.module';
import { CodeAnalysisResultsModule } from '../modules/code-analysis-results/code-analysis-results.module';
import { VulnerabilityScansModule } from '../modules/vulnerability-scans/vulnerability-scans.module';
import { SecurityPoliciesModule } from '../modules/security-policies/security-policies.module';
import { PerformanceMetricsModule } from '../modules/performance-metrics/performance-metrics.module';
import { MonitoringConfigsModule } from '../modules/monitoring-configs/monitoring-configs.module';
import { IntelligentAlertsModule } from '../modules/intelligent-alerts/intelligent-alerts.module';
import { IncidentsModule } from '../modules/incidents/incidents.module';
import { EventsModule } from '../modules/events/events.module';
import { AuditLogsModule } from '../modules/audit-logs/audit-logs.module';
import { CostTrackingModule } from '../modules/cost-tracking/cost-tracking.module';
import { WorkflowsModule } from '../modules/workflows/workflows.module';
import { ExperimentsModule } from '../modules/experiments/experiments.module';
import { AiAssistantsModule } from '../modules/ai-assistants/ai-assistants.module';
import { AiRecommendationsModule } from '../modules/ai-recommendations/ai-recommendations.module';
import { WebhookEndpointsModule } from '../modules/webhook-endpoints/webhook-endpoints.module';
import { WebhookEventsModule } from '../modules/webhook-events/webhook-events.module';
import { RolesModule } from '../modules/roles/roles.module';
import { RoleAssignmentsModule } from '../modules/role-assignments/role-assignments.module';
import { ProjectMembershipsModule } from '../modules/project-memberships/project-memberships.module';
import { IdentityProvidersModule } from '../modules/identity-providers/identity-providers.module';
import { OAuthAccountsModule } from '../modules/oauth-accounts/oauth-accounts.module';
import { OAuthFlowsModule } from '../modules/oauth-flows/oauth-flows.module';

@Global()
@Module({
  imports: [
    // 核心业务模块
    ProjectsModule,
    OrganizationsModule,
    UsersModule,
    TeamsModule,
    TeamMembersModule,
    
    // 认证授权模块
    AuthModule,
    AuthSessionsModule,
    RolesModule,
    RoleAssignmentsModule,
    ProjectMembershipsModule,
    IdentityProvidersModule,
    OAuthAccountsModule,
    OAuthFlowsModule,
    
    // 环境部署模块
    EnvironmentsModule,
    DeploymentsModule,
    PipelinesModule,
    PipelineRunsModule,
    
    // 代码管理模块
    RepositoriesModule,
    CodeAnalysisResultsModule,
    
    // 安全合规模块
    VulnerabilityScansModule,
    SecurityPoliciesModule,
    
    // 监控告警模块
    PerformanceMetricsModule,
    MonitoringConfigsModule,
    IntelligentAlertsModule,
    IncidentsModule,
    EventsModule,
    AuditLogsModule,
    
    // 成本优化模块
    CostTrackingModule,
    
    // 工作流实验模块
    WorkflowsModule,
    ExperimentsModule,
    
    // AI 智能化模块
    AiAssistantsModule,
    AiRecommendationsModule,
    
    // Webhook 集成模块
    WebhookEndpointsModule,
    WebhookEventsModule,
  ],
  controllers: [TrpcController],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
