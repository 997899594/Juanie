'use client';

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StreamdownMessage } from './StreamdownMessage';

export interface AITaskDetailDialogTask {
  title: string;
  statusLabel: string;
  summary: string;
  inputSummary?: string | null;
  detail?: string | null;
  createdAtLabel?: string | null;
  completedAtLabel?: string | null;
}

export function AITaskDetailDialog(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: AITaskDetailDialogTask | null;
}) {
  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      <DialogContent size="form" className="gap-0 p-0">
        {input.task ? (
          <div className="overflow-hidden rounded-[34px] bg-[rgba(251,250,247,0.985)]">
            <DialogHeader className="px-8 py-7">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[rgba(15,23,42,0.62)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="warning"
                      className="rounded-full border-0 px-3 py-1 shadow-none"
                    >
                      {input.task.statusLabel}
                    </Badge>
                    {input.task.createdAtLabel ? (
                      <span className="text-xs text-[rgba(15,23,42,0.38)]">
                        {input.task.createdAtLabel}
                      </span>
                    ) : null}
                    {input.task.completedAtLabel ? (
                      <span className="text-xs text-[rgba(15,23,42,0.38)]">
                        {input.task.completedAtLabel}
                      </span>
                    ) : null}
                  </div>
                  <DialogTitle className="text-[1.35rem] tracking-[-0.03em]">
                    {input.task.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm leading-6 text-[rgba(15,23,42,0.52)]">
                    {input.task.summary}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-8 py-7 pt-0">
              {input.task.inputSummary ? (
                <section className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
                    输入
                  </div>
                  <div className="rounded-[20px] bg-[rgba(15,23,42,0.03)] px-5 py-4 text-sm leading-7 text-foreground">
                    {input.task.inputSummary}
                  </div>
                </section>
              ) : null}

              <Separator className="bg-[rgba(15,23,42,0.06)]" />

              <section className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
                  结果
                </div>
                <div className="rounded-[20px] bg-[rgba(255,255,255,0.72)] px-5 py-4 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.2)]">
                  <StreamdownMessage content={input.task.detail ?? input.task.summary} />
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
