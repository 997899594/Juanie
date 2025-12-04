import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, or } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class SecurityPoliciesService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 创建安全策略
  async create(
    userId: string,
    data: {
      organizationId?: string
      projectId?: string
      name: string
      type: 'access-control' | 'network' | 'data-protection' | 'compliance'
      rules: {
        conditions: Array<{ field: string; operator: string; value: unknown }>
        actions: Array<{ type: 'block' | 'warn' | 'log'; message: string }>
      }
      isEnforced?: boolean
    },
  ) {
    // 检查权限
    if (data.organizationId) {
      const hasPermission = await this.checkOrgPermission(userId, data.organizationId)
      if (!hasPermission) {
        throw new Error('没有权限创建组织级策略')
      }
    }

    if (data.projectId) {
      const hasPermission = await this.checkProjectPermission(userId, data.projectId)
      if (!hasPermission) {
        throw new Error('没有权限创建项目级策略')
      }
    }

    const [policy] = await this.db
      .insert(schema.securityPolicies)
      .values({
        organizationId: data.organizationId,
        projectId: data.projectId,
        name: data.name,
        type: data.type,
        rules: data.rules,
        isEnforced: data.isEnforced ?? false,
      })
      .returning()

    return policy
  }

  // 列出安全策略
  async list(
    userId: string,
    filters: {
      organizationId?: string
      projectId?: string
      type?: string
    },
  ) {
    const conditions = []

    if (filters.organizationId) {
      const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
      if (!hasAccess) {
        throw new Error('没有权限访问该组织')
      }
      conditions.push(eq(schema.securityPolicies.organizationId, filters.organizationId))
    }

    if (filters.projectId) {
      const hasAccess = await this.checkProjectAccess(userId, filters.projectId)
      if (!hasAccess) {
        throw new Error('没有权限访问该项目')
      }
      conditions.push(eq(schema.securityPolicies.projectId, filters.projectId))
    }

    if (filters.type) {
      conditions.push(eq(schema.securityPolicies.type, filters.type))
    }

    const policies = await this.db
      .select()
      .from(schema.securityPolicies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return policies
  }

  // 获取策略详情
  async get(userId: string, policyId: string) {
    const [policy] = await this.db
      .select()
      .from(schema.securityPolicies)
      .where(eq(schema.securityPolicies.id, policyId))
      .limit(1)

    if (!policy) {
      return null
    }

    // 检查访问权限
    if (policy.organizationId) {
      const hasAccess = await this.checkOrgAccess(userId, policy.organizationId)
      if (!hasAccess) {
        throw new Error('没有权限访问该策略')
      }
    }

    if (policy.projectId) {
      const hasAccess = await this.checkProjectAccess(userId, policy.projectId)
      if (!hasAccess) {
        throw new Error('没有权限访问该策略')
      }
    }

    return policy
  }

  // 更新策略
  async update(
    userId: string,
    policyId: string,
    data: {
      name?: string
      rules?: {
        conditions: Array<{ field: string; operator: string; value: any }>
        actions: Array<{ type: 'block' | 'warn' | 'log'; message: string }>
      }
      isEnforced?: boolean
    },
  ) {
    const policy = await this.get(userId, policyId)
    if (!policy) {
      throw new Error('策略不存在')
    }

    // 检查权限
    if (policy.organizationId) {
      const hasPermission = await this.checkOrgPermission(userId, policy.organizationId)
      if (!hasPermission) {
        throw new Error('没有权限更新该策略')
      }
    }

    if (policy.projectId) {
      const hasPermission = await this.checkProjectPermission(userId, policy.projectId)
      if (!hasPermission) {
        throw new Error('没有权限更新该策略')
      }
    }

    const [updated] = await this.db
      .update(schema.securityPolicies)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.securityPolicies.id, policyId))
      .returning()

    return updated
  }

  // 删除策略
  async delete(userId: string, policyId: string) {
    const policy = await this.get(userId, policyId)
    if (!policy) {
      throw new Error('策略不存在')
    }

    // 检查权限
    if (policy.organizationId) {
      const hasPermission = await this.checkOrgPermission(userId, policy.organizationId)
      if (!hasPermission) {
        throw new Error('没有权限删除该策略')
      }
    }

    if (policy.projectId) {
      const hasPermission = await this.checkProjectPermission(userId, policy.projectId)
      if (!hasPermission) {
        throw new Error('没有权限删除该策略')
      }
    }

    await this.db.delete(schema.securityPolicies).where(eq(schema.securityPolicies.id, policyId))

    return { success: true }
  }

  // 评估策略
  async evaluate(context: {
    organizationId?: string
    projectId?: string
    action: string
    resource: Record<string, unknown>
    user: Record<string, unknown>
  }) {
    // 获取适用的策略
    const conditions = []

    if (context.organizationId) {
      conditions.push(eq(schema.securityPolicies.organizationId, context.organizationId))
    }

    if (context.projectId) {
      conditions.push(eq(schema.securityPolicies.projectId, context.projectId))
    }

    const policies = await this.db
      .select()
      .from(schema.securityPolicies)
      .where(
        and(
          conditions.length > 0 ? or(...conditions) : undefined,
          eq(schema.securityPolicies.isEnforced, true),
        ),
      )

    const violations = []

    for (const policy of policies) {
      const result = this.evaluatePolicy(policy, context)
      if (result.violated) {
        violations.push({
          policyId: policy.id,
          policyName: policy.name,
          policyType: policy.type,
          actions: result.actions,
        })
      }
    }

    return {
      allowed: violations.every(
        (v) => !v.actions.some((a: { type: string }) => a.type === 'block'),
      ),
      violations,
    }
  }

  // 评估单个策略
  private evaluatePolicy(
    policy: any,
    context: {
      action: string
      resource: any
      user: any
    },
  ) {
    if (!policy.rules) {
      return { violated: false, actions: [] }
    }

    const { conditions, actions } = policy.rules

    // 检查所有条件
    let allConditionsMet = true
    for (const condition of conditions) {
      const value = this.getValueFromContext(condition.field, context)
      const conditionMet = this.evaluateCondition(value, condition.operator, condition.value)
      if (!conditionMet) {
        allConditionsMet = false
        break
      }
    }

    if (allConditionsMet) {
      return { violated: true, actions }
    }

    return { violated: false, actions: [] }
  }

  // 从上下文中获取值
  private getValueFromContext(field: string, context: Record<string, unknown>): unknown {
    const parts = field.split('.')
    let value: unknown = context
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }
    return value
  }

  // 评估条件
  private evaluateCondition(value: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return value === expected
      case 'not_equals':
        return value !== expected
      case 'contains':
        return String(value).includes(String(expected))
      case 'not_contains':
        return !String(value).includes(String(expected))
      case 'greater_than':
        return Number(value) > Number(expected)
      case 'less_than':
        return Number(value) < Number(expected)
      case 'in':
        return Array.isArray(expected) && expected.includes(value)
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(value)
      default:
        return false
    }
  }

  // 辅助方法：检查组织访问权限
  private async checkOrgAccess(userId: string, organizationId: string): Promise<boolean> {
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!member
  }

  // 辅助方法：检查组织权限
  private async checkOrgPermission(userId: string, organizationId: string): Promise<boolean> {
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!member && ['owner', 'admin'].includes(member.role)
  }

  // 辅助方法：检查项目访问权限
  private async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember) {
      return true
    }

    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!projectMember
  }

  // 辅助方法：检查项目权限
  private async checkProjectPermission(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember && ['owner', 'admin'].includes(orgMember.role)) {
      return true
    }

    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return projectMember?.role === 'admin'
  }
}
