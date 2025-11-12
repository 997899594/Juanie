import { K3sModule } from '@juanie/service-k3s'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FluxService } from './flux.service'
import { FluxCliService } from './flux-cli.service'
import { FluxMetricsService } from './flux-metrics.service'
import { FluxWatcherService } from './flux-watcher.service'
import { YamlGeneratorService } from './yaml-generator.service'

@Global()
@Module({
  imports: [ConfigModule, K3sModule],
  providers: [
    FluxService,
    FluxCliService,
    FluxMetricsService,
    YamlGeneratorService,
    FluxWatcherService,
  ],
  exports: [
    FluxService,
    FluxCliService,
    FluxMetricsService,
    YamlGeneratorService,
    FluxWatcherService,
  ],
})
export class FluxModule {}
