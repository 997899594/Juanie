import type { AIMessage } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

/**
 * 敏感信息类型
 */
export enum SensitiveInfoType {
  API_KEY = 'api_key',
  PASSWORD = 'password',
  EMAIL = 'email',
  PHONE = 'phone',
  CREDIT_CARD = 'credit_card',
  IP_ADDRESS = 'ip_address',
  PRIVATE_KEY = 'private_key',
}

/**
 * 敏感信息检测结果
 */
export interface SensitiveInfo {
  type: SensitiveInfoType
  value: string
  position: { start: number; end: number }
}

/**
 * 内容过滤规则
 */
export interface FilterRule {
  id: string
  name: string
  pattern: RegExp
  action: 'block' | 'mask' | 'warn'
  enabled: boolean
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  userId: string
  projectId?: string
  action: string
  input: string
  output?: string
  filtered: boolean
  sensitiveInfo: SensitiveInfo[]
  timestamp: Date
}

/**
 * 内容过滤服务
 *
 * 负责检测和过滤敏感信息,管理过滤规则,记录审计日志
 */
@Injectable()
export class ContentFilterService {
  private rules: Map<string, FilterRule> = new Map()

  // 预定义的敏感信息检测模式
  private readonly patterns: Record<SensitiveInfoType, RegExp> = {
    [SensitiveInfoType.API_KEY]:
      /(?:api[_-]?key|apikey|access[_-]?token)["\s:=]+([a-zA-Z0-9_-]{20,})/gi,
    [SensitiveInfoType.PASSWORD]: /(?:password|passwd|pwd)["\s:=]+([^\s"']{8,})/gi,
    [SensitiveInfoType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    [SensitiveInfoType.PHONE]: /(?:\+?86)?1[3-9]\d{9}/g,
    [SensitiveInfoType.CREDIT_CARD]: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    [SensitiveInfoType.IP_ADDRESS]: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    [SensitiveInfoType.PRIVATE_KEY]:
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
  }

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ContentFilterService.name)
    this.initializeDefaultRules()
  }

  /**
   * 初始化默认过滤规则
   */
  private initializeDefaultRules(): void {
    // API 密钥规则
    this.addRule({
      id: 'api-key-block',
      name: 'Block API Keys',
      pattern: this.patterns[SensitiveInfoType.API_KEY],
      action: 'block',
      enabled: true,
    })

    // 密码规则
    this.addRule({
      id: 'password-block',
      name: 'Block Passwords',
      pattern: this.patterns[SensitiveInfoType.PASSWORD],
      action: 'block',
      enabled: true,
    })

    // 私钥规则
    this.addRule({
      id: 'private-key-block',
      name: 'Block Private Keys',
      pattern: this.patterns[SensitiveInfoType.PRIVATE_KEY],
      action: 'block',
      enabled: true,
    })

    // 邮箱规则 (mask)
    this.addRule({
      id: 'email-mask',
      name: 'Mask Email Addresses',
      pattern: this.patterns[SensitiveInfoType.EMAIL],
      action: 'mask',
      enabled: true,
    })

    // 信用卡规则
    this.addRule({
      id: 'credit-card-block',
      name: 'Block Credit Card Numbers',
      pattern: this.patterns[SensitiveInfoType.CREDIT_CARD],
      action: 'block',
      enabled: true,
    })
  }

  /**
   * 检测文本中的敏感信息
   */
  detectSensitiveInfo(text: string): SensitiveInfo[] {
    const results: SensitiveInfo[] = []

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          results.push({
            type: type as SensitiveInfoType,
            value: match[0],
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
          })
        }
      }
    }

    return results
  }

  /**
   * 过滤消息列表
   *
   * @throws {Error} 如果检测到需要阻止的敏感信息
   */
  async filterMessages(messages: AIMessage[]): Promise<AIMessage[]> {
    const filtered: AIMessage[] = []

    for (const message of messages) {
      const sensitiveInfo = this.detectSensitiveInfo(message.content)

      // 检查是否有需要阻止的敏感信息
      const blockingInfo = sensitiveInfo.filter((info) => {
        const rule = this.findRuleForType(info.type)
        return rule?.enabled && rule.action === 'block'
      })

      if (blockingInfo.length > 0) {
        const types = blockingInfo.map((info) => info.type).join(', ')
        throw ErrorFactory.ai.inferenceFailed(
          `Content contains sensitive information that must be blocked: ${types}`,
        )
      }

      // 应用 mask 规则
      let content = message.content
      for (const info of sensitiveInfo) {
        const rule = this.findRuleForType(info.type)
        if (rule?.enabled && rule.action === 'mask') {
          content = this.maskSensitiveInfo(content, info)
        }
      }

      filtered.push({
        ...message,
        content,
      })
    }

    return filtered
  }

  /**
   * 掩码敏感信息
   */
  private maskSensitiveInfo(text: string, info: SensitiveInfo): string {
    const before = text.substring(0, info.position.start)
    const after = text.substring(info.position.end)
    const masked = this.getMaskedValue(info)
    return before + masked + after
  }

  /**
   * 获取掩码后的值
   */
  private getMaskedValue(info: SensitiveInfo): string {
    switch (info.type) {
      case SensitiveInfoType.EMAIL: {
        const [local, domain] = info.value.split('@')
        if (!local || !domain) return '***@***'
        const maskedLocal = `${local.charAt(0)}***${local.charAt(local.length - 1)}`
        return `${maskedLocal}@${domain}`
      }
      case SensitiveInfoType.PHONE: {
        return `${info.value.substring(0, 3)}****${info.value.substring(7)}`
      }
      case SensitiveInfoType.CREDIT_CARD: {
        return `****-****-****-${info.value.slice(-4)}`
      }
      default:
        return '[REDACTED]'
    }
  }

  /**
   * 查找适用于特定类型的规则
   */
  private findRuleForType(type: SensitiveInfoType): FilterRule | undefined {
    for (const rule of this.rules.values()) {
      // 检查规则的模式是否匹配该类型
      if (rule.pattern === this.patterns[type]) {
        return rule
      }
    }
    return undefined
  }

  /**
   * 添加过滤规则
   */
  addRule(rule: FilterRule): void {
    this.rules.set(rule.id, rule)
  }

  /**
   * 移除过滤规则
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId)
  }

  /**
   * 获取所有规则
   */
  getRules(): FilterRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = enabled
      return true
    }
    return false
  }

  /**
   * 记录审计日志
   *
   * 注意: 这里简化处理,实际应该写入专门的审计日志表
   */
  async logInteraction(entry: AuditLogEntry): Promise<void> {
    try {
      // TODO: 实现审计日志持久化
      // 可以写入专门的审计日志表或发送到日志收集系统
      this.logger.info('Audit log', {
        userId: entry.userId,
        projectId: entry.projectId,
        action: entry.action,
        filtered: entry.filtered,
        sensitiveInfoCount: entry.sensitiveInfo.length,
        timestamp: entry.timestamp,
      })
    } catch (error) {
      // 审计日志失败不应该影响主流程
      this.logger.warn('Failed to log audit entry', { error })
    }
  }

  /**
   * 检查并告警敏感信息
   *
   * @returns true 如果检测到敏感信息
   */
  async checkAndAlert(
    text: string,
    context: { userId: string; projectId?: string },
  ): Promise<boolean> {
    const sensitiveInfo = this.detectSensitiveInfo(text)

    if (sensitiveInfo.length > 0) {
      // 记录审计日志
      await this.logInteraction({
        userId: context.userId,
        projectId: context.projectId,
        action: 'sensitive_info_detected',
        input: text,
        filtered: true,
        sensitiveInfo,
        timestamp: new Date(),
      })

      // TODO: 发送告警通知
      // 可以通过事件系统发送告警
      this.logger.warn('Security alert: sensitive info detected', {
        userId: context.userId,
        projectId: context.projectId,
        sensitiveInfoTypes: sensitiveInfo.map((info) => info.type),
        count: sensitiveInfo.length,
      })

      return true
    }

    return false
  }
}
