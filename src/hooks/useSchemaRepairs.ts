'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildSchemaRepairRealtimeStateKey,
  type SchemaRepairRealtimeRecord,
} from '@/lib/schema-management/realtime';

interface UseSchemaRepairsOptions {
  projectId: string;
  envId?: string | null;
  initialStateByDatabaseId?: Record<string, string>;
  onRepair?: (repair: SchemaRepairRealtimeRecord) => void;
}

export function useSchemaRepairs({
  projectId,
  envId,
  initialStateByDatabaseId,
  onRepair,
}: UseSchemaRepairsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamToken, setStreamToken] = useState(0);
  const onRepairRef = useRef(onRepair);
  const lastStateRef = useRef(
    new Map<string, string>(Object.entries(initialStateByDatabaseId ?? {}))
  );
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onRepairRef.current = onRepair;
  });

  useEffect(() => {
    lastStateRef.current = new Map(Object.entries(initialStateByDatabaseId ?? {}));
  }, [initialStateByDatabaseId]);

  useEffect(() => {
    if (!projectId) {
      setIsConnected(false);
      setError(null);
      return;
    }

    let closed = false;
    const params = new URLSearchParams({
      projectId,
      token: String(streamToken),
    });

    if (envId) {
      params.set('envId', envId);
    }

    const eventSource = new EventSource(`/api/events/schema-repairs?${params.toString()}`);

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
        if (data.type === 'schemaRepair') {
          const repair = data.data as SchemaRepairRealtimeRecord;
          const nextStateKey = buildSchemaRepairRealtimeStateKey(repair);
          if (lastStateRef.current.get(repair.id) === nextStateKey) {
            return;
          }

          lastStateRef.current.set(repair.id, nextStateKey);
          onRepairRef.current?.(repair);
        }
      } catch (err) {
        console.error('Failed to parse schema repair SSE message:', err);
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
  }, [envId, projectId, streamToken]);

  return {
    isConnected,
    error,
  };
}
