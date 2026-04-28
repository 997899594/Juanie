'use client';

import { Sparkles } from 'lucide-react';
import { openGlobalAIPanelWithReplay } from '@/components/layout/global-ai-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
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
  scopeLabel?: string | null;
  inputSummary?: string | null;
  detail?: string | null;
  createdAtLabel?: string | null;
  completedAtLabel?: string | null;
  provider?: string | null;
  model?: string | null;
}

export function AITaskDetailDialog(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: AITaskDetailDialogTask | null;
}) {
  const task = input.task;

  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      <DialogContent size="form" layout="form">
        {task ? (
          <>
            <DialogHeader chrome>
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
                      {task.statusLabel}
                    </Badge>
                    {task.createdAtLabel ? (
                      <span className="text-xs text-[rgba(15,23,42,0.38)]">
                        {task.createdAtLabel}
                      </span>
                    ) : null}
                    {task.completedAtLabel ? (
                      <span className="text-xs text-[rgba(15,23,42,0.38)]">
                        {task.completedAtLabel}
                      </span>
                    ) : null}
                  </div>
                  <DialogTitle className="text-[1.35rem] tracking-[-0.03em]">
                    {task.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm leading-6 text-[rgba(15,23,42,0.52)]">
                    {task.summary}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-6">
              {task.inputSummary ? (
                <section className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
                    输入
                  </div>
                  <div className="rounded-[20px] bg-[rgba(15,23,42,0.03)] px-5 py-4 text-sm leading-7 text-foreground">
                    {task.inputSummary}
                  </div>
                </section>
              ) : null}

              <Separator className="bg-[rgba(15,23,42,0.06)]" />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(15,23,42,0.42)]">
                    结果
                  </div>
                  {task.detail ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-full bg-[rgba(15,23,42,0.04)] px-3 text-[rgba(15,23,42,0.64)] shadow-none hover:bg-[rgba(15,23,42,0.07)]"
                      onClick={() => {
                        openGlobalAIPanelWithReplay({
                          messages: [
                            ...(task.inputSummary
                              ? [
                                  {
                                    role: 'user' as const,
                                    content: task.inputSummary,
                                  },
                                ]
                              : []),
                            {
                              role: 'assistant' as const,
                              content: task.detail ?? task.summary,
                            },
                          ],
                          metadata: task.provider
                            ? {
                                conversationId: `task-${task.createdAtLabel ?? Date.now()}`,
                                generatedAt: new Date().toISOString(),
                                provider: task.provider,
                                model: task.model ?? '',
                                suggestions: [],
                                skillId: task.scopeLabel ?? 'ai-task',
                                promptKey: 'task-replay',
                                promptVersion: 'v1',
                                toolCalls: [],
                                usage: null,
                              }
                            : null,
                        });
                        input.onOpenChange(false);
                      }}
                    >
                      继续追问
                    </Button>
                  ) : null}
                </div>
                <div className="rounded-[20px] bg-[rgba(255,255,255,0.72)] px-5 py-4 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.2)]">
                  <StreamdownMessage content={task.detail ?? task.summary} />
                </div>
              </section>
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
