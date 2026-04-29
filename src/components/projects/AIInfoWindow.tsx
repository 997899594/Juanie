'use client';

import { RefreshCw, Sparkles } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { StreamdownMessage } from '@/components/projects/StreamdownMessage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AIInfoTone = 'healthy' | 'attention' | 'risk' | 'neutral';

function getToneBadge(input: AIInfoTone): {
  label: string;
  variant: 'secondary' | 'warning' | 'destructive';
} {
  if (input === 'risk') {
    return {
      label: '有风险',
      variant: 'destructive',
    };
  }

  if (input === 'attention') {
    return {
      label: '需关注',
      variant: 'warning',
    };
  }

  return {
    label: input === 'healthy' ? '稳定' : '整理中',
    variant: 'secondary',
  };
}

export function AIInfoWindow(input: {
  scopeLabel: string;
  markdown: string;
  tone: AIInfoTone;
  modulesLabel?: string | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
  onContinue: () => void;
  detailsTitle?: string;
  priorityChildren?: ReactNode;
  children?: ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tone = getToneBadge(input.tone);

  return (
    <section className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,246,241,0.94))] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.045),0_24px_60px_rgba(55,53,47,0.06)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            AI 总结
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={tone.variant} className="rounded-full border-0 px-3 py-1 shadow-none">
              {tone.label}
            </Badge>
            <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.05)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.58)] shadow-none">
              {input.scopeLabel}
            </Badge>
            {input.modulesLabel ? (
              <Badge className="rounded-full border-0 bg-[rgba(15,23,42,0.05)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.58)] shadow-none">
                {input.modulesLabel}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
            onClick={input.onRefresh}
            disabled={input.refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', input.refreshing && 'animate-spin')} />
            {input.refreshing ? '刷新中…' : '刷新'}
          </Button>
          <Button
            type="button"
            className="h-9 rounded-full bg-[rgba(28,27,24,0.96)] px-4 text-[rgba(251,250,247,0.96)] shadow-[0_18px_38px_-24px_rgba(15,23,42,0.28)] hover:bg-[rgba(28,27,24,0.86)]"
            onClick={input.onContinue}
          >
            <Sparkles className="h-4 w-4" />
            继续追问
          </Button>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] bg-[rgba(15,23,42,0.03)] px-5 py-5">
        {input.loading ? (
          <div className="text-sm leading-7 text-[rgba(15,23,42,0.58)]">
            正在整理当前页面的 AI 汇总…
          </div>
        ) : (
          <div className="text-sm leading-7 text-[rgba(15,23,42,0.86)]">
            <StreamdownMessage content={input.markdown} />
          </div>
        )}
      </div>

      {input.priorityChildren ? <div className="mt-5">{input.priorityChildren}</div> : null}

      {input.children ? (
        <details
          className="mt-5 rounded-[20px] bg-[rgba(15,23,42,0.03)] px-4 py-4"
          open={detailsOpen}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            {input.detailsTitle ?? '查看证据与上下文'}
          </summary>
          {detailsOpen ? <div className="mt-4 space-y-4">{input.children}</div> : null}
        </details>
      ) : null}
    </section>
  );
}
