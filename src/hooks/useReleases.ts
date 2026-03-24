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
  environment: {
    id: string;
    name: string;
  };
  artifacts: ReleaseArtifact[];
}

interface UseReleasesOptions {
  projectId: string;
  onRelease?: (release: ReleaseEventRecord) => void;
}

export function useReleases({ projectId, onRelease }: UseReleasesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onReleaseRef = useRef(onRelease);

  useEffect(() => {
    onReleaseRef.current = onRelease;
  });

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
