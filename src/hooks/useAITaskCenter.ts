'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AITaskCenterSnapshot } from '@/lib/ai/tasks/catalog';
import type { AITaskCenterItem } from '@/lib/ai/tasks/view-model';

function createUnavailableSnapshot<TTask extends AITaskCenterItem>(): AITaskCenterSnapshot<TTask> {
  return {
    summary: '任务中心暂不可用',
    actionableCount: 0,
    tasks: [],
  };
}

export function useAITaskCenter<TTask extends AITaskCenterItem>(input: {
  endpoint: string;
  initialSnapshot?: AITaskCenterSnapshot<TTask> | null;
}) {
  const [snapshot, setSnapshot] = useState<AITaskCenterSnapshot<TTask> | null>(
    input.initialSnapshot ?? null
  );
  const [loading, setLoading] = useState(!input.initialSnapshot);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(input.endpoint);
      const data = (await response.json().catch(() => null)) as
        | AITaskCenterSnapshot<TTask>
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : '任务中心加载失败'
        );
      }

      setSnapshot(data as AITaskCenterSnapshot<TTask>);
    } catch {
      setSnapshot(createUnavailableSnapshot<TTask>());
    } finally {
      setLoading(false);
    }
  }, [input.endpoint]);

  useEffect(() => {
    setSnapshot(input.initialSnapshot ?? null);
    setLoading(!input.initialSnapshot);
  }, [input.initialSnapshot]);

  useEffect(() => {
    if (!input.initialSnapshot) {
      void load();
    }
  }, [input.initialSnapshot, load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };

    window.addEventListener('juanie:refresh-ai-task-center', refresh);
    return () => {
      window.removeEventListener('juanie:refresh-ai-task-center', refresh);
    };
  }, [load]);

  return {
    snapshot,
    loading,
    load,
    setSnapshot,
  };
}
