'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReleaseEventStateKey } from '@/lib/releases/event-state';

interface ReleaseArtifact {
  id: string;
  imageUrl: string;
  service: {
    id: string;
    name: string;
  };
}

export interface ReleaseEventRecord {
  id: string;
  status: string;
  sourceCommitSha: string | null;
  sourceRef: string;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  recap: {
    generatedAt: string;
  } | null;
  environment: {
    id: string;
    name: string;
  };
  artifacts: ReleaseArtifact[];
}

interface UseReleasesOptions {
  projectId: string;
  onRelease?: (release: ReleaseEventRecord) => void;
  initialStateKey?: string | null;
}

export function useReleases({ projectId, onRelease, initialStateKey }: UseReleasesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamToken, setStreamToken] = useState(0);
  const onReleaseRef = useRef(onRelease);
  const lastStateRef = useRef<string | null>(initialStateKey ?? null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onReleaseRef.current = onRelease;
  });

  useEffect(() => {
    lastStateRef.current = initialStateKey ?? null;
  }, [initialStateKey]);

  useEffect(() => {
    if (!projectId) return;

    let closed = false;
    const eventSource = new EventSource(
      `/api/events/releases?projectId=${projectId}&token=${streamToken}`
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
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'release') {
          const nextStateKey = buildReleaseEventStateKey(data.data);
          if (!nextStateKey || nextStateKey === lastStateRef.current) {
            return;
          }

          lastStateRef.current = nextStateKey;
          onReleaseRef.current?.(data.data);
        }
      } catch (err) {
        console.error('Failed to parse release SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (closed) {
        return;
      }

      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
      scheduleReconnect();
    };

    return () => {
      closed = true;
      clearReconnectTimer();
      eventSource.close();
      setIsConnected(false);
    };
  }, [projectId, streamToken]);

  return {
    isConnected,
    error,
  };
}
