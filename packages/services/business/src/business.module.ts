import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DeploymentsModule } from './deployments/deployments.module'
import { EnvironmentsModule } from './environments/environments.module'
import { FluxModule } from './gitops/flux/flux.module'
import { GitOpsModule } from './gitops/git-ops/git-ops.module'
import { GitProvidersModule } from './gitops/git-providers/git-providers.module'
import { K3sModule } from './gitops/k3s/k3s.module'
import { PipelinesModule } from './pipelines/pipelines.module'
import { ProjectsModule } from './projects/projects.module'
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
 * - K3sModule - Kubernetes 服务
 * - AuthModule (来自 FoundationModule) - 认证服务
 */
@Module({
  imports: [
    // 全局模块 - 需要在此处导入一次以注册
    GitProvidersModule,
    FluxModule,
    K3sModule,
    // 业务模块
    GitOpsModule,
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
    GitOpsModule,
  ],
})
export class BusinessModule {}
