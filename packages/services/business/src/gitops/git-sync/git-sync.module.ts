/**
 * Git 同步模块
 *
 * 提供 Git 平台同步功能
 *
 * ✅ 架构清理完成：
 * - 删除了 Business 层重复的 Flux 实现
 * - 直接使用 Core 层的 FluxModule 和 K8sModule
 * - 使用 EventEmitter2 而不是自定义事件包装器
 * - 使用 @nestjs/bullmq 管理队列和 Worker
 */

import { FluxModule } from '@juanie/core/flux'; // ✅ 使用 Core 层 FluxModule
import { K8sModule } from '@juanie/core/k8s'; // ✅ 使用 Core 层 K8sModule
import {
  GitConnectionsModule,
  GitProvidersModule,
  GitSyncLogsModule,
  OrganizationsModule,
} from '@juanie/service-foundation';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from '../../projects/core';
import { ConflictResolutionService } from './conflict-resolution.service';
import { GitSyncEventHandler } from './git-sync-event-handler.service';
import { GitSyncService } from './git-sync.service';
import { GitSyncWorker } from './git-sync.worker';
import { OrganizationEventHandler } from './organization-event-handler.service';
import { OrganizationSyncService } from './organization-sync.service';
import { ProjectCollaborationSyncService } from './project-collaboration-sync.service';

/**
 * Git 同步模块
 *
 * ✅ 架构改进：
 * - 导入 Core 层的 FluxModule（提供 FluxCliService）
 * - 导入 Core 层的 K8sModule（提供 K8sClientService）
 * - 使用 @nestjs/bullmq 注册 git-sync 队列
 * - Core 层的 QueueModule 是全局的，无需导入
 */
@Module({
  imports: [
    // ✅ Core 层服务
    FluxModule, // 提供 FluxCliService
    K8sModule, // 提供 K8sClientService
    ConfigModule,

    // ✅ Foundation 层服务
    GitConnectionsModule,
    GitSyncLogsModule,
    GitProvidersModule,
    OrganizationsModule, // 提供 OrganizationsService

    // ✅ Business 层服务
    ProjectsModule,

    // ✅ 注册 git-sync 队列
    BullModule.registerQueue({
      name: 'git-sync',
    }),
  ],
  providers: [
    GitSyncService,
    GitSyncWorker,
    GitSyncEventHandler,
    OrganizationSyncService,
    ProjectCollaborationSyncService,
    ConflictResolutionService,
  ],
  exports: [
    GitSyncService,
    OrganizationSyncService,
    ProjectCollaborationSyncService,
    ConflictResolutionService,
  ],
})
export class GitSyncModule {}
