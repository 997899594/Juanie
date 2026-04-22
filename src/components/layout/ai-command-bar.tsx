'use client';

import { Command, Loader2, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getCommandBarConfig } from '@/lib/ai/command-bar';
import { cn } from '@/lib/utils';

interface CopilotReplyPayload {
  message: string;
}

interface TaskReplyPayload {
  summary: string;
}

const openEventName = 'juanie:open-ai-command-bar';

export function openAICommandBar(): void {
  window.dispatchEvent(new Event(openEventName));
}

export function AICommandBar() {
  const pathname = usePathname();
  const config = useMemo(() => getCommandBarConfig(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };

    const onOpen = () => {
      setOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(openEventName, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(openEventName, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setDraft('');
      setResult(null);
      setErrorMessage(null);
      setLoading(false);
      setTaskLoading(false);
    }
  }, [open]);

  const canSubmit = draft.trim().length > 0 && !!config.endpoint && !loading;

  const ask = async (question: string) => {
    const content = question.trim();
    if (!content || !config.endpoint || loading) {
      return;
    }

    setDraft(content);
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | CopilotReplyPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'AI 暂时不可用'
        );
      }

      setResult((data as CopilotReplyPayload).message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'AI 暂时不可用');
    } finally {
      setLoading(false);
    }
  };

  const runAsTask = async (question: string) => {
    const content = question.trim();
    if (!content || !config.taskEndpoint || taskLoading) {
      return;
    }

    setDraft(content);
    setTaskLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(config.taskEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'deep_analysis',
          question: content,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | TaskReplyPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'AI 任务提交失败'
        );
      }

      setResult(`已加入任务中心。\n\n${(data as TaskReplyPayload).summary}`);
      window.dispatchEvent(new Event('juanie:refresh-ai-task-center'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'AI 任务提交失败');
    } finally {
      setTaskLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
        <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.96))] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_24px_60px_rgba(55,53,47,0.12)]">
          <DialogHeader className="border-b border-[rgba(17,17,17,0.06)] px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(244,240,232,0.92)] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-semibold tracking-[-0.03em] text-foreground">
                      AI Command
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm leading-6 text-muted-foreground">
                      {config.description}
                    </DialogDescription>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                {config.title}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="flex items-center gap-3 rounded-[20px] bg-[rgba(251,250,247,0.96)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
              <Command className="h-4 w-4 text-muted-foreground" />
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  config.endpoint
                    ? '直接问当前对象。按 Enter 发送。'
                    : '当前页面还没有对象级 AI 上下文'
                }
                className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
                disabled={!config.endpoint || loading || taskLoading}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void ask(draft);
                  }
                }}
              />
              <div className="hidden text-xs text-muted-foreground sm:block">⌘K</div>
            </div>

            {config.suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {config.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full bg-[rgba(244,240,232,0.88)] px-3 py-1.5 text-left text-xs text-foreground shadow-[0_1px_0_rgba(255,255,255,0.78)_inset] transition hover:bg-white"
                    onClick={() => void ask(suggestion)}
                    disabled={loading || taskLoading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              className={cn(
                'min-h-[180px] rounded-[22px] bg-[rgba(251,250,247,0.9)] px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.72)_inset]',
                !result && !errorMessage && !loading && 'flex items-center'
              )}
            >
              {loading || taskLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {taskLoading ? '正在加入任务中心…' : '正在整理当前对象上下文…'}
                </div>
              ) : errorMessage ? (
                <div className="text-sm leading-6 text-destructive">{errorMessage}</div>
              ) : result ? (
                <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {result}
                </div>
              ) : (
                <div className="text-sm leading-6 text-muted-foreground">
                  {config.endpoint
                    ? '只问当前环境或当前发布最关键的问题。这里不做泛化聊天。'
                    : '进入环境页或发布页后，再用这里快速分析当前对象。'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                className="h-10 rounded-full px-4"
                onClick={() => setOpen(false)}
              >
                关闭
              </Button>
              <Button
                className="h-10 rounded-full px-5"
                disabled={!canSubmit || taskLoading}
                onClick={() => void ask(draft)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                发送
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-full px-5"
                disabled={!canSubmit || loading || !config.taskEndpoint}
                onClick={() => void runAsTask(draft)}
              >
                {taskLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                作为任务运行
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
