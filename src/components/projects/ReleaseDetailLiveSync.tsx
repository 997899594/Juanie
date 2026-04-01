'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';
import { isActiveReleaseStatus } from '@/lib/releases/state-machine';

interface ReleaseDetailLiveSyncProps {
  projectId: string;
  releaseId: string;
  initialStatus: string;
  initialStateKey: string | null;
}

export function ReleaseDetailLiveSync({
  projectId,
  releaseId,
  initialStatus,
  initialStateKey,
}: ReleaseDetailLiveSyncProps) {
  const router = useRouter();
  const lastStateRef = useRef<string | null>(initialStateKey);

  useEffect(() => {
    lastStateRef.current = initialStateKey;
  }, [initialStateKey]);

  useEffect(() => {
    if (!projectId || !releaseId || !isActiveReleaseStatus(initialStatus)) {
      return;
    }

    const eventSource = new EventSource(
      `/api/events/releases?projectId=${projectId}&releaseId=${releaseId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          data?: {
            id: string;
            status: string;
            sourceCommitSha: string | null;
            updatedAt: string | Date;
            recap?: {
              generatedAt?: string | null;
            } | null;
          };
        };

        if (data.type !== 'release' || !data.data || data.data.id !== releaseId) {
          return;
        }

        const nextStateKey = buildReleaseEventStateKey(data.data);
        if (!nextStateKey || nextStateKey === lastStateRef.current) {
          return;
        }

        lastStateRef.current = nextStateKey;
        router.refresh();

        if (!isActiveReleaseStatus(data.data.status)) {
          eventSource.close();
        }
      } catch (error) {
        console.error('Failed to parse release detail SSE message:', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [initialStatus, projectId, releaseId, router]);

  return null;
}
