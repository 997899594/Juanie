import { AuthModule } from '@juanie/service-auth'
import { DeploymentsModule } from '@juanie/service-deployments'
import { EnvironmentsModule } from '@juanie/service-environments'
import { OrganizationsModule } from '@juanie/service-organizations'
import { PipelinesModule } from '@juanie/service-pipelines'
import { ProjectsModule } from '@juanie/service-projects'
import { RepositoriesModule } from '@juanie/service-repositories'
import { TeamsModule } from '@juanie/service-teams'
import { Module } from '@nestjs/common'
import { AuthRouter } from '../routers/auth.router'
import { DeploymentsRouter } from '../routers/deployments.router'
import { EnvironmentsRouter } from '../routers/environments.router'
import { OrganizationsRouter } from '../routers/organizations.router'
import { PipelinesRouter } from '../routers/pipelines.router'
import { ProjectsRouter } from '../routers/projects.router'
import { RepositoriesRouter } from '../routers/repositories.router'
import { TeamsRouter } from '../routers/teams.router'
import { TrpcRouter } from './trpc.router'
import { TrpcService } from './trpc.service'

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    TeamsModule,
    ProjectsModule,
    RepositoriesModule,
    EnvironmentsModule,
    DeploymentsModule,
    PipelinesModule,
  ],
  providers: [
    TrpcService,
    TrpcRouter,
    AuthRouter,
    OrganizationsRouter,
    TeamsRouter,
    ProjectsRouter,
    RepositoriesRouter,
    EnvironmentsRouter,
    DeploymentsRouter,
    PipelinesRouter,
  ],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
