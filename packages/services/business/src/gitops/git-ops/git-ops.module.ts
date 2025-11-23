import { DatabaseModule } from '@juanie/core-database/module'
import { K3sModule } from '../k3s/k3s.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitOpsService } from './git-ops.service'

@Module({
  imports: [DatabaseModule, K3sModule, ConfigModule],
  providers: [GitOpsService],
  exports: [GitOpsService],
})
export class GitOpsModule {}
