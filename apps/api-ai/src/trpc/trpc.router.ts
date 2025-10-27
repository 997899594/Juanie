import { Injectable } from "@nestjs/common";
import { AiAssistantsRouter } from "../modules/ai-assistants/ai-assistants.router";
import { AiRecommendationsRouter } from "../modules/ai-recommendations/ai-recommendations.router";
import { AuditLogsRouter } from "../modules/audit-logs/audit-logs.router";
import { AuthRouter } from "../modules/auth/auth.router";
import { AuthSessionsRouter } from "../modules/auth-sessions/auth-sessions.router";
import { CodeAnalysisResultsRouter } from "../modules/code-analysis-results/code-analysis-results.router";
import { CostTrackingRouter } from "../modules/cost-tracking/cost-tracking.router";
import { DeploymentsRouter } from "../modules/deployments/deployments.router";
import { EnvironmentsRouter } from "../modules/environments/environments.router";
import { EventsRouter } from "../modules/events/events.router";
import { ExperimentsRouter } from "../modules/experiments/experiments.router";
import { IdentityProvidersRouter } from "../modules/identity-providers/identity-providers.router";
import { IncidentsRouter } from "../modules/incidents/incidents.router";
import { IntelligentAlertsRouter } from "../modules/intelligent-alerts/intelligent-alerts.router";
import { MonitoringConfigsRouter } from "../modules/monitoring-configs/monitoring-configs.router";
import { OAuthAccountsRouter } from "../modules/oauth-accounts/oauth-accounts.router";
import { OAuthFlowsRouter } from "../modules/oauth-flows/oauth-flows.router";
import { OrganizationsRouter } from "../modules/organizations/organizations.router";
import { PerformanceMetricsRouter } from "../modules/performance-metrics/performance-metrics.router";
import { PipelineRunsRouter } from "../modules/pipeline-runs/pipeline-runs.router";
import { PipelinesRouter } from "../modules/pipelines/pipelines.router";
import { ProjectMembershipsRouter } from "../modules/project-memberships/project-memberships.router";
import { ProjectsRouter } from "../modules/projects/projects.router";
import { RepositoriesRouter } from "../modules/repositories/repositories.router";
import { RoleAssignmentsRouter } from "../modules/role-assignments/role-assignments.router";
import { RolesRouter } from "../modules/roles/roles.router";
import { SecurityPoliciesRouter } from "../modules/security-policies/security-policies.router";
import { TeamMembersRouter } from "../modules/team-members/team-members.router";
import { TeamsRouter } from "../modules/teams/teams.router";
import { UsersRouter } from "../modules/users/users.router";
import { VulnerabilityScansRouter } from "../modules/vulnerability-scans/vulnerability-scans.router";
import { WebhookEndpointsRouter } from "../modules/webhook-endpoints/webhook-endpoints.router";
import { WebhookEventsRouter } from "../modules/webhook-events/webhook-events.router";
import { WorkflowsRouter } from "../modules/workflows/workflows.router";
import { TrpcService } from "./trpc.service";

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly usersRouter: UsersRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    private readonly projectsRouter: ProjectsRouter,
    private readonly authRouter: AuthRouter,
    private readonly aiAssistantsRouter: AiAssistantsRouter,
    private readonly aiRecommendationsRouter: AiRecommendationsRouter,
    private readonly workflowsRouter: WorkflowsRouter,
    private readonly environmentsRouter: EnvironmentsRouter,
    private readonly deploymentsRouter: DeploymentsRouter,
    private readonly pipelinesRouter: PipelinesRouter,
    private readonly pipelineRunsRouter: PipelineRunsRouter,
    private readonly monitoringConfigsRouter: MonitoringConfigsRouter,
    private readonly performanceMetricsRouter: PerformanceMetricsRouter,
    private readonly intelligentAlertsRouter: IntelligentAlertsRouter,
    private readonly incidentsRouter: IncidentsRouter,
    private readonly eventsRouter: EventsRouter,
    private readonly repositoriesRouter: RepositoriesRouter,
    private readonly codeAnalysisResultsRouter: CodeAnalysisResultsRouter,
    private readonly vulnerabilityScansRouter: VulnerabilityScansRouter,
    private readonly securityPoliciesRouter: SecurityPoliciesRouter,
    private readonly costTrackingRouter: CostTrackingRouter,
    private readonly experimentsRouter: ExperimentsRouter,
    private readonly teamMembersRouter: TeamMembersRouter,
    private readonly teamsRouter: TeamsRouter,
    private readonly projectMembershipsRouter: ProjectMembershipsRouter,
    private readonly rolesRouter: RolesRouter,
    private readonly roleAssignmentsRouter: RoleAssignmentsRouter,
    private readonly identityProvidersRouter: IdentityProvidersRouter,
    private readonly oauthFlowsRouter: OAuthFlowsRouter,
    private readonly oauthAccountsRouter: OAuthAccountsRouter,
    private readonly authSessionsRouter: AuthSessionsRouter,
    private readonly webhookEndpointsRouter: WebhookEndpointsRouter,
    private readonly webhookEventsRouter: WebhookEventsRouter,
    private readonly auditLogsRouter: AuditLogsRouter
  ) {}

  public get appRouter() {
    return this.trpc.router({
      // 健康检查端点
      health: this.trpc.publicProcedure.query(() => {
        return {
          status: "ok",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        };
      }),

      // 核心模块
      users: this.usersRouter.usersRouter,
      organizations: this.organizationsRouter.organizationsRouter,
      projects: this.projectsRouter.projectsRouter,

      // 认证授权和安全
      auth: this.authRouter.authRouter,
      roles: this.rolesRouter.rolesRouter,
      roleAssignments: this.roleAssignmentsRouter.roleAssignmentsRouter,
      identityProviders: this.identityProvidersRouter.identityProvidersRouter,
      oauthFlows: this.oauthFlowsRouter.oauthFlowsRouter,
      oauthAccounts: this.oauthAccountsRouter.oauthAccountsRouter,
      authSessions: this.authSessionsRouter.authSessionsRouter,
      securityPolicies: this.securityPoliciesRouter.securityPoliciesRouter,
      vulnerabilityScans:
        this.vulnerabilityScansRouter.vulnerabilityScansRouter,

      // AI 和自动化
      aiAssistants: this.aiAssistantsRouter.aiAssistantsRouter,
      aiRecommendations: this.aiRecommendationsRouter.aiRecommendationsRouter,
      workflows: this.workflowsRouter.workflowsRouter,

      // 部署运维模块
      environments: this.environmentsRouter.environmentsRouter,
      deployments: this.deploymentsRouter.deploymentsRouter,
      pipelines: this.pipelinesRouter.pipelinesRouter,
      pipelineRuns: this.pipelineRunsRouter.pipelineRunsRouter,

      // 监控告警模块
      monitoringConfigs: this.monitoringConfigsRouter.monitoringConfigsRouter,
      performanceMetrics:
        this.performanceMetricsRouter.performanceMetricsRouter,
      intelligentAlerts: this.intelligentAlertsRouter.intelligentAlertsRouter,
      incidents: this.incidentsRouter.incidentsRouter,
      events: this.eventsRouter.eventsRouter,

      // 代码管理模块
      repositories: this.repositoriesRouter.repositoriesRouter,
      codeAnalysisResults:
        this.codeAnalysisResultsRouter.codeAnalysisResultsRouter,

      // 成本管理模块
      costTracking: this.costTrackingRouter.costTrackingRouter,

      // 实验和测试模块
      experiments: this.experimentsRouter.experimentsRouter,

      // 团队管理模块
      teamMembers: this.teamMembersRouter.teamMembersRouter,
      teams: this.teamsRouter.teamsRouter,
      projectMemberships:
        this.projectMembershipsRouter.projectMembershipsRouter,

      // Webhook 模块
      webhookEndpoints: this.webhookEndpointsRouter.webhookEndpointsRouter,
      webhookEvents: this.webhookEventsRouter.webhookEventsRouter,

      // 审计日志模块
      auditLogs: this.auditLogsRouter.auditLogsRouter,
    });
  }
}

export type AppRouter = TrpcRouter["appRouter"];
