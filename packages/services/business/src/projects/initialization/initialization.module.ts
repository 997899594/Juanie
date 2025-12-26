import { AuditLogsModule, NotificationsModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EnvironmentsModule } from '../../environments/environments.module'
import { FluxModule } from '../../gitops/flux/flux.module'
// GitOpsModule 已删除 - Phase 9
// import { GitOpsModule } from '../../gitops/git-ops/git-ops.module'
import { RepositoriesModule } from '../../repositories/repositories.module'
import { TemplatesModule } from '../templates'
import { ProjectInitializationService } from './initialization.service'

/**
 * Project Initialization Module（重构版）
 *
 * 简化后的模块：
 * - 只保留核心的 ProjectInitializationService
 * - 移除状态机、Handler、ProgressManager 等过度设计
 * - 利用 BullMQ、Redis、EventEmitter2 等上游能力
 *
 * 注意：
 * - AuthModule 和 FluxModule 是全局模块，无需显式导入
 * - GitConnectionsModule 通过 RepositoriesModule 重新导出，无需直接导入
 * - GitOpsModule 已删除 (Phase 9)
 */
@Module({
  imports: [
    ConfigModule,
    TemplatesModule,
    EnvironmentsModule,
    RepositoriesModule, // 包含 GitConnectionsModule
    FluxModule, // 包含 FluxResourcesService
    // GitOpsModule, // 已删除 - Phase 9
    NotificationsModule,
    AuditLogsModule,
  ],
  providers: [
    // 核心初始化服务（所有逻辑都在这里）
    ProjectInitializationService,
  ],
  exports: [
    // 导出初始化服务
    ProjectInitializationService,
  ],
})
export class ProjectInitializationModule {}
