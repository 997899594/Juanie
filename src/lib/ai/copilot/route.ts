import { NextResponse } from 'next/server';
import { createCopilotStreamResponse, recordCopilotAskAudit } from '@/lib/ai/copilot/http';
import {
  type CopilotMessage,
  type CopilotStreamReply,
  copilotRequestSchema,
} from '@/lib/ai/copilot/service';
import { toAIRouteErrorResponse } from '@/lib/ai/http/route-response';
import type { AuditAction, ResourceType } from '@/lib/audit';

interface CopilotRouteScope {
  teamId: string;
  userId: string;
  projectId: string;
  resourceId: string;
  resourceType: ResourceType;
  action: AuditAction;
  environmentId?: string;
}

export async function handleCopilotRoute<TScope extends CopilotRouteScope>(input: {
  request: Request;
  loadScope: () => Promise<TScope>;
  generateReply: (scope: TScope, messages: CopilotMessage[]) => Promise<CopilotStreamReply>;
  fallbackMessage?: string;
}): Promise<Response> {
  try {
    const scope = await input.loadScope();
    const body = await input.request.json().catch(() => null);
    const parsed = copilotRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Copilot 请求格式不正确' }, { status: 400 });
    }

    const reply = await input.generateReply(scope, parsed.data.messages);

    await recordCopilotAskAudit({
      teamId: scope.teamId,
      userId: scope.userId,
      action: scope.action,
      resourceType: scope.resourceType,
      resourceId: scope.resourceId,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      messageCount: parsed.data.messages.length,
      reply,
    });

    return createCopilotStreamResponse(reply);
  } catch (error) {
    return toAIRouteErrorResponse(error, input.fallbackMessage ?? 'Copilot 暂时不可用');
  }
}
