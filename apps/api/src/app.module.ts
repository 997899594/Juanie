import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module'
import { AiAssistantsModule } from './modules/ai-assistants/ai-assistants.module'
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module'
import { AuthModule } from './modules/auth/auth.module'
import { CostTrackingModule } from './modules/cost-tracking/cost-tracking.module'
import { DeploymentsModule } from './modules/deployments/deployments.module'
import { EnvironmentsModule } from './modules/environments/environments.module'
import { K3sModule } from './modules/k3s/k3s.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { PipelinesModule } from './modules/pipelines/pipelines.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { QueueModule } from './modules/queue/queue.module'
import { RepositoriesModule } from './modules/repositories/repositories.module'
import { SecurityPoliciesModule } from './modules/security-policies/security-policies.module'
import { StorageModule } from './modules/storage/storage.module'
import { TeamsModule } from './modules/teams/teams.module'
import { TemplatesModule } from './modules/templates/templates.module'
import { UsersModule } from './modules/users/users.module'
import { TrpcModule } from './trpc/trpc.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    DatabaseModule,
    StorageModule,
    QueueModule,
    K3sModule,
    TrpcModule,
    TemplatesModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    ProjectsModule,
    RepositoriesModule,
    EnvironmentsModule,
    PipelinesModule,
    DeploymentsModule,
    CostTrackingModule,
    SecurityPoliciesModule,
    AuditLogsModule,
    NotificationsModule,
    AiAssistantsModule,
  ],
})
export class AppModule {}
