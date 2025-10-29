import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { EnvironmentsModule } from '@/modules/environments/environments.module'
import { OrganizationsModule } from '@/modules/organizations/organizations.module'
import { PipelinesModule } from '@/modules/pipelines/pipelines.module'
import { ProjectsModule } from '@/modules/projects/projects.module'
import { RepositoriesModule } from '@/modules/repositories/repositories.module'
import { TeamsModule } from '@/modules/teams/teams.module'
import { UsersModule } from '@/modules/users/users.module'
import { TrpcRouter } from './trpc.router'
import { TrpcService } from './trpc.service'

@Module({
  imports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    ProjectsModule,
    RepositoriesModule,
    EnvironmentsModule,
    PipelinesModule,
  ],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
