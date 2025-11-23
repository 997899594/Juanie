import { DatabaseModule } from '@juanie/core-database/module'
import { AuthModule } from '@juanie/service-foundation'
import { GitProvidersModule } from '../gitops/git-providers/git-providers.module'
import { Module } from '@nestjs/common'
import { RepositoriesService } from './repositories.service'

@Module({
  imports: [DatabaseModule, GitProvidersModule, AuthModule],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
