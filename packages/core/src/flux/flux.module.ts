import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { K8sModule } from '../k8s/k8s.module'
import { FluxService } from './flux.service'
import { FluxCliService } from './flux-cli.service'
import { FluxWatcherService } from './flux-watcher.service'
import { YamlGeneratorService } from './yaml-generator.service'

/**
 * Flux 模块
 *
 * 提供 Flux CD 基础设施能力:
 * - Flux CLI 封装
 * - Flux 生命周期管理
 * - Flux 资源监听
 *
 * Note: 这是纯基础设施模块，不包含业务逻辑
 * 业务逻辑（如 FluxResourcesService, FluxSyncService, FluxMetricsService）
 * 应该保留在 Business 层
 */
@Module({
  imports: [ConfigModule, EventEmitterModule, K8sModule],
  providers: [FluxCliService, FluxService, FluxWatcherService, YamlGeneratorService],
  exports: [FluxCliService, FluxService, FluxWatcherService, YamlGeneratorService],
})
export class FluxModule {}
