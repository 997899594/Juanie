import { DatabaseModule } from '@juanie/core/database'
import { CoreEventsModule } from '@juanie/core/events'
import { FoundationModule } from '@juanie/service-foundation'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitAuthModule } from '../git-auth/git-auth.module'
import { GitOpsEventHandlerService } from '../gitops-event-handler.service'
import { K3sModule } from '../k3s/k3s.module'
import { FluxService } from './flux.service'
import { FluxCliService } from './flux-cli.service'
import { FluxMetricsService } from './flux-metrics.service'
import { FluxResourcesService } from './flux-resources.service'
import { FluxSyncService } from './flux-sync.service'
import { FluxWatcherService } from './flux-watcher.service'
import { YamlGeneratorService } from './yaml-generator.service'

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    K3sModule,
    CoreEventsModule,
    FoundationModule,
    GitAuthModule, // 新的 Git 认证模块（替代定时刷新）
  ],
  providers: [
    FluxService,
    FluxResourcesService,
    FluxSyncService,
    FluxCliService,
    FluxMetricsService,
    YamlGeneratorService,
    FluxWatcherService,
    GitOpsEventHandlerService, // 事件处理服务
  ],
  exports: [
    FluxService,
    FluxResourcesService,
    FluxSyncService,
    FluxCliService,
    FluxMetricsService,
    YamlGeneratorService,
    FluxWatcherService,
    GitOpsEventHandlerService,
  ],
})
export class FluxModule {}
