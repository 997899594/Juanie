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
        throw new Error(data?.error ?? 'AI 刷新失败');
      }

      setMessage('已刷新');
      setStatus('success');
      router.refresh();
    } catch (error) {
      setMessage(`刷新失败：${error instanceof Error ? error.message : '未知错误'}`);
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

  const buttonTitle = message ?? '刷新 AI';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size={input.compact ? 'icon' : 'sm'}
        className={cn(
          input.compact ? 'h-9 w-9 rounded-full' : 'rounded-full px-3',
          status === 'success' && 'text-emerald-600 hover:bg-emerald-500/8 hover:text-emerald-700',
          status === 'error' && 'text-destructive hover:bg-destructive/8 hover:text-destructive'
        )}
        onClick={handleRefresh}
        title={buttonTitle}
        aria-label={buttonTitle}
      >
        {icon}
        {!input.compact && (refreshing ? '刷新中...' : '刷新 AI')}
      </Button>
      {(input.showMessage ?? true) && message && (
        <div
          className={cn(
            'text-xs',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {message}
        </div>
      )}
    </div>
  );
}
