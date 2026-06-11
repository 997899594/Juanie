'use client';

import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { executeMigrationRunAction } from '@/lib/releases/client-actions';

interface ReleaseMigrationActionsProps {
  projectId: string;
  runId: string;
  status: string;
  approvalToken?: string | null;
  disabled?: boolean;
  disabledSummary?: string | null;
}

export function ReleaseMigrationActions({
  projectId,
  runId,
  status,
  approvalToken,
  disabled = false,
  disabledSummary,
}: ReleaseMigrationActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    'approve' | 'retry' | 'mark_external_complete' | 'mark_external_failed' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const canApprove = status === 'awaiting_approval' && !!approvalToken;
  const approvalMissing = status === 'awaiting_approval' && !approvalToken;
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
        approvalToken: action === 'approve' ? (approvalToken ?? null) : null,
      });
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败');
    } finally {
      setPendingAction(null);
    }
  };

  if (!canApprove && !canMarkExternal && !canRetry && !approvalMissing) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <Button
            variant="default"
            size="sm"
            className="h-9 px-4 text-xs shadow-[0_8px_22px_rgba(55,53,47,0.12)]"
            onClick={() => handleAction('approve')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'approve' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}
            批准并执行迁移
          </Button>
        )}
        {approvalMissing && (
          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-4 text-xs"
            disabled
            title="审批确认暂不可用，请刷新页面"
          >
            批准并执行迁移
          </Button>
        )}
        {canMarkExternal && (
          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-4 text-xs"
            onClick={() => handleAction('mark_external_complete')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'mark_external_complete' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}
            标记完成
          </Button>
        )}
        {canMarkExternal && (
          <Button
            variant="destructive"
            size="sm"
            className="h-9 px-4 text-xs"
            onClick={() => handleAction('mark_external_failed')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'mark_external_failed' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-3.5 w-3.5" />
            )}
            标记失败
          </Button>
        )}
        {canRetry && (
          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-4 text-xs"
            onClick={() => handleAction('retry')}
            disabled={pendingAction !== null || disabled}
            title={disabled ? (disabledSummary ?? undefined) : undefined}
          >
            {pendingAction === 'retry' ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
            )}
            重试
          </Button>
        )}
      </div>
      {approvalMissing ? (
        <div className="text-xs text-muted-foreground">审批确认暂不可用，请刷新页面。</div>
      ) : null}
      {disabled && disabledSummary ? (
        <div className="text-xs text-muted-foreground">{disabledSummary}</div>
      ) : null}
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
