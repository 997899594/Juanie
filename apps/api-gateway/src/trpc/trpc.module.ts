import { BusinessModule } from '@juanie/service-business'
import { ExtensionsModule } from '@juanie/service-extensions'
import { FoundationModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { AIRouter } from '../routers/ai.router'
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
import { ProjectTemplatesRouter } from '../routers/project-templates.router'
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
    // Three-tier service architecture
    FoundationModule, // 基础层
    BusinessModule,   // 业务层
    ExtensionsModule, // 扩展层
  ],
  providers: [
    TrpcService,
    TrpcRouter,
    AIRouter,
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
    ProjectTemplatesRouter,
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
