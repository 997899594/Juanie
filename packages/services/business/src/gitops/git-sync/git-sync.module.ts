/**
 * Git 同步模块
 *
 * 提供 Git 平台同步功能
 */

import { DatabaseModule } from '@juanie/core/database'
import { QueueModule } from '@juanie/core/queue'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CredentialsModule } from '../credentials/credentials.module'
import { GitProvidersModule } from '../git-providers/git-providers.module'
import { ConflictResolutionService } from './conflict-resolution.service'
import { GitSyncService } from './git-sync.service'
import { GitSyncWorker } from './git-sync.worker'
import { GitSyncErrorService } from './git-sync-errors'
import { OrganizationEventHandler } from './organization-event-handler.service'
import { OrganizationSyncService } from './organization-sync.service'
import { ProjectCollaborationSyncService } from './project-collaboration-sync.service'

@Module({
  imports: [DatabaseModule, QueueModule, ConfigModule, GitProvidersModule, CredentialsModule],
  providers: [
    GitSyncService,
    GitSyncWorker,
    OrganizationSyncService,
    ProjectCollaborationSyncService,
    GitSyncErrorService,
    OrganizationEventHandler,
    ConflictResolutionService,
  ],
  exports: [
    GitSyncService,
    OrganizationSyncService,
    ProjectCollaborationSyncService,
    GitSyncErrorService,
    ConflictResolutionService,
  ],
})
export class GitSyncModule {}
