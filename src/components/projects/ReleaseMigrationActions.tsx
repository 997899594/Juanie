'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ReleaseMigrationActionsProps {
  projectId: string;
  runId: string;
  status: string;
  imageUrl?: string | null;
}

export function ReleaseMigrationActions({
  projectId,
  runId,
  status,
  imageUrl,
}: ReleaseMigrationActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'approve' | 'retry' | null>(null);
  const canApprove = status === 'awaiting_approval';
  const canRetry = status === 'failed' || status === 'canceled';

  const handleAction = async (action: 'approve' | 'retry') => {
    setPendingAction(action);

    try {
      const response = await fetch(`/api/projects/${projectId}/migration-runs/${runId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          imageUrl: imageUrl ?? null,
        }),
      });

      if (!response.ok) {
        return;
      }

      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  if (!canApprove && !canRetry) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {canApprove && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-xl px-3 text-xs"
          onClick={() => handleAction('approve')}
          disabled={pendingAction !== null}
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
          disabled={pendingAction !== null}
        >
          {pendingAction === 'retry' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Retry
        </Button>
      )}
    </div>
  );
}
