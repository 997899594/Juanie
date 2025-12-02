import { EncryptionService, FoundationModule } from '@juanie/service-foundation'
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { K3sModule } from '../k3s/k3s.module'
import { CredentialFactory } from './credential-factory'
import { CredentialManagerService } from './credential-manager.service'
import { CredentialStrategyService } from './credential-strategy.service'
import { CredentialHealthMonitorService } from './health-monitor.service'

/**
 * 凭证管理模块
 * 提供 Git 认证凭证的创建、管理、健康检查等功能
 */
@Module({
  imports: [
    ScheduleModule.forRoot(), // 启用定时任务
    FoundationModule, // OAuth 服务
    K3sModule, // K8s 服务
  ],
  providers: [
    EncryptionService,
    CredentialFactory,
    CredentialManagerService,
    CredentialHealthMonitorService,
    CredentialStrategyService,
  ],
  exports: [CredentialManagerService, EncryptionService, CredentialStrategyService],
})
export class CredentialsModule {}
