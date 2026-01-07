import { Body, Controller, Headers, Post, Res } from '@nestjs/common'
import { pipeTextStreamToResponse } from 'ai'
import type { FastifyReply } from 'fastify'
import { ChatRequestDto } from '../dto/chat-request.dto'
import { AiChatService } from '../services/ai-chat.service'

@Controller('api/ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  /**
   * POST /api/ai/chat
   * Stream AI chat responses with tool calling support
   * Uses AI SDK's Text Stream Protocol for compatibility with @ai-sdk/vue
   */
  @Post('chat')
  async chat(
    @Body() request: ChatRequestDto,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Res() res: FastifyReply,
  ) {
    // Extract tenant ID from header or use default
    const enrichedRequest = {
      ...request,
      tenantId: tenantId || request.tenantId || 'default',
    }

    console.log(`📨 Chat request from tenant: ${enrichedRequest.tenantId}`)

    // Get streaming result from AI Chat Service
    const result = await this.aiChatService.chat(enrichedRequest)

    // Use AI SDK's pipeTextStreamToResponse for proper streaming format
    // This automatically handles:
    // - Text Stream Protocol format
    // - Tool calls serialization
    // - Metadata and usage information
    // - Error handling
    pipeTextStreamToResponse(result, res.raw)
  }
}
