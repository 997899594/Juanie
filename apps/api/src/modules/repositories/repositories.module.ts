import { Module } from '@nestjs/common'
import { RepositoriesRouter } from './repositories.router'
import { RepositoriesService } from './repositories.service'

@Module({
  providers: [RepositoriesService, RepositoriesRouter],
  exports: [RepositoriesService, RepositoriesRouter],
})
export class RepositoriesModule {}
