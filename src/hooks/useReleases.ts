'use client';

import { useEffect, useRef, useState } from 'react';

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

export function buildReleaseEventStateKey(
  release?: {
    id: string;
    status: string;
    sourceCommitSha: string | null;
    updatedAt: string | Date;
    recap?: {
      generatedAt?: string | null;
    } | null;
  } | null
): string | null {
  if (!release) {
    return null;
  }

  return [
    release.id,
    release.status,
    release.sourceCommitSha ?? '',
    release.updatedAt,
    release.recap?.generatedAt ?? '',
  ].join(':');
}

interface UseReleasesOptions {
  projectId: string;
  onRelease?: (release: ReleaseEventRecord) => void;
  initialStateKey?: string | null;
}

export function useReleases({ projectId, onRelease, initialStateKey }: UseReleasesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onReleaseRef = useRef(onRelease);
  const lastStateRef = useRef<string | null>(initialStateKey ?? null);

  useEffect(() => {
    onReleaseRef.current = onRelease;
  });

  useEffect(() => {
    lastStateRef.current = initialStateKey ?? null;
  }, [initialStateKey]);

  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(`/api/events/releases?projectId=${projectId}`);

    eventSource.onopen = () => {
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
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [projectId]);

  return {
    isConnected,
    error,
  };
}
