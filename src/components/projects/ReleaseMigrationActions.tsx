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
  imageUrl?: string | null;
  disabled?: boolean;
  disabledSummary?: string | null;
}

export function ReleaseMigrationActions({
  projectId,
  runId,
  status,
  imageUrl,
  disabled = false,
  disabledSummary,
}: ReleaseMigrationActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'approve' | 'retry' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canApprove = status === 'awaiting_approval';
  const canRetry = status === 'failed' || status === 'canceled';

  const handleAction = async (action: 'approve' | 'retry') => {
    setPendingAction(action);
    setError(null);

    try {
      await executeMigrationRunAction({
        projectId,
        runId,
        action,
        imageUrl,
      });
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败');
    } finally {
      setPendingAction(null);
    }
  };

  if (!canApprove && !canRetry) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {canApprove && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl px-3 text-xs"
            onClick={() => handleAction('approve')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'approve' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Approve
          </Button>
        )}
        {canRetry && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl px-3 text-xs"
            onClick={() => handleAction('retry')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'retry' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Retry
          </Button>
        )}
      </div>
      {disabled && disabledSummary && (
        <div className="text-xs text-muted-foreground">{disabledSummary}</div>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
