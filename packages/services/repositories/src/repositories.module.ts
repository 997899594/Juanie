import { DatabaseModule } from '@juanie/core-database/module'
import { AuthModule } from '@juanie/service-auth'
import { GitProvidersModule } from '@juanie/service-git-providers'
import { Module } from '@nestjs/common'
import { RepositoriesService } from './repositories.service'

@Module({
  imports: [DatabaseModule, GitProvidersModule, AuthModule],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
