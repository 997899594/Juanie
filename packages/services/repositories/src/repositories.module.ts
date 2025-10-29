import { DatabaseModule } from '@juanie/core-database/module'
import { Module } from '@nestjs/common'
import { RepositoriesService } from './repositories.service'

@Module({
  imports: [DatabaseModule],
  providers: [RepositoriesService],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
