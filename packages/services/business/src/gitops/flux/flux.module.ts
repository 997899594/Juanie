import { DatabaseModule } from '@juanie/core/database'
import { CoreEventsModule } from '@juanie/core/events'
import { FoundationModule } from '@juanie/service-foundation'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CredentialsModule } from '../credentials/credentials.module'
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
    CredentialsModule, // 新的凭证管理模块
  ],
  providers: [
    FluxService,
    FluxResourcesService,
    FluxSyncService,
    FluxCliService,
    FluxMetricsService,
    YamlGeneratorService,
    FluxWatcherService,
  ],
  exports: [
    FluxService,
    FluxResourcesService,
    FluxSyncService,
    FluxCliService,
    FluxMetricsService,
    YamlGeneratorService,
    FluxWatcherService,
  ],
})
export class FluxModule {}
