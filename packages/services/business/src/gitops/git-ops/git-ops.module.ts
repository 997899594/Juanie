import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { K3sModule } from '../k3s/k3s.module'
import { GitOpsService } from './git-ops.service'

@Module({
  imports: [DatabaseModule, K3sModule, ConfigModule],
  providers: [GitOpsService],
  exports: [GitOpsService],
})
export class GitOpsModule {}
