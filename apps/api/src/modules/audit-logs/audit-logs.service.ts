import * as schema from '@juanie/core-database/schemas'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { DATABASE } from '@/database/database.module'

@Injectable()
export class AuditLogsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 记录审计日志
  async log(data: {
    userId?: string
    organizationId?: string
    action: string
    resourceType?: string
    resourceId?: string
    metadata?: Record<string, any>
    ipAddress?: string
    userAgent?: string
    violationSeverity?: 'low' | 'medium' | 'high' | 'critical'
  }) {
    const [log] = await this.db
      .insert(schema.auditLogs)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        violationSeverity: data.violationSeverity,
      })
      .returning()

    return log
  }

  // 列出审计日志
  async list(
    userId: string,
    filters: {
      organizationId?: string
      action?: string
      resourceType?: string
      startDate?: string
      endDate?: string
    },
  ) {
    const conditions = []

    if (filters.organizationId) {
      const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
      if (!hasAccess) {
        throw new Error('没有权限访问该组织')
      }
      conditions.push(eq(schema.auditLogs.organizationId, filters.organizationId))
    }

    if (filters.action) {
      conditions.push(eq(schema.auditLogs.action, filters.action))
    }

    if (filters.resourceType) {
      conditions.push(eq(schema.auditLogs.resourceType, filters.resourceType))
    }

    if (filters.startDate) {
      conditions.push(gte(schema.auditLogs.createdAt, new Date(filters.startDate)))
    }

    if (filters.endDate) {
      conditions.push(lte(schema.auditLogs.createdAt, new Date(filters.endDate)))
    }

    const logs = await this.db
      .select()
      .from(schema.auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100)

    return logs
  }

  // 搜索审计日志
  async search(
    userId: string,
    filters: {
      organizationId: string
      query?: string
      action?: string
      resourceType?: string
      startDate?: string
      endDate?: string
    },
  ) {
    const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
    if (!hasAccess) {
      throw new Error('没有权限访问该组织')
    }

    // 简化实现：使用 list 方法
    return await this.list(userId, filters)
  }

  // 导出审计日志
  async export(
    userId: string,
    filters: {
      organizationId: string
      startDate?: string
      endDate?: string
      format: 'csv' | 'json'
    },
  ) {
    const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
    if (!hasAccess) {
      throw new Error('没有权限访问该组织')
    }

    const logs = await this.list(userId, {
      organizationId: filters.organizationId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    })

    if (filters.format === 'json') {
      return {
        format: 'json',
        data: JSON.stringify(logs, null, 2),
      }
    }

    // CSV 格式
    const headers = [
      'ID',
      'User ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'Created At',
    ]
    const rows = logs.map((log) => [
      log.id,
      log.userId || '',
      log.action,
      log.resourceType || '',
      log.resourceId || '',
      log.ipAddress || '',
      log.createdAt.toISOString(),
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    return {
      format: 'csv',
      data: csv,
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
}
