import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { resolveReleaseAIPlugin } from '@/lib/ai/runtime/release-plugin-service';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';

export async function handleReleaseAnalysisRequest<TOutput>(input: {
  userId: string;
  projectId: string;
  releaseId: string;
  pluginId: string;
  forceRefresh: boolean;
  notFoundMessage: string;
  forbiddenMessage: string;
}): Promise<NextResponse> {
  const result = await resolveReleaseAIPlugin<TOutput>({
    userId: input.userId,
    projectId: input.projectId,
    releaseId: input.releaseId,
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
    const release = await db.query.releases.findFirst({
      where: eq(releases.id, input.releaseId),
      with: {
        project: {
          columns: {
            teamId: true,
          },
        },
      },
    });

    if (release) {
      await createAuditLog({
        teamId: release.project.teamId,
        userId: input.userId,
        action: 'release.ai_analysis_refreshed',
        resourceType: 'release',
        resourceId: input.releaseId,
        metadata: {
          pluginId: input.pluginId,
          projectId: input.projectId,
        },
      });
    }
  }

  return NextResponse.json(result.payload);
}
