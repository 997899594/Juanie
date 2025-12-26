// ✅ Business 层 Flux 模块（仅工具服务）
export { FluxModule } from './flux.module'
export { FluxMetricsService } from './flux-metrics.service'
export { YamlGeneratorService } from './yaml-generator.service'

// ⚠️ 已删除的服务（请使用 Core 层替代）：
// - FluxService -> 使用 @juanie/core/flux 的 FluxService
// - FluxResourcesService -> 使用 @juanie/core/flux 的 FluxCliService + @juanie/core/k8s 的 K8sClientService
// - FluxSyncService -> 功能已合并到 GitSyncService
// - FluxWatcherService -> 使用 @juanie/core/flux 的 FluxWatcherService
