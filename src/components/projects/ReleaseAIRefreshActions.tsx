'use client';

import { AlertTriangle, Check, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ReleaseAIRefreshActions(input: {
  projectId: string;
  releaseId: string;
  compact?: boolean;
  showMessage?: boolean;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const scheduleReset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setMessage(null);
      setStatus('idle');
    }, 3000);
  };

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    setMessage(null);
    setStatus('idle');

    try {
      const responses = await Promise.all([
        fetch(`/api/projects/${input.projectId}/releases/${input.releaseId}/ai-plan`, {
          method: 'POST',
        }),
        fetch(`/api/projects/${input.projectId}/releases/${input.releaseId}/ai-incident`, {
          method: 'POST',
        }),
      ]);

      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = (await failed.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? '刷新失败');
      }

      setMessage('已刷新');
      setStatus('success');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '刷新失败');
      setStatus('error');
    } finally {
      setRefreshing(false);
      scheduleReset();
    }
  };

  const icon = refreshing ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : status === 'success' ? (
    <Check className="h-3.5 w-3.5" />
  ) : status === 'error' ? (
    <AlertTriangle className="h-3.5 w-3.5" />
  ) : (
    <Sparkles className="h-3.5 w-3.5" />
  );

  const buttonTitle = message ?? '刷新';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size={input.compact ? 'icon' : 'sm'}
        className={cn(
          input.compact
            ? 'h-9 w-9 rounded-full bg-[rgba(15,23,42,0.04)] text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]'
            : 'rounded-full bg-[rgba(15,23,42,0.04)] px-3 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]',
          status === 'success' &&
            'bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.72)] hover:bg-[rgba(15,23,42,0.09)]',
          status === 'error' &&
            'bg-[rgba(15,23,42,0.06)] text-[rgba(15,23,42,0.5)] hover:bg-[rgba(15,23,42,0.09)]'
        )}
        onClick={handleRefresh}
        title={buttonTitle}
        aria-label={buttonTitle}
      >
        {icon}
        {!input.compact && (refreshing ? '刷新中…' : '刷新')}
      </Button>
      {(input.showMessage ?? true) && message && (
        <div className="text-xs text-[rgba(15,23,42,0.42)]">{message}</div>
      )}
    </div>
  );
}
