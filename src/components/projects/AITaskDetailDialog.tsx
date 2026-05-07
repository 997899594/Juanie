'use client';

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
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="warning" className="rounded-full border-0 px-3 py-1 shadow-none">
                    {task.statusLabel}
                  </Badge>
                </div>
                <DialogTitle className="text-[1.35rem] tracking-[-0.03em]">
                  {task.title}
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-6 text-[rgba(15,23,42,0.52)]">
                  {task.summary}
                </DialogDescription>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4">
              {task.inputSummary ? (
                <section className="space-y-3">
                  <div className="console-inset rounded-[20px] px-5 py-4 text-sm leading-7 text-foreground">
                    {task.inputSummary}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">结果</div>
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
