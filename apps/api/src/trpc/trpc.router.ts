import { Injectable } from '@nestjs/common'
import { AiAssistantsRouter } from '@/modules/ai-assistants/ai-assistants.router'
import { AuditLogsRouter } from '@/modules/audit-logs/audit-logs.router'
import { AuthRouter } from '@/modules/auth/auth.router'
import { CostTrackingRouter } from '@/modules/cost-tracking/cost-tracking.router'
import { DeploymentsRouter } from '@/modules/deployments/deployments.router'
import { EnvironmentsRouter } from '@/modules/environments/environments.router'
import { NotificationsRouter } from '@/modules/notifications/notifications.router'
import { OrganizationsRouter } from '@/modules/organizations/organizations.router'
import { PipelinesRouter } from '@/modules/pipelines/pipelines.router'
import { ProjectsRouter } from '@/modules/projects/projects.router'
import { RepositoriesRouter } from '@/modules/repositories/repositories.router'
import { SecurityPoliciesRouter } from '@/modules/security-policies/security-policies.router'
import { TeamsRouter } from '@/modules/teams/teams.router'
import { TemplatesRouter } from '@/modules/templates/templates.router'
import { UsersRouter } from '@/modules/users/users.router'
import { TrpcService } from './trpc.service'

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authRouter: AuthRouter,
    private readonly usersRouter: UsersRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    private readonly teamsRouter: TeamsRouter,
    private readonly projectsRouter: ProjectsRouter,
    private readonly repositoriesRouter: RepositoriesRouter,
    private readonly environmentsRouter: EnvironmentsRouter,
    private readonly pipelinesRouter: PipelinesRouter,
    private readonly deploymentsRouter: DeploymentsRouter,
    private readonly costTrackingRouter: CostTrackingRouter,
    private readonly securityPoliciesRouter: SecurityPoliciesRouter,
    private readonly auditLogsRouter: AuditLogsRouter,
    private readonly notificationsRouter: NotificationsRouter,
    private readonly aiAssistantsRouter: AiAssistantsRouter,
    private readonly templatesRouter: TemplatesRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      health: this.trpc.procedure.query(() => {
        return { status: 'ok', timestamp: new Date().toISOString() }
      }),
      auth: this.authRouter.router,
      users: this.usersRouter.router,
      organizations: this.organizationsRouter.router,
      teams: this.teamsRouter.router,
      projects: this.projectsRouter.router,
      repositories: this.repositoriesRouter.router,
      environments: this.environmentsRouter.router,
      pipelines: this.pipelinesRouter.router,
      deployments: this.deploymentsRouter.router,
      costTracking: this.costTrackingRouter.router,
      securityPolicies: this.securityPoliciesRouter.router,
      auditLogs: this.auditLogsRouter.router,
      notifications: this.notificationsRouter.router,
      aiAssistants: this.aiAssistantsRouter.router,
      templates: this.templatesRouter.router,
    })
  }
}

export type AppRouter = TrpcRouter['appRouter']
