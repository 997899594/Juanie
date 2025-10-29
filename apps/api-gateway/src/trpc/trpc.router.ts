import { Injectable } from '@nestjs/common'
import { AuthRouter } from '../routers/auth.router'
import { DeploymentsRouter } from '../routers/deployments.router'
import { EnvironmentsRouter } from '../routers/environments.router'
import { OrganizationsRouter } from '../routers/organizations.router'
import { PipelinesRouter } from '../routers/pipelines.router'
import { ProjectsRouter } from '../routers/projects.router'
import { RepositoriesRouter } from '../routers/repositories.router'
import { TeamsRouter } from '../routers/teams.router'
import { TrpcService } from './trpc.service'

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authRouter: AuthRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    private readonly teamsRouter: TeamsRouter,
    private readonly projectsRouter: ProjectsRouter,
    private readonly repositoriesRouter: RepositoriesRouter,
    private readonly environmentsRouter: EnvironmentsRouter,
    private readonly deploymentsRouter: DeploymentsRouter,
    private readonly pipelinesRouter: PipelinesRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      health: this.trpc.procedure.query(() => {
        return { status: 'ok', timestamp: new Date().toISOString() }
      }),
      // 服务路由
      auth: this.authRouter.router,
      organizations: this.organizationsRouter.router,
      teams: this.teamsRouter.router,
      projects: this.projectsRouter.router,
      repositories: this.repositoriesRouter.router,
      environments: this.environmentsRouter.router,
      deployments: this.deploymentsRouter.router,
      pipelines: this.pipelinesRouter.router,
      // 其他服务路由将在这里添加
    })
  }
}

export type AppRouter = TrpcRouter['appRouter']
