import { Archive, Check, CircleDashed, GitCommit, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { getDeliveryExecutionReadModel } from '@/lib/delivery-executions/read-model';
import { formatPlatformDateTime } from '@/lib/time/format';
import { cn } from '@/lib/utils';

type DeliveryExecutionView = NonNullable<Awaited<ReturnType<typeof getDeliveryExecutionReadModel>>>;

interface DeliveryExecutionTimelineProps {
  execution: DeliveryExecutionView;
}

interface EventIconProps {
  status: DeliveryExecutionView['events'][number]['status'];
}

function getEventToneClass(status: EventIconProps['status']): string {
  if (status === 'failed' || status === 'canceled') {
    return 'border-destructive text-destructive';
  }
  if (status === 'production_verified' || status === 'staging_verified') {
    return 'border-success text-success';
  }
  if (status === 'historical') return 'border-muted-foreground text-muted-foreground';
  return 'border-info text-info';
}

function EventIcon({ status }: EventIconProps) {
  if (status === 'failed' || status === 'canceled') return <X className="size-3.5" />;
  if (status === 'production_verified') return <ShieldCheck className="size-3.5" />;
  if (status === 'historical') return <Archive className="size-3.5" />;
  if (status === 'staging_verified' || status === 'awaiting_promotion') {
    return <Check className="size-3.5" />;
  }
  return <CircleDashed className="size-3.5" />;
}

export function DeliveryExecutionTimeline({ execution }: DeliveryExecutionTimelineProps) {
  const failed = execution.status === 'failed' || execution.status === 'canceled';
  const completed = execution.status === 'production_verified';
  let badgeVariant: 'default' | 'destructive' | 'secondary' = 'secondary';
  if (failed) badgeVariant = 'destructive';
  else if (completed) badgeVariant = 'default';
  return (
    <section className="console-panel px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitCommit className="size-4 text-muted-foreground" />
            交付链路
          </div>
          <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {execution.sourceCommitSha} · {execution.sourceRef}
          </div>
        </div>
        <Badge className="self-start md:self-auto" variant={badgeVariant}>
          {execution.statusLabel}
        </Badge>
      </div>

      <ol className="mt-4 grid gap-0 border-border/70 border-l md:grid-cols-2 md:border-l-0 xl:grid-cols-4">
        {execution.events.map((event) => (
          <li
            key={event.id}
            className="relative min-w-0 border-border/70 border-b px-4 py-3 last:border-b-0 md:border-l md:last:border-b"
          >
            <span
              className={cn(
                '-left-[7px] absolute top-4 flex size-3.5 items-center justify-center rounded-full border bg-background md:left-3 md:top-3',
                getEventToneClass(event.status)
              )}
            >
              <EventIcon status={event.status} />
            </span>
            <div className="pl-2 text-sm font-medium text-foreground md:pt-5 md:pl-0">
              {event.label}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatPlatformDateTime(event.occurredAt)}
            </div>
          </li>
        ))}
      </ol>

      {execution.lastError ? (
        <div className="mt-3 break-words border-destructive/30 border-t pt-3 text-sm text-destructive">
          {execution.lastErrorCode ? `${execution.lastErrorCode}: ` : null}
          {execution.lastError}
        </div>
      ) : null}
    </section>
  );
}
