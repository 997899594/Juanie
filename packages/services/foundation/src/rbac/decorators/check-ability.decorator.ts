/**
 * CheckAbility 装饰器
 *
 * 用于标记需要权限检查的路由和方法
 *
 * @packageDocumentation
 */

import type { Action, Subject } from '@juanie/types'
import { SetMetadata } from '@nestjs/common'

export const CHECK_ABILITY_KEY = 'check_ability'

export interface RequiredAbility {
  action: Action
  subject: Subject
}

/**
 * 检查权限装饰器
 *
 * @example
 * ```typescript
 * @CheckAbility({ action: 'update', subject: 'Project' })
 * async updateProject() {
 *   // ...
 * }
 * ```
 */
export const CheckAbility = (ability: RequiredAbility) => SetMetadata(CHECK_ABILITY_KEY, ability)
