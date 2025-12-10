import type { AppAbility } from '@juanie/core/rbac'
import { createAbility } from '@juanie/core/rbac'
import { type ComputedRef, computed } from 'vue'
import { useAuth } from './useAuth'

/**
 * 使用 CASL 权限系统
 *
 * @returns 权限对象和辅助方法
 */
export function useAbility(): {
  ability: ComputedRef<AppAbility | null>
  can: (action: string, subject: string) => boolean
} {
  const { user } = useAuth()

  const ability = computed(() => {
    if (!user.value) return null

    // 从用户数据中获取权限规则
    // 这些规则应该由后端在登录时返回
    const rules = (user.value as any).abilityRules || []

    return createAbility(rules)
  })

  const can = (action: string, subject: string): boolean => {
    if (!ability.value) return false
    return ability.value.can(action as any, subject as any)
  }

  return {
    ability,
    can,
  }
}
