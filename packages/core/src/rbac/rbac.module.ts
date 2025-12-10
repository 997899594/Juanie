import { Global, Module } from '@nestjs/common'
import { CaslModule } from './casl/casl.module'

/**
 * RBAC 模块
 *
 * 基于 CASL 的权限管理系统
 */
@Global()
@Module({
  imports: [CaslModule],
  exports: [CaslModule],
})
export class RBACModule {}
