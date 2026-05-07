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

function getAIInfoPreview(markdown: string): string {
  const ignoredLines = new Set(['AI 汇总', '当前判断', '主要风险', '处理建议', '重点']);
  const lines = markdown
    .split('\n')
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/\*\*/g, '')
        .trim()
    )
    .filter(Boolean)
    .filter((line) => !ignoredLines.has(line) && !line.endsWith('AI 汇总'));

  return lines[0] ?? '暂无 AI 摘要';
}

export function AIInfoWindow(input: {
  scopeLabel: string;
  markdown: string;
  tone: AIInfoTone;
  compactSummary?: string | null;
  refreshing?: boolean;
  onRefresh: () => void;
  onContinue: () => void;
  detailsTitle?: string;
  priorityChildren?: ReactNode;
  children?: ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tone = getToneBadge(input.tone);
  const preview = input.compactSummary ?? getAIInfoPreview(input.markdown);
  const showDetails = !input.compactSummary || Boolean(input.children);

  return (
    <section className="console-panel px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Badge
            variant={tone.variant}
            className="shrink-0 rounded-full border-0 px-3 py-1 shadow-none"
          >
            {tone.label}
          </Badge>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              AI 总结
            </div>
            <div className="mt-1 truncate text-sm font-medium text-[rgba(15,23,42,0.88)]">
              {preview}
            </div>
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
            {input.refreshing ? '刷新中' : '刷新'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full bg-[rgba(15,23,42,0.04)] px-3.5 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
            onClick={input.onContinue}
          >
            <Sparkles className="h-4 w-4" />
            追问
          </Button>
        </div>
      </div>

      {input.priorityChildren ? <div className="mt-4">{input.priorityChildren}</div> : null}

      {showDetails ? (
        <details
          className="mt-3 rounded-[18px] bg-[rgba(15,23,42,0.025)] px-4 py-3"
          open={detailsOpen}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            {input.detailsTitle ?? '展开依据'}
          </summary>
          {detailsOpen ? (
            <div className="mt-4 space-y-4">
              {!input.compactSummary ? (
                <div className="console-inset rounded-[18px] px-4 py-4 text-sm leading-7 text-[rgba(15,23,42,0.86)]">
                  <StreamdownMessage content={input.markdown} />
                </div>
              ) : null}
              {input.children}
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
