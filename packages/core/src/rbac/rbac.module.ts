import { Global, Module } from '@nestjs/common'
import { RBACService } from './rbac.service'

/**
 * RBAC 模块
 *
 * 提供全局的权限检查服务
 */
@Global()
@Module({
  providers: [RBACService],
  exports: [RBACService],
})
export class RBACModule {}
