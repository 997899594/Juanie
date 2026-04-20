'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectRealtimeEvent } from '@/lib/realtime/projects';

interface UseProjectsRealtimeOptions {
  projectIds: string[];
  onEvent?: (event: ProjectRealtimeEvent) => void;
}

export function useProjectsRealtime({ projectIds, onEvent }: UseProjectsRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamToken, setStreamToken] = useState(0);
  const onEventRef = useRef(onEvent);
  const reconnectTimerRef = useRef<number | null>(null);
  const projectIdsKey = [...new Set(projectIds.filter(Boolean))].sort().join(',');

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!projectIdsKey) {
      setIsConnected(false);
      setError(null);
      return;
    }

    let closed = false;
    const eventSource = new EventSource(
      `/api/events/projects?projectIds=${encodeURIComponent(projectIdsKey)}&token=${streamToken}`
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
        if (data.type === 'project') {
          onEventRef.current?.(data.data as ProjectRealtimeEvent);
        }
      } catch (err) {
        console.error('Failed to parse project SSE message:', err);
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
  }, [projectIdsKey, streamToken]);

  return {
    isConnected,
    error,
  };
}
