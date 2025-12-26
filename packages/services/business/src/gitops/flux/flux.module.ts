/**
 * Business 层 Flux 模块
 *
 * ✅ 架构清理完成：
 * - 删除了重复的 Flux 实现（flux.service.ts, flux-resources.service.ts, flux-sync.service.ts, flux-watcher.service.ts）
 * - 保留了有用的工具服务（FluxMetricsService, YamlGeneratorService）
 * - 直接使用 Core 层的 FluxModule 和 K8sModule
 *
 * 本模块现在只提供：
 * - FluxMetricsService: Flux 指标收集
 * - YamlGeneratorService: YAML 生成工具
 */

import { FluxModule as CoreFluxModule } from '@juanie/core/flux' // ✅ 使用 Core 层
import { K8sModule } from '@juanie/core/k8s' // ✅ 使用 Core 层
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FluxMetricsService } from './flux-metrics.service'
import { YamlGeneratorService } from './yaml-generator.service'

/**
 * Business 层 Flux 模块
 *
 * ⚠️ 重要：本模块不再提供 Flux 操作服务
 * 如需 Flux 操作，请直接使用：
 * - @juanie/core/flux 的 FluxCliService
 * - @juanie/core/k8s 的 K8sClientService
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    CoreFluxModule, // ✅ 导入 Core 层 FluxModule
    K8sModule, // ✅ 导入 Core 层 K8sModule
  ],
  providers: [
    FluxMetricsService, // ✅ 保留：指标收集
    YamlGeneratorService, // ✅ 保留：YAML 生成工具
  ],
  exports: [
    FluxMetricsService,
    YamlGeneratorService,
    CoreFluxModule, // ✅ 导出 Core 层模块，方便其他模块使用
    K8sModule, // ✅ 导出 Core 层模块
  ],
})
export class FluxModule {}
