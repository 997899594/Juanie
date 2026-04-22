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
          <div className="overflow-hidden rounded-[34px]">
            <DialogHeader className="border-b border-border/60 px-8 py-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[rgba(244,240,232,0.92)] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="warning" className="rounded-full px-2.5 py-0.5">
                      {input.task.statusLabel}
                    </Badge>
                    {input.task.createdAtLabel ? (
                      <span className="text-xs text-muted-foreground">
                        创建于 {input.task.createdAtLabel}
                      </span>
                    ) : null}
                    {input.task.completedAtLabel ? (
                      <span className="text-xs text-muted-foreground">
                        完成于 {input.task.completedAtLabel}
                      </span>
                    ) : null}
                  </div>
                  <DialogTitle className="text-[1.35rem] tracking-[-0.03em]">
                    {input.task.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm leading-6">
                    {input.task.summary}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-8 py-7">
              {input.task.inputSummary ? (
                <section className="space-y-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    任务输入
                  </div>
                  <div className="rounded-[22px] bg-[rgba(243,240,233,0.68)] px-5 py-4 text-sm leading-7 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]">
                    {input.task.inputSummary}
                  </div>
                </section>
              ) : null}

              <Separator />

              <section className="space-y-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  分析结果
                </div>
                <div className="rounded-[22px] bg-[rgba(251,250,247,0.96)] px-5 py-4 text-sm leading-7 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.78)_inset]">
                  <div className="whitespace-pre-wrap">
                    {input.task.detail ?? input.task.summary}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
