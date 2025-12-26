/**
 * RBAC Module
 *
 * 提供基于角色的访问控制功能
 *
 * @packageDocumentation
 */

import { DatabaseModule } from '@juanie/core/database'
import { Module } from '@nestjs/common'
import { RbacGuard } from './guards/rbac.guard'
import { RbacService } from './rbac.service'

@Module({
  imports: [DatabaseModule],
  providers: [RbacService, RbacGuard],
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
