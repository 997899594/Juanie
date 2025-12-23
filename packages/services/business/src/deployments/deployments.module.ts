import { Module } from '@nestjs/common'
import { GitOpsModule } from '../gitops/gitops.module'
import { DeploymentsService } from './deployments.service'

@Module({
  imports: [GitOpsModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
