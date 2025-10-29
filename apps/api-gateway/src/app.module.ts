import { DatabaseModule } from '@juanie/core-database/module'
import { AuthModule } from '@juanie/service-auth'
import { DeploymentsModule } from '@juanie/service-deployments'
import { EnvironmentsModule } from '@juanie/service-environments'
import { K3sModule } from '@juanie/service-k3s'
import { OrganizationsModule } from '@juanie/service-organizations'
import { PipelinesModule } from '@juanie/service-pipelines'
import { ProjectsModule } from '@juanie/service-projects'
import { RepositoriesModule } from '@juanie/service-repositories'
import { StorageModule } from '@juanie/service-storage'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { TrpcModule } from './trpc/trpc.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    StorageModule,
    K3sModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    RepositoriesModule,
    EnvironmentsModule,
    DeploymentsModule,
    PipelinesModule,
    TrpcModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
