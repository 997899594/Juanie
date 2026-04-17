'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  const [streamToken, setStreamToken] = useState(0);
  const lastStateRef = useRef<string | null>(initialStateKey);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastStateRef.current = initialStateKey;
  }, [initialStateKey]);

  useEffect(() => {
    if (!projectId || !releaseId || !isActiveReleaseStatus(initialStatus)) {
      return;
    }

    let closed = false;
    const eventSource = new EventSource(
      `/api/events/releases?projectId=${projectId}&releaseId=${releaseId}&token=${streamToken}`
    );

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      clearReconnectTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        setStreamToken((value) => value + 1);
      }, 1500);
    };

    eventSource.onopen = () => {
      clearReconnectTimer();
    };

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
          clearReconnectTimer();
          eventSource.close();
        }
      } catch (error) {
        console.error('Failed to parse release detail SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (closed) {
        return;
      }

      scheduleReconnect();
    };

    return () => {
      closed = true;
      clearReconnectTimer();
      eventSource.close();
    };
  }, [initialStatus, projectId, releaseId, router, streamToken]);

  return null;
}
