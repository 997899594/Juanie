import type { CopilotStreamReply } from '@/lib/ai/copilot/service';
import { createCopilotEventStream } from '@/lib/ai/copilot/transport';
import { buildAIRunMetadata, buildRequiredAIRunMetadata } from '@/lib/ai/run-metadata';
import type { AuditAction, ResourceType } from '@/lib/audit';
import { createAuditLog } from '@/lib/audit';

export function createCopilotStreamResponse(reply: CopilotStreamReply): Response {
  return new Response(
    createCopilotEventStream({
      metadata: {
        conversationId: reply.conversationId,
        generatedAt: reply.generatedAt,
        suggestions: reply.suggestions,
        ...buildRequiredAIRunMetadata(reply),
      },
      textStream: reply.stream,
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Connection: 'keep-alive',
      },
    }
  );
}

export function buildCopilotAuditMetadata(input: {
  projectId: string;
  messageCount: number;
  reply: CopilotStreamReply;
  environmentId?: string;
}): Record<string, unknown> {
  return {
    projectId: input.projectId,
    environmentId: input.environmentId,
    messageCount: input.messageCount,
    conversationId: input.reply.conversationId,
    ...buildAIRunMetadata(input.reply),
  };
}

export async function recordCopilotAskAudit(input: {
  teamId: string;
  userId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  projectId: string;
  messageCount: number;
  reply: CopilotStreamReply;
  environmentId?: string;
}): Promise<void> {
  await createAuditLog({
    teamId: input.teamId,
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: buildCopilotAuditMetadata({
      projectId: input.projectId,
      environmentId: input.environmentId,
      messageCount: input.messageCount,
      reply: input.reply,
    }),
  }).catch(() => undefined);
}
