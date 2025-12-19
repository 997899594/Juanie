import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { GitConnectionsService } from './git-connections.service'

@Module({
  imports: [DatabaseModule],
  providers: [GitConnectionsService],
  exports: [GitConnectionsService],
})
export class GitConnectionsModule {}
