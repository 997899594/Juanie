import { AiAssistantsModule } from '@juanie/service-ai-assistants'
import { AuditLogsModule } from '@juanie/service-audit-logs'
import { AuthModule } from '@juanie/service-auth'
import { CostTrackingModule } from '@juanie/service-cost-tracking'
import { DeploymentsModule } from '@juanie/service-deployments'
import { EnvironmentsModule } from '@juanie/service-environments'
import { FluxModule } from '@juanie/service-flux'
import { GitOpsModule } from '@juanie/service-git-ops'
import { NotificationsModule } from '@juanie/service-notifications'
import { OrganizationsModule } from '@juanie/service-organizations'
import { PipelinesModule } from '@juanie/service-pipelines'
import { ProjectsModule } from '@juanie/service-projects'
import { RepositoriesModule } from '@juanie/service-repositories'
import { SecurityPoliciesModule } from '@juanie/service-security-policies'
import { TeamsModule } from '@juanie/service-teams'
import { TemplatesModule } from '@juanie/service-templates'
import { UsersModule } from '@juanie/service-users'
import { Module } from '@nestjs/common'
import { AiAssistantsRouter } from '../routers/ai-assistants.router'
import { AuditLogsRouter } from '../routers/audit-logs.router'
import { AuthRouter } from '../routers/auth.router'
import { CostTrackingRouter } from '../routers/cost-tracking.router'
import { DeploymentsRouter } from '../routers/deployments.router'
import { EnvironmentsRouter } from '../routers/environments.router'
import { GitOpsRouter } from '../routers/gitops.router'
import { NotificationsRouter } from '../routers/notifications.router'
import { OrganizationsRouter } from '../routers/organizations.router'
import { PipelinesRouter } from '../routers/pipelines.router'
import { ProjectsRouter } from '../routers/projects.router'
import { RepositoriesRouter } from '../routers/repositories.router'
import { SecurityPoliciesRouter } from '../routers/security-policies.router'
import { TeamsRouter } from '../routers/teams.router'
import { TemplatesRouter } from '../routers/templates.router'
import { UsersRouter } from '../routers/users.router'
import { TrpcRouter } from './trpc.router'
import { TrpcService } from './trpc.service'

@Module({
  imports: [
    AiAssistantsModule,
    AuditLogsModule,
    AuthModule,
    CostTrackingModule,
    UsersModule,
    NotificationsModule,
    TemplatesModule,
    OrganizationsModule,
    TeamsModule,
    ProjectsModule,
    RepositoriesModule,
    SecurityPoliciesModule,
    EnvironmentsModule,
    DeploymentsModule,
    PipelinesModule,
    FluxModule,
    GitOpsModule,
  ],
  providers: [
    TrpcService,
    TrpcRouter,
    AiAssistantsRouter,
    AuditLogsRouter,
    AuthRouter,
    CostTrackingRouter,
    UsersRouter,
    NotificationsRouter,
    TemplatesRouter,
    OrganizationsRouter,
    TeamsRouter,
    ProjectsRouter,
    RepositoriesRouter,
    SecurityPoliciesRouter,
    EnvironmentsRouter,
    DeploymentsRouter,
    PipelinesRouter,
    GitOpsRouter,
  ],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
