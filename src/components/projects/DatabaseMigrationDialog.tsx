'use client';

import { AlertTriangle, Database, Loader2, Play, RefreshCw, TerminalSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface MigrationRunItem {
  id: string;
  name: string;
  status: string;
  output: string | null;
  error: string | null;
}

interface MigrationRun {
  id: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
  logExcerpt: string | null;
  specification: {
    tool: string;
    phase: string;
  };
  service: {
    name: string;
  };
  items: MigrationRunItem[];
  sourceCommitSha?: string | null;
}

interface MigrationPlan {
  confirmationValue: string;
  canRun: boolean;
  blockingReason: string | null;
  filePreviewError: string | null;
  warnings: string[];
  runnerType: 'k8s_job' | 'worker';
  imageUrl: string | null;
  database: {
    id: string;
    name: string;
    type: string;
    status: string | null;
  };
  service: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
    branch: string | null;
    isProduction: boolean;
  };
  specification: {
    id: string;
    tool: string;
    phase: string;
    workingDirectory: string;
    migrationPath: string | null;
    command: string;
    compatibility: string;
    approvalPolicy: string;
    lockStrategy: string;
    autoRun: boolean;
  };
  sqlFiles: Array<{
    name: string;
  }>;
}

interface DatabaseMigrationDialogProps {
  projectId: string;
  databaseId: string;
  databaseName: string;
  databaseType: string;
  latestImageUrl?: string | null;
  latestStatus?: string | null;
}

const statusTone: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  running: 'secondary',
  queued: 'secondary',
  planning: 'secondary',
  awaiting_approval: 'outline',
  failed: 'destructive',
  canceled: 'outline',
  skipped: 'outline',
};

export function DatabaseMigrationDialog({
  projectId,
  databaseId,
  databaseName,
  databaseType,
  latestImageUrl,
  latestStatus,
}: DatabaseMigrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<MigrationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`);
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [databaseId, projectId]);

  useEffect(() => {
    if (!open) return;
    loadRuns();
  }, [open, loadRuns]);

  const loadPlan = useCallback(async () => {
    setPlanning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          imageUrl: latestImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? 'Failed to load migration plan');
        setPlan(null);
        return;
      }
      setPlan(data);
    } finally {
      setPlanning(false);
    }
  }, [databaseId, latestImageUrl, projectId]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      loadRuns();
    }, 3000);
    return () => clearInterval(interval);
  }, [open, loadRuns]);

  useEffect(() => {
    if (!open) {
      setPlan(null);
      setMessage(null);
      setConfirmationText('');
      return;
    }
    loadPlan();
  }, [open, loadPlan]);

  const handleRun = async () => {
    if (!plan) return;
    setTriggering(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          imageUrl: latestImageUrl,
          confirmationText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? 'Failed to trigger migration');
        return;
      }
      setMessage(data.message ?? 'Migration queued');
      setConfirmationText('');
      await loadRuns();
      await loadPlan();
    } finally {
      setTriggering(false);
    }
  };

  const handleAction = async (action: 'approve' | 'retry', runId: string) => {
    setTriggering(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/databases/${databaseId}/migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          runId,
          imageUrl: latestImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? `Failed to ${action} migration`);
        return;
      }
      setMessage(data.message ?? `Migration ${action} queued`);
      await loadRuns();
    } finally {
      setTriggering(false);
    }
  };

  const latestRun = runs[0];
  const confirmationMatches = plan ? confirmationText.trim() === plan.confirmationValue : false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Database className="mr-1 h-3 w-3" />
          Migrate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{databaseName} migrations</DialogTitle>
          <DialogDescription>
            Review the execution plan, confirm the target, then queue the migration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{databaseType}</Badge>
            {latestStatus && <Badge variant="outline">db: {latestStatus}</Badge>}
            {latestRun && (
              <Badge variant={statusTone[latestRun.status] ?? 'outline'}>
                last: {latestRun.status}
              </Badge>
            )}
          </div>

          {message && <div className="text-sm text-muted-foreground">{message}</div>}

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-medium">Execution Plan</div>
                <div className="text-xs text-muted-foreground">
                  Manual migrations require confirmation in every environment.
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={loadPlan}
                disabled={planning}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Refresh plan
              </Button>
            </div>
            <div className="space-y-4 px-4 py-3">
              {planning ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading execution plan…
                </div>
              ) : !plan ? (
                <div className="text-sm text-muted-foreground">Execution plan unavailable.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{plan.environment.name}</Badge>
                    <Badge variant="outline">{plan.service.name}</Badge>
                    <Badge variant="outline">{plan.specification.tool}</Badge>
                    <Badge variant="outline">{plan.specification.phase}</Badge>
                    {plan.environment.isProduction && (
                      <Badge variant="destructive">production</Badge>
                    )}
                    {plan.specification.compatibility === 'breaking' && (
                      <Badge variant="destructive">breaking</Badge>
                    )}
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Database</div>
                      <div className="font-medium">{plan.database.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {plan.database.type} · {plan.database.status ?? 'unknown'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Runner</div>
                      <div className="font-medium">{plan.runnerType}</div>
                      <div className="text-xs text-muted-foreground break-all">
                        {plan.runnerType === 'k8s_job'
                          ? (plan.imageUrl ?? 'No image available')
                          : 'Runs in the control-plane worker'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Working Directory</div>
                      <code className="text-xs">{plan.specification.workingDirectory}</code>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Migration Path</div>
                      <code className="text-xs">
                        {plan.specification.migrationPath ?? `migrations/${plan.database.type}`}
                      </code>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Compatibility</div>
                      <div className="font-medium">{plan.specification.compatibility}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Approval Policy</div>
                      <div className="font-medium">{plan.specification.approvalPolicy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Lock Strategy</div>
                      <div className="font-medium">{plan.specification.lockStrategy}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TerminalSquare className="h-3.5 w-3.5" />
                      Command preview
                    </div>
                    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                      {plan.specification.command}
                    </pre>
                  </div>

                  {plan.specification.tool === 'sql' && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        SQL files to apply ({plan.sqlFiles.length})
                      </div>
                      {plan.sqlFiles.length > 0 ? (
                        <div className="space-y-1 rounded bg-muted/60 p-2">
                          {plan.sqlFiles.map((file) => (
                            <div key={file.name} className="text-xs text-muted-foreground">
                              {file.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No SQL files detected for the configured migration path.
                        </div>
                      )}
                    </div>
                  )}

                  {(plan.warnings.length > 0 || plan.blockingReason || plan.filePreviewError) && (
                    <div className="space-y-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Review before running
                      </div>
                      {plan.warnings.map((warning) => (
                        <div key={warning} className="text-xs text-muted-foreground">
                          {warning}
                        </div>
                      ))}
                      {plan.blockingReason && (
                        <div className="text-xs text-destructive">{plan.blockingReason}</div>
                      )}
                      {plan.filePreviewError && !plan.blockingReason && (
                        <div className="text-xs text-destructive">{plan.filePreviewError}</div>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor={`migration-confirm-${databaseId}`}>
                      Type <code>{plan.confirmationValue}</code> to confirm
                    </Label>
                    <Input
                      id={`migration-confirm-${databaseId}`}
                      value={confirmationText}
                      onChange={(event) => setConfirmationText(event.target.value)}
                      placeholder={plan.confirmationValue}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-medium">Recent Runs</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  loadRuns();
                  loadPlan();
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Refresh
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
              ) : runs.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No migration runs yet.
                </div>
              ) : (
                <div className="divide-y">
                  {runs.map((run) => (
                    <div key={run.id} className="space-y-2 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusTone[run.status] ?? 'outline'}>{run.status}</Badge>
                        <span className="text-xs text-muted-foreground">{run.service.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {run.specification.tool}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {run.errorMessage && (
                        <div className="text-xs text-destructive">{run.errorMessage}</div>
                      )}
                      <div className="flex items-center gap-2">
                        {run.status === 'awaiting_approval' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAction('approve', run.id)}
                            disabled={triggering}
                          >
                            Approve
                          </Button>
                        )}
                        {(run.status === 'failed' || run.status === 'canceled') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAction('retry', run.id)}
                            disabled={triggering}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                      {run.items.length > 0 && (
                        <div className="space-y-1">
                          {run.items.map((item) => (
                            <div key={item.id} className="text-xs text-muted-foreground">
                              {item.name} · {item.status}
                            </div>
                          ))}
                        </div>
                      )}
                      {run.logExcerpt && (
                        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                          {run.logExcerpt}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleRun}
            disabled={triggering || planning || !plan || !plan.canRun || !confirmationMatches}
          >
            {triggering ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1 h-4 w-4" />
            )}
            Run migration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
