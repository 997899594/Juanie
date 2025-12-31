import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { PinoLogger } from 'nestjs-pino'
import { BunK8sClientService } from './bun-k8s-client.service'
import { K8sClientService } from './k8s-client.service'

/**
 * K8s 模块
 *
 * 提供 Kubernetes 集群操作能力
 *
 * 运行时检测:
 * - Bun: 使用 BunK8sClientService (原生 fetch + mTLS)
 * - Node.js: 使用 K8sClientService (@kubernetes/client-node)
 *
 * 配置方式:
 * 1. 设置 KUBECONFIG 环境变量
 * 2. 使用默认路径 ~/.kube/config
 * 3. 集群内自动配置
 */
@Module({
  imports: [ConfigModule, EventEmitterModule],
  providers: [
    {
      provide: K8sClientService,
      useFactory: (config: ConfigService, eventEmitter: EventEmitter2, logger: PinoLogger) => {
        // 检测运行时
        const isBun = typeof (globalThis as any).Bun !== 'undefined'

        if (isBun) {
          // Bun 运行时: 使用原生实现（需要 ConfigService 读取 KUBECONFIG）
          return new BunK8sClientService(config, eventEmitter, logger)
        }

        // Node.js 运行时: 使用官方库（自动读取 KUBECONFIG 环境变量）
        return new K8sClientService(eventEmitter, logger)
      },
      inject: [ConfigService, EventEmitter2, PinoLogger],
    },
  ],
  exports: [K8sClientService],
})
export class K8sModule {}
