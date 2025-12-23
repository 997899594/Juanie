import { Injectable } from '@nestjs/common'
import { AIRouter } from '../routers/ai.router'
import { AiAssistantsRouter } from '../routers/ai-assistants.router'
import { AICodeReviewRouter } from '../routers/ai-code-review.router'
import { AuditLogsRouter } from '../routers/audit-logs.router'
import { AuthRouter } from '../routers/auth.router'
import { CostTrackingRouter } from '../routers/cost-tracking.router'
import { DeploymentsRouter } from '../routers/deployments.router'
import { EnvironmentsRouter } from '../routers/environments.router'
import { GitSyncRouter } from '../routers/git-sync.router'
import { GitOpsRouter } from '../routers/gitops.router'
import { NotificationsRouter } from '../routers/notifications.router'
import { OrganizationsRouter } from '../routers/organizations.router'
import { PipelinesRouter } from '../routers/pipelines.router'
import { ProjectsRouter } from '../routers/projects.router'
import { RepositoriesRouter } from '../routers/repositories.router'
import { SecurityPoliciesRouter } from '../routers/security-policies.router'
import { SessionsRouter } from '../routers/sessions.router'
import { TeamsRouter } from '../routers/teams.router'
import { TemplatesRouter } from '../routers/templates.router'
import { UsersRouter } from '../routers/users.router'
import { TrpcService } from './trpc.service'

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly aiRouter: AIRouter,
    private readonly aiCodeReviewRouter: AICodeReviewRouter,
    private readonly aiAssistantsRouter: AiAssistantsRouter,
    private readonly auditLogsRouter: AuditLogsRouter,
    private readonly authRouter: AuthRouter,
    private readonly costTrackingRouter: CostTrackingRouter,
    private readonly usersRouter: UsersRouter,
    private readonly notificationsRouter: NotificationsRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    private readonly teamsRouter: TeamsRouter,
    private readonly projectsRouter: ProjectsRouter,
    private readonly repositoriesRouter: RepositoriesRouter,
    private readonly securityPoliciesRouter: SecurityPoliciesRouter,
    private readonly sessionsRouter: SessionsRouter,
    private readonly environmentsRouter: EnvironmentsRouter,
    private readonly deploymentsRouter: DeploymentsRouter,
    private readonly pipelinesRouter: PipelinesRouter,
    private readonly gitOpsRouter: GitOpsRouter,
    private readonly gitSyncRouter: GitSyncRouter,
    private readonly templatesRouter: TemplatesRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      health: this.trpc.procedure.query(() => {
        return { status: 'ok', timestamp: new Date().toISOString() }
      }),
      // 服务路由
      ai: this.aiRouter.router,
      aiCodeReview: this.aiCodeReviewRouter.router,
      aiAssistants: this.aiAssistantsRouter.router,
      auditLogs: this.auditLogsRouter.router,
      auth: this.authRouter.router,
      costTracking: this.costTrackingRouter.router,
      users: this.usersRouter.router,
      notifications: this.notificationsRouter.router,
      organizations: this.organizationsRouter.router,
      teams: this.teamsRouter.router,
      projects: this.projectsRouter.router,
      repositories: this.repositoriesRouter.router,
      securityPolicies: this.securityPoliciesRouter.router,
      sessions: this.sessionsRouter.router,
      environments: this.environmentsRouter.router,
      deployments: this.deploymentsRouter.router,
      pipelines: this.pipelinesRouter.router,
      gitops: this.gitOpsRouter.router,
      gitSync: this.gitSyncRouter.router,
      templates: this.templatesRouter.router,
      // 其他服务路由将在这里添加
    })
  }
}

export type AppRouter = TrpcRouter['appRouter']
