import { Injectable } from "@nestjs/common";
import { TrpcService } from "./trpc.service";

// 业务模块路由器导入
import { ProjectsRouter } from "../modules/projects/projects.router";
import { OrganizationsRouter } from "../modules/organizations/organizations.router";
import { UsersRouter } from "../modules/users/users.router";
import { TeamsRouter } from "../modules/teams/teams.router";
import { TeamMembersRouter } from "../modules/team-members/team-members.router";
import { AuthRouter } from "../modules/auth/auth.router";
import { AuthSessionsRouter } from "../modules/auth-sessions/auth-sessions.router";
import { EnvironmentsRouter } from "../modules/environments/environments.router";
import { DeploymentsRouter } from "../modules/deployments/deployments.router";
import { PipelinesRouter } from "../modules/pipelines/pipelines.router";
import { PipelineRunsRouter } from "../modules/pipeline-runs/pipeline-runs.router";
import { RepositoriesRouter } from "../modules/repositories/repositories.router";
import { CodeAnalysisResultsRouter } from "../modules/code-analysis-results/code-analysis-results.router";
import { VulnerabilityScansRouter } from "../modules/vulnerability-scans/vulnerability-scans.router";
import { SecurityPoliciesRouter } from "../modules/security-policies/security-policies.router";
import { PerformanceMetricsRouter } from "../modules/performance-metrics/performance-metrics.router";
import { MonitoringConfigsRouter } from "../modules/monitoring-configs/monitoring-configs.router";
import { IntelligentAlertsRouter } from "../modules/intelligent-alerts/intelligent-alerts.router";
import { IncidentsRouter } from "../modules/incidents/incidents.router";
import { EventsRouter } from "../modules/events/events.router";
import { AuditLogsRouter } from "../modules/audit-logs/audit-logs.router";
import { CostTrackingRouter } from "../modules/cost-tracking/cost-tracking.router";
import { WorkflowsRouter } from "../modules/workflows/workflows.router";
import { ExperimentsRouter } from "../modules/experiments/experiments.router";
import { AiAssistantsRouter } from "../modules/ai-assistants/ai-assistants.router";
import { AiRecommendationsRouter } from "../modules/ai-recommendations/ai-recommendations.router";
import { WebhookEndpointsRouter } from "../modules/webhook-endpoints/webhook-endpoints.router";
import { WebhookEventsRouter } from "../modules/webhook-events/webhook-events.router";
import { RolesRouter } from "../modules/roles/roles.router";
import { RoleAssignmentsRouter } from "../modules/role-assignments/role-assignments.router";
import { ProjectMembershipsRouter } from "../modules/project-memberships/project-memberships.router";
import { IdentityProvidersRouter } from "../modules/identity-providers/identity-providers.router";
import { OAuthAccountsRouter } from "../modules/oauth-accounts/oauth-accounts.router";
import { OAuthFlowsRouter } from "../modules/oauth-flows/oauth-flows.router";

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    // 业务模块路由器注入
    private readonly projectsRouter: ProjectsRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    private readonly usersRouter: UsersRouter,
    private readonly teamsRouter: TeamsRouter,
    private readonly teamMembersRouter: TeamMembersRouter,
    private readonly authRouter: AuthRouter,
    private readonly authSessionsRouter: AuthSessionsRouter,
    private readonly environmentsRouter: EnvironmentsRouter,
    private readonly deploymentsRouter: DeploymentsRouter,
    private readonly pipelinesRouter: PipelinesRouter,
    private readonly pipelineRunsRouter: PipelineRunsRouter,
    private readonly repositoriesRouter: RepositoriesRouter,
    private readonly codeAnalysisResultsRouter: CodeAnalysisResultsRouter,
    private readonly vulnerabilityScansRouter: VulnerabilityScansRouter,
    private readonly securityPoliciesRouter: SecurityPoliciesRouter,
    private readonly performanceMetricsRouter: PerformanceMetricsRouter,
    private readonly monitoringConfigsRouter: MonitoringConfigsRouter,
    private readonly intelligentAlertsRouter: IntelligentAlertsRouter,
    private readonly incidentsRouter: IncidentsRouter,
    private readonly eventsRouter: EventsRouter,
    private readonly auditLogsRouter: AuditLogsRouter,
    private readonly costTrackingRouter: CostTrackingRouter,
    private readonly workflowsRouter: WorkflowsRouter,
    private readonly experimentsRouter: ExperimentsRouter,
    private readonly aiAssistantsRouter: AiAssistantsRouter,
    private readonly aiRecommendationsRouter: AiRecommendationsRouter,
    private readonly webhookEndpointsRouter: WebhookEndpointsRouter,
    private readonly webhookEventsRouter: WebhookEventsRouter,
    private readonly rolesRouter: RolesRouter,
    private readonly roleAssignmentsRouter: RoleAssignmentsRouter,
    private readonly projectMembershipsRouter: ProjectMembershipsRouter,
    private readonly identityProvidersRouter: IdentityProvidersRouter,
    private readonly oauthAccountsRouter: OAuthAccountsRouter,
    private readonly oauthFlowsRouter: OAuthFlowsRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      // 系统健康检查
      health: this.trpc.router({
        check: this.trpc.publicProcedure.query(() => ({
          status: "ok",
          timestamp: new Date().toISOString(),
        })),
      }),

      // 核心业务模块
      projects: this.projectsRouter.projectsRouter,
      organizations: this.organizationsRouter.organizationsRouter,
      users: this.usersRouter.usersRouter,
      teams: this.teamsRouter.teamsRouter,
      teamMembers: this.teamMembersRouter.teamMembersRouter,

      // 认证授权模块
      auth: this.authRouter.authRouter,
      authSessions: this.authSessionsRouter.authSessionsRouter,
      projectMemberships: this.projectMembershipsRouter.projectMembershipsRouter,
      identityProviders: this.identityProvidersRouter.identityProvidersRouter,
      oauthAccounts: this.oauthAccountsRouter.oauthAccountsRouter,
      oauthFlows: this.oauthFlowsRouter.oauthFlowsRouter,

      // 环境部署模块
      environments: this.environmentsRouter.environmentsRouter,
      deployments: this.deploymentsRouter.deploymentsRouter,
      pipelines: this.pipelinesRouter.pipelinesRouter,
      pipelineRuns: this.pipelineRunsRouter.pipelineRunsRouter,

      // 代码管理模块
      repositories: this.repositoriesRouter.repositoriesRouter,
      codeAnalysisResults: this.codeAnalysisResultsRouter.codeAnalysisResultsRouter,

      // 安全合规模块
      vulnerabilityScans: this.vulnerabilityScansRouter.vulnerabilityScansRouter,
      securityPolicies: this.securityPoliciesRouter.securityPoliciesRouter,

      // 监控告警模块
      performanceMetrics: this.performanceMetricsRouter.performanceMetricsRouter,
      monitoringConfigs: this.monitoringConfigsRouter.monitoringConfigsRouter,
      intelligentAlerts: this.intelligentAlertsRouter.intelligentAlertsRouter,
      incidents: this.incidentsRouter.incidentsRouter,
      events: this.eventsRouter.eventsRouter,
      auditLogs: this.auditLogsRouter.auditLogsRouter,

      // 成本优化模块
      costTracking: this.costTrackingRouter.costTrackingRouter,

      // 工作流实验模块
      workflows: this.workflowsRouter.workflowsRouter,
      experiments: this.experimentsRouter.experimentsRouter,

      // AI 智能化模块
      aiAssistants: this.aiAssistantsRouter.aiAssistantsRouter,
      aiRecommendations: this.aiRecommendationsRouter.aiRecommendationsRouter,

      // Webhook 集成模块
      webhookEndpoints: this.webhookEndpointsRouter.webhookEndpointsRouter,
      webhookEvents: this.webhookEventsRouter.webhookEventsRouter,

      // 权限管理模块
      roles: this.rolesRouter.rolesRouter,
      roleAssignments: this.roleAssignmentsRouter.roleAssignmentsRouter,
    });
  }
}

export type AppRouter = TrpcRouter["appRouter"];
