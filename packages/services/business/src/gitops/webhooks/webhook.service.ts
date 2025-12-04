import * as crypto from 'node:crypto'
import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WebhookEventProcessor } from './webhook-event-processor.service'

/**
 * Webhook 处理服务
 *
 * 负责验证和处理来自 Git 平台的 webhook 事件
 * 确保事件的真实性和完整性
 *
 * Requirements: 5.1, 5.2, 5.3
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly eventProcessor: WebhookEventProcessor,
  ) {}

  /**
   * 验证 GitHub Webhook 签名
   *
   * GitHub 使用 HMAC-SHA256 签名验证 webhook 的真实性
   * 签名格式: sha256=<signature>
   *
   * Requirements: 5.1
   */
  async verifyGitHubSignature(payload: any, signature: string): Promise<boolean> {
    try {
      const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET')
      if (!secret) {
        this.logger.error('GitHub webhook secret not configured')
        return false
      }

      // 移除 'sha256=' 前缀
      const receivedSignature = signature.replace('sha256=', '')

      // 计算期望的签名
      const payloadString = JSON.stringify(payload)
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString, 'utf8')
        .digest('hex')

      // 使用时间安全的比较
      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      )

      if (!isValid) {
        this.logger.warn('GitHub webhook signature verification failed', {
          received: `${receivedSignature.substring(0, 8)}...`,
          expected: `${expectedSignature.substring(0, 8)}...`,
        })
      }

      return isValid
    } catch (error) {
      this.logger.error('Error verifying GitHub signature:', error)
      return false
    }
  }

  /**
   * 验证 GitLab Webhook Token
   *
   * GitLab 使用简单的 token 验证
   *
   * Requirements: 5.2
   */
  async verifyGitLabToken(token: string): Promise<boolean> {
    try {
      const expectedToken = this.config.get<string>('GITLAB_WEBHOOK_TOKEN')
      if (!expectedToken) {
        this.logger.error('GitLab webhook token not configured')
        return false
      }

      // 使用时间安全的比较
      const isValid = crypto.timingSafeEqual(
        Buffer.from(token, 'utf8'),
        Buffer.from(expectedToken, 'utf8'),
      )

      if (!isValid) {
        this.logger.warn('GitLab webhook token verification failed')
      }

      return isValid
    } catch (error) {
      this.logger.error('Error verifying GitLab token:', error)
      return false
    }
  }

  /**
   * 处理 GitHub Webhook 事件
   *
   * 支持的事件类型:
   * - repository: 仓库变更
   * - collaborator: 协作者变更
   * - member: 成员变更
   * - push: 代码推送
   *
   * Requirements: 5.1
   */
  async processGitHubEvent(payload: any, eventType: string): Promise<void> {
    try {
      const action = payload.action || 'unknown'
      const eventName = this.extractGitHubEventName(payload, eventType)

      this.logger.log(`Processing GitHub ${eventName} event: ${action}`, {
        eventName,
        eventType,
        action,
        sender: payload.sender?.login,
        organization: payload.organization?.login,
        repository: payload.repository?.name,
      })

      // 委托给事件处理器
      await this.eventProcessor.processGitHubEvent({
        eventName,
        eventType: action,
        payload,
        timestamp: new Date(),
      })

      this.logger.log(`Successfully processed GitHub ${eventName} event`)
    } catch (error) {
      this.logger.error('Error processing GitHub event:', error)
      throw error
    }
  }

  /**
   * 处理 GitLab Webhook 事件
   *
   * 支持的事件类型:
   * - project: 项目变更
   * - group: 组织变更
   * - group_member: 成员变更
   * - push: 代码推送
   *
   * Requirements: 5.2
   */
  async processGitLabEvent(payload: any): Promise<void> {
    try {
      const eventType = payload.event_type || payload.object_kind || 'unknown'
      const eventName = this.extractGitLabEventName(payload)

      this.logger.log(`Processing GitLab ${eventName} event: ${eventType}`, {
        eventName,
        eventType,
        user: payload.user?.name,
        group: payload.group?.name,
        project: payload.project?.name,
      })

      // 委托给事件处理器
      await this.eventProcessor.processGitLabEvent({
        eventName,
        eventType,
        payload,
        timestamp: new Date(),
      })

      this.logger.log(`Successfully processed GitLab ${eventName} event`)
    } catch (error) {
      this.logger.error('Error processing GitLab event:', error)
      throw error
    }
  }

  /**
   * 从 GitHub payload 中提取事件名称
   */
  private extractGitHubEventName(payload: any, eventType: string): string {
    // 使用 GitHub 的事件类型头
    if (eventType) {
      return eventType
    }

    // 回退到 payload 分析
    if (payload.organization) return 'organization'
    if (payload.member || payload.membership) return 'member'
    if (payload.collaborator) return 'collaborator'
    if (payload.repository && payload.commits) return 'push'
    if (payload.repository) return 'repository'
    return 'unknown'
  }

  /**
   * 从 GitLab payload 中提取事件名称
   */
  private extractGitLabEventName(payload: any): string {
    const objectKind = payload.object_kind
    switch (objectKind) {
      case 'group':
        return 'group'
      case 'group_member':
        return 'group_member'
      case 'project':
        return 'project'
      case 'push':
        return 'push'
      default:
        return objectKind || 'unknown'
    }
  }
}
