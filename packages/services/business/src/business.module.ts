import { K8sModule } from '@juanie/core/k8s'
import { GitProvidersModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { DeploymentsModule } from './deployments/deployments.module'
import { EnvironmentsModule } from './environments/environments.module'
import { FluxModule } from './gitops/flux/flux.module'
import { GitSyncModule } from './gitops/git-sync/git-sync.module'
import { WebhookModule } from './gitops/webhooks/webhook.module'
import { PipelinesModule } from './pipelines/pipelines.module'
import { ProjectsModule } from './projects/core'
import { BusinessQueueModule } from './queue/queue.module'
import { RepositoriesModule } from './repositories/repositories.module'
import { TemplatesModule } from './templates/templates.module'

/**
 * Business Module - 业务层模块
 * 提供项目管理、部署管理和 GitOps 功能
 *
 * 全局模块（自动可用，无需在其他模块中导入）：
 * - GitProvidersModule - Git 提供商服务
 * - FluxModule - GitOps/Flux 服务
 * - K8sModule (来自 Core) - Kubernetes 服务
 * - AuthModule (来自 FoundationModule) - 认证服务
 */
@Module({
  imports: [
    // 全局模块 - 需要在此处导入一次以注册
    K8sModule,
    GitProvidersModule,
    FluxModule,
    GitSyncModule,
    WebhookModule,
    // 业务模块
    // GitOpsModule, // 已删除 - Phase 9
    ProjectsModule,
    EnvironmentsModule,
    TemplatesModule,
    DeploymentsModule,
    RepositoriesModule,
    PipelinesModule,
    BusinessQueueModule,
  ],
  exports: [
    // 导出非全局模块供外部使用
    ProjectsModule,
    EnvironmentsModule,
    TemplatesModule,
    DeploymentsModule,
    RepositoriesModule,
    PipelinesModule,
    // GitOpsModule, // 已删除 - Phase 9
    GitSyncModule,
    WebhookModule,
  ],
})
export class BusinessModule {}
