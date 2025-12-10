import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PermissionDeniedError } from '../../errors'
import { CaslAbilityFactory } from './casl-ability.factory'
import { CHECK_ABILITY_KEY, type RequiredRule } from './decorators'

/**
 * CASL 权限守卫
 *
 * 自动检查路由上的权限要求
 */
@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules =
      this.reflector.get<RequiredRule[]>(CHECK_ABILITY_KEY, context.getHandler()) ||
      this.reflector.get<RequiredRule[]>(CHECK_ABILITY_KEY, context.getClass())

    if (!rules || rules.length === 0) {
      return true // 没有权限要求，允许访问
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      throw new PermissionDeniedError('User', 'authenticate')
    }

    // 获取组织 ID（从请求参数或 body 中）
    const organizationId = request.params?.organizationId || request.body?.organizationId

    // 创建权限对象
    const ability = await this.caslAbilityFactory.createForUser(user.id, organizationId)

    // 检查所有权限要求
    for (const rule of rules) {
      const { action, subject, conditions } = rule

      if (!ability.can(action as any, subject as any, conditions)) {
        throw new PermissionDeniedError(subject, action)
      }
    }

    return true
  }
}
