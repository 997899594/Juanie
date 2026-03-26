import { extractPrNumberFromRef } from '@/lib/environments/preview';
import type { GitReviewRequest } from '@/lib/git';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

export interface PreviewReviewMetadata extends GitReviewRequest {}

export interface PreviewReviewMetadataProjectLike {
  id: string;
  teamId: string;
  repository?: {
    fullName: string;
    providerId: string;
  } | null;
}

export interface PreviewReviewMetadataItemLike {
  id: string;
  projectId: string;
  sourceRef?: string | null;
  environment?: {
    previewPrNumber?: number | null;
  } | null;
}

function getPreviewReviewNumber(item: PreviewReviewMetadataItemLike): number | null {
  return (
    item.environment?.previewPrNumber ??
    (item.sourceRef ? extractPrNumberFromRef(item.sourceRef) : null)
  );
}

export async function buildPreviewReviewMetadataByItemId<
  TProject extends PreviewReviewMetadataProjectLike,
  TItem extends PreviewReviewMetadataItemLike,
>(input: { projects: TProject[]; items: TItem[] }): Promise<Map<string, PreviewReviewMetadata>> {
  const projectsById = new Map(input.projects.map((project) => [project.id, project]));
  const numbersByProjectId = new Map<string, Set<number>>();

  for (const item of input.items) {
    const number = getPreviewReviewNumber(item);
    const project = projectsById.get(item.projectId);
    if (!project?.repository || number === null) {
      continue;
    }

    const bucket = numbersByProjectId.get(item.projectId) ?? new Set<number>();
    bucket.add(number);
    numbersByProjectId.set(item.projectId, bucket);
  }

  const metadataByProjectAndNumber = new Map<string, PreviewReviewMetadata>();

  await Promise.all(
    [...numbersByProjectId.entries()].map(async ([projectId, numbers]) => {
      const project = projectsById.get(projectId);
      if (!project?.repository) {
        return;
      }

      try {
        const session = await getTeamIntegrationSession({
          integrationId: project.repository.providerId,
          teamId: project.teamId,
          requiredCapabilities: [],
        });

        await Promise.all(
          [...numbers].map(async (number) => {
            const reviewRequest = await gateway.getReviewRequest(
              session,
              project.repository!.fullName,
              number
            );
            if (reviewRequest) {
              metadataByProjectAndNumber.set(`${projectId}:${number}`, reviewRequest);
            }
          })
        );
      } catch {
        // Provider metadata is best-effort; missing auth should not break preview surfaces.
      }
    })
  );

  const metadataByItemId = new Map<string, PreviewReviewMetadata>();

  for (const item of input.items) {
    const number = getPreviewReviewNumber(item);
    if (number === null) {
      continue;
    }

    const metadata = metadataByProjectAndNumber.get(`${item.projectId}:${number}`);
    if (metadata) {
      metadataByItemId.set(item.id, metadata);
    }
  }

  return metadataByItemId;
}
