import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { EncryptionService } from '../encryption/encryption.service'
import { GitConnectionsService } from './git-connections.service'

@Module({
  imports: [DatabaseModule],
  providers: [GitConnectionsService, EncryptionService],
  exports: [GitConnectionsService],
})
export class GitConnectionsModule {}
