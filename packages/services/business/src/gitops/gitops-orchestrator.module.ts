import { DatabaseModule } from '@juanie/core-database'
import { Module } from '@nestjs/common'
import { FluxModule } from './flux/flux.module'
import { K3sModule } from './k3s/k3s.module'
import { GitOpsOrchestratorService } from './gitops-orchestrator.service'

/**
 * GitOps Orchestrator Module
 * 提供 GitOps 资源编排服务
 */
@Module({
  imports: [
    DatabaseModule,
    K3sModule,
    FluxModule,
  ],
  providers: [GitOpsOrchestratorService],
  exports: [GitOpsOrchestratorService],
})
export class GitOpsOrchestratorModule {}
