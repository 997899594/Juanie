import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { DATABASE } from '@/database/database.module'
import * as schema from '@/database/schemas'

@Injectable()
export class CostTrackingService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 记录成本数据
  async record(
    userId: string,
    data: {
      organizationId: string
      projectId?: string
      date: string
      costs: {
        compute: number
        storage: number
        network: number
        database: number
        total: number
      }
      currency?: string
    },
  ) {
    // 检查权限
    const hasPermission = await this.checkOrgPermission(userId, data.organizationId)
    if (!hasPermission) {
      throw new Error('没有权限记录成本数据')
    }

    // 使用 upsert 逻辑：如果记录存在则更新，否则插入
    const [existing] = await this.db
      .select()
      .from(schema.costTracking)
      .where(
        and(
          eq(schema.costTracking.organizationId, data.organizationId),
          eq(schema.costTracking.date, data.date),
          data.projectId
            ? eq(schema.costTracking.projectId, data.projectId)
            : sql`${schema.costTracking.projectId} IS NULL`,
        ),
      )
      .limit(1)

    if (existing) {
      const [updated] = await this.db
        .update(schema.costTracking)
        .set({
          costs: data.costs,
          currency: data.currency || 'USD',
        })
        .where(eq(schema.costTracking.id, existing.id))
        .returning()
      return updated
    }

    const [cost] = await this.db
      .insert(schema.costTracking)
      .values({
        organizationId: data.organizationId,
        projectId: data.projectId,
        date: data.date,
        costs: data.costs,
        currency: data.currency || 'USD',
      })
      .returning()

    return cost
  }

  // 列出成本记录
  async list(
    userId: string,
    filters: {
      organizationId: string
      projectId?: string
      startDate?: string
      endDate?: string
    },
  ) {
    const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
    if (!hasAccess) {
      throw new Error('没有权限访问该组织')
    }

    const conditions = [eq(schema.costTracking.organizationId, filters.organizationId)]

    if (filters.projectId) {
      conditions.push(eq(schema.costTracking.projectId, filters.projectId))
    }

    if (filters.startDate) {
      conditions.push(gte(schema.costTracking.date, filters.startDate))
    }

    if (filters.endDate) {
      conditions.push(lte(schema.costTracking.date, filters.endDate))
    }

    const costs = await this.db
      .select()
      .from(schema.costTracking)
      .where(and(...conditions))
      .orderBy(desc(schema.costTracking.date))
      .limit(100)

    return costs
  }

  // 获取成本汇总
  async getSummary(
    userId: string,
    filters: {
      organizationId: string
      projectId?: string
      startDate?: string
      endDate?: string
    },
  ) {
    const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
    if (!hasAccess) {
      throw new Error('没有权限访问该组织')
    }

    const conditions = [eq(schema.costTracking.organizationId, filters.organizationId)]

    if (filters.projectId) {
      conditions.push(eq(schema.costTracking.projectId, filters.projectId))
    }

    if (filters.startDate) {
      conditions.push(gte(schema.costTracking.date, filters.startDate))
    }

    if (filters.endDate) {
      conditions.push(lte(schema.costTracking.date, filters.endDate))
    }

    const costs = await this.db
      .select()
      .from(schema.costTracking)
      .where(and(...conditions))

    // 计算汇总
    const summary = {
      totalCompute: 0,
      totalStorage: 0,
      totalNetwork: 0,
      totalDatabase: 0,
      grandTotal: 0,
      currency: 'USD',
      recordCount: costs.length,
    }

    for (const cost of costs) {
      if (cost.costs) {
        summary.totalCompute += cost.costs.compute || 0
        summary.totalStorage += cost.costs.storage || 0
        summary.totalNetwork += cost.costs.network || 0
        summary.totalDatabase += cost.costs.database || 0
        summary.grandTotal += cost.costs.total || 0
      }
      if (cost.currency) {
        summary.currency = cost.currency
      }
    }

    return summary
  }

  // 检查成本告警
  async checkAlerts(organizationId: string) {
    // 获取组织配置
    const [org] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1)

    if (!org) {
      return []
    }

    // 获取当月成本
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const startDate = `${currentMonth}-01`
    const endDate = `${currentMonth}-31`

    const costs = await this.db
      .select()
      .from(schema.costTracking)
      .where(
        and(
          eq(schema.costTracking.organizationId, organizationId),
          gte(schema.costTracking.date, startDate),
          lte(schema.costTracking.date, endDate),
        ),
      )

    let monthlyTotal = 0
    for (const cost of costs) {
      if (cost.costs) {
        monthlyTotal += cost.costs.total || 0
      }
    }

    const alerts = []

    // 假设预算为 1000 USD（实际应该从组织配置中读取）
    const budget = 1000
    const threshold = budget * 0.9

    if (monthlyTotal >= threshold) {
      alerts.push({
        type: 'cost_alert',
        severity: monthlyTotal >= budget ? 'high' : 'medium',
        message: `当月成本 ${monthlyTotal} USD 已达到预算的 ${Math.round((monthlyTotal / budget) * 100)}%`,
        currentCost: monthlyTotal,
        budget,
      })
    }

    return alerts
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

    return member && ['owner', 'admin'].includes(member.role)
  }
}
