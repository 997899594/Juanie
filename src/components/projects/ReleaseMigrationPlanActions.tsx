'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { approveReleaseMigrationPlan } from '@/lib/releases/client-actions';

export function ReleaseMigrationPlanActions({
  projectId,
  releaseId,
  approvalToken,
  disabled = false,
  disabledSummary,
}: {
  projectId: string;
  releaseId: string;
  approvalToken?: string | null;
  disabled?: boolean;
  disabledSummary?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    if (!approvalToken) return;
    setPending(true);
    setError(null);
    try {
      await approveReleaseMigrationPlan({ projectId, releaseId, approvalToken });
      router.refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : '迁移计划审批失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        className="h-9 px-4 text-xs"
        onClick={approve}
        disabled={pending || disabled || !approvalToken}
        title={disabled ? (disabledSummary ?? undefined) : undefined}
      >
        {pending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        )}
        批准整份迁移计划
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
