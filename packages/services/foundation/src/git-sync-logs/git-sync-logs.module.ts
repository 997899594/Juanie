import { Module } from '@nestjs/common'
import { GitSyncLogsService } from './git-sync-logs.service'

@Module({
  providers: [GitSyncLogsService],
  exports: [GitSyncLogsService],
})
export class GitSyncLogsModule {}
