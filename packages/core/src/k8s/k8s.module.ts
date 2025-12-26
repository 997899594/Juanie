import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { K8sClientService } from './k8s-client.service'

/**
 * K8s 模块
 *
 * 提供 Kubernetes 集群操作能力
 * 使用官方 @kubernetes/client-node 库
 */
@Module({
  imports: [ConfigModule, EventEmitterModule],
  providers: [K8sClientService],
  exports: [K8sClientService],
})
export class K8sModule {}
