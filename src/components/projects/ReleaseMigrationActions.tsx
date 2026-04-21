'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { executeMigrationRunAction } from '@/lib/releases/client-actions';

interface ReleaseMigrationActionsProps {
  projectId: string;
  runId: string;
  status: string;
  disabled?: boolean;
  disabledSummary?: string | null;
}

export function ReleaseMigrationActions({
  projectId,
  runId,
  status,
  disabled = false,
  disabledSummary,
}: ReleaseMigrationActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    'approve' | 'retry' | 'mark_external_complete' | 'mark_external_failed' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const canApprove = status === 'awaiting_approval';
  const canMarkExternal = status === 'awaiting_external_completion';
  const canRetry = status === 'failed' || status === 'canceled';

  const handleAction = async (
    action: 'approve' | 'retry' | 'mark_external_complete' | 'mark_external_failed'
  ) => {
    setPendingAction(action);
    setError(null);

    try {
      await executeMigrationRunAction({
        projectId,
        runId,
        action,
      });
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败');
    } finally {
      setPendingAction(null);
    }
  };

  if (!canApprove && !canMarkExternal && !canRetry) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => handleAction('approve')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'approve' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            审批通过
          </Button>
        )}
        {canMarkExternal && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => handleAction('mark_external_complete')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'mark_external_complete' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            标记完成
          </Button>
        )}
        {canMarkExternal && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => handleAction('mark_external_failed')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'mark_external_failed' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            标记失败
          </Button>
        )}
        {canRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => handleAction('retry')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'retry' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            重试
          </Button>
        )}
      </div>
      {disabled && disabledSummary ? (
        <div className="text-xs text-muted-foreground">{disabledSummary}</div>
      ) : null}
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
