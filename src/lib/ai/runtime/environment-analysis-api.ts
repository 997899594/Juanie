import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { resolveEnvironmentAIPlugin } from '@/lib/ai/runtime/environment-plugin-service';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';

export async function handleEnvironmentAnalysisRequest<TOutput>(input: {
  userId: string;
  projectId: string;
  environmentId: string;
  pluginId: string;
  forceRefresh: boolean;
  notFoundMessage: string;
  forbiddenMessage: string;
}): Promise<NextResponse> {
  const result = await resolveEnvironmentAIPlugin<TOutput>({
    userId: input.userId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    pluginId: input.pluginId,
    forceRefresh: input.forceRefresh,
  });

  if (result.status === 'not_found') {
    return NextResponse.json({ error: input.notFoundMessage }, { status: 404 });
  }

  if (result.status === 'forbidden') {
    return NextResponse.json({ error: input.forbiddenMessage }, { status: 403 });
  }

  if (input.forceRefresh) {
    const environment = await db.query.environments.findFirst({
      where: eq(environments.id, input.environmentId),
      with: {
        project: {
          columns: {
            teamId: true,
          },
        },
      },
    });

    if (environment) {
      await createAuditLog({
        teamId: environment.project.teamId,
        userId: input.userId,
        action: 'environment.ai_summary_refreshed',
        resourceType: 'environment',
        resourceId: input.environmentId,
        metadata: {
          pluginId: input.pluginId,
          projectId: input.projectId,
        },
      });
    }
  }

  return NextResponse.json(result.payload);
}
