import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { GitOpsResourcesService } from './gitops-resources.service'

@Module({
  imports: [DatabaseModule],
  providers: [GitOpsResourcesService],
  exports: [GitOpsResourcesService],
})
export class GitOpsResourcesModule {}
