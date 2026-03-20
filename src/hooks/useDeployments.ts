'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Deployment {
  id: string;
  status: string;
  version: string;
  commitSha: string;
  environmentName: string;
  serviceName?: string | null;
  createdAt: string;
}

interface UseDeploymentsOptions {
  projectId: string;
  onDeployment?: (deployment: Deployment) => void;
}

export function useDeployments({ projectId, onDeployment }: UseDeploymentsOptions) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref so the effect never needs to re-run when the callback changes
  const onDeploymentRef = useRef(onDeployment);
  useEffect(() => {
    onDeploymentRef.current = onDeployment;
  });

  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(`/api/events/deployments?projectId=${projectId}`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('SSE connected');
        } else if (data.type === 'deployment') {
          setDeployments((prev) => {
            const exists = prev.some((deployment) => deployment.id === data.data.id);
            if (!exists) {
              return [data.data, ...prev];
            }
            return prev.map((deployment) =>
              deployment.id === data.data.id ? { ...deployment, ...data.data } : deployment
            );
          });
          onDeploymentRef.current?.(data.data);
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
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

  const addDeployment = useCallback((deployment: Deployment) => {
    setDeployments((prev) => [deployment, ...prev]);
  }, []);

  return {
    deployments,
    isConnected,
    error,
    addDeployment,
  };
}
