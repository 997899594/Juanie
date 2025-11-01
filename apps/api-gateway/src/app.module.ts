import { DatabaseModule } from '@juanie/core-database/module'
import { QueueModule } from '@juanie/core-queue/module'
import { AiAssistantsModule } from '@juanie/service-ai-assistants'
import { AuditLogsModule } from '@juanie/service-audit-logs'
import { AuthModule } from '@juanie/service-auth'
import { CostTrackingModule } from '@juanie/service-cost-tracking'
import { DeploymentsModule } from '@juanie/service-deployments'
import { EnvironmentsModule } from '@juanie/service-environments'
import { K3sModule } from '@juanie/service-k3s'
import { NotificationsModule } from '@juanie/service-notifications'
import { OllamaModule } from '@juanie/service-ollama'
import { OrganizationsModule } from '@juanie/service-organizations'
import { PipelinesModule } from '@juanie/service-pipelines'
import { ProjectsModule } from '@juanie/service-projects'
import { RepositoriesModule } from '@juanie/service-repositories'
import { SecurityPoliciesModule } from '@juanie/service-security-policies'
import { StorageModule } from '@juanie/service-storage'
import { TemplatesModule } from '@juanie/service-templates'
import { UsersModule } from '@juanie/service-users'
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
    QueueModule,
    StorageModule,
    K3sModule,
    OllamaModule,
    AiAssistantsModule,
    AuditLogsModule,
    AuthModule,
    CostTrackingModule,
    UsersModule,
    NotificationsModule,
    TemplatesModule,
    OrganizationsModule,
    ProjectsModule,
    RepositoriesModule,
    SecurityPoliciesModule,
    EnvironmentsModule,
    DeploymentsModule,
    PipelinesModule,
    TrpcModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
