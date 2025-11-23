import { Module } from '@nestjs/common'
import { ProjectsModule } from './projects/projects.module'
import { DeploymentsModule } from './deployments/deployments.module'
import { EnvironmentsModule } from './environments/environments.module'
import { RepositoriesModule } from './repositories/repositories.module'
import { PipelinesModule } from './pipelines/pipelines.module'
import { TemplatesModule } from './templates/templates.module'
import { GitOpsModule } from './gitops/git-ops/git-ops.module'
import { FluxModule } from './gitops/flux/flux.module'
import { K3sModule } from './gitops/k3s/k3s.module'
import { GitProvidersModule } from './gitops/git-providers/git-providers.module'
import { GitOpsOrchestratorModule } from './gitops/gitops-orchestrator.module'

/**
 * Business Module - 业务层模块
 * 提供项目管理、部署管理和 GitOps 功能
 */
@Module({
  imports: [
    // 项目相关
    ProjectsModule,
    EnvironmentsModule,
    TemplatesModule,
    // 部署相关
    DeploymentsModule,
    RepositoriesModule,
    PipelinesModule,
    // GitOps 相关
    GitOpsModule,
    FluxModule,
    K3sModule,
    GitProvidersModule,
    GitOpsOrchestratorModule,
  ],
  exports: [
    ProjectsModule,
    EnvironmentsModule,
    TemplatesModule,
    DeploymentsModule,
    RepositoriesModule,
    PipelinesModule,
    GitOpsModule,
    FluxModule,
    K3sModule,
    GitProvidersModule,
    GitOpsOrchestratorModule,
  ],
})
export class BusinessModule {}
