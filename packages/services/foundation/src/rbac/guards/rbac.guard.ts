/**
 * RBAC Guard
 *
 * NestJS Guard 用于保护路由和方法
 *
 * @packageDocumentation
 */

import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PinoLogger } from 'nestjs-pino'
import { CHECK_ABILITY_KEY, type RequiredAbility } from '../decorators/check-ability.decorator'
import { RbacService } from '../rbac.service'

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RbacGuard.name)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAbility = this.reflector.get<RequiredAbility>(
      CHECK_ABILITY_KEY,
      context.getHandler(),
    )

    if (!requiredAbility) {
      // 没有权限要求，允许访问
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user || !user.id) {
      this.logger.warn('No user found in request')
      return false
    }

    // 从请求中获取组织 ID 和项目 ID
    const organizationId = request.params?.organizationId || request.body?.organizationId
    const projectId = request.params?.projectId || request.body?.projectId

    // 检查权限
    const hasPermission = await this.rbacService.can(
      user.id,
      requiredAbility.action,
      requiredAbility.subject,
      organizationId,
      projectId,
    )

    if (!hasPermission) {
      this.logger.warn(
        {
          userId: user.id,
          action: requiredAbility.action,
          subject: requiredAbility.subject,
          organizationId,
          projectId,
        },
        'Permission denied',
      )
    }

    return hasPermission
  }
}
