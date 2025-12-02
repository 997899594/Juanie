import { Body, Controller, Headers, HttpException, HttpStatus, Post } from '@nestjs/common'
import { WebhookService } from './webhook.service'

/**
 * Git 平台 Webhook 控制器
 *
 * 处理来自 GitHub 和 GitLab 的 webhook 事件
 * 用于实时同步 Git 平台的变更到系统中
 *
 * Requirements: 5.1, 5.2, 5.3
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

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
  @Post('github')
  async handleGitHubWebhook(@Body() payload: any, @Headers() headers: Record<string, string>) {
    try {
      // 验证 GitHub 签名
      const signature = headers['x-hub-signature-256']
      if (!signature) {
        throw new HttpException('Missing GitHub signature header', HttpStatus.UNAUTHORIZED)
      }

      const isValid = await this.webhookService.verifyGitHubSignature(payload, signature)

      if (!isValid) {
        throw new HttpException('Invalid GitHub signature', HttpStatus.UNAUTHORIZED)
      }

      // 获取事件类型
      const eventType = headers['x-github-event']

      // 处理 webhook 事件
      await this.webhookService.processGitHubEvent(payload, eventType)

      return { success: true, message: 'GitHub webhook processed successfully' }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('Failed to process GitHub webhook', HttpStatus.INTERNAL_SERVER_ERROR)
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
  @Post('gitlab')
  async handleGitLabWebhook(@Body() payload: any, @Headers() headers: Record<string, string>) {
    try {
      // 验证 GitLab Token
      const token = headers['x-gitlab-token']
      if (!token) {
        throw new HttpException('Missing GitLab token header', HttpStatus.UNAUTHORIZED)
      }

      const isValid = await this.webhookService.verifyGitLabToken(token)

      if (!isValid) {
        throw new HttpException('Invalid GitLab token', HttpStatus.UNAUTHORIZED)
      }

      // 处理 webhook 事件
      await this.webhookService.processGitLabEvent(payload)

      return { success: true, message: 'GitLab webhook processed successfully' }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException('Failed to process GitLab webhook', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 健康检查端点
   * 用于验证 webhook 端点是否可用
   */
  @Post('health')
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'webhook-handler',
    }
  }
}
