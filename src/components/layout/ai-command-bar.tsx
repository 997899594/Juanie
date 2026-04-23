'use client';

import { Command, Loader2, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { StreamdownMessage } from '@/components/projects/StreamdownMessage';
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

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'AI 暂时不可用'
        );
      }

      if (!response.body) {
        throw new Error('AI 响应流不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        streamedContent += decoder.decode(value, { stream: true });
        setResult(streamedContent);
      }

      streamedContent += decoder.decode();
      setResult(streamedContent);
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(15,23,42,0.94)] text-white shadow-[0_22px_44px_rgba(15,23,42,0.18)] transition duration-200 hover:scale-[1.02] hover:bg-[rgba(15,23,42,0.86)] lg:bottom-8 lg:right-8"
        aria-label="打开 AI"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
          <div className="overflow-hidden rounded-[30px] bg-[rgba(251,250,247,0.98)] shadow-[0_28px_80px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)] backdrop-blur">
            <DialogHeader className="px-6 py-6 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[rgba(15,23,42,0.72)]">
                      <Sparkles className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <DialogTitle className="text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                        AI
                      </DialogTitle>
                      <DialogDescription className="mt-1 text-[13px] leading-6 text-[rgba(15,23,42,0.56)]">
                        {config.description}
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                {config.endpoint ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full border-0 bg-[rgba(15,23,42,0.05)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.56)] shadow-none"
                  >
                    当前对象
                  </Badge>
                ) : null}
              </div>
            </DialogHeader>

            <div className="space-y-5 px-6 pb-6">
              <div className="flex items-center gap-3 rounded-[22px] bg-[rgba(255,255,255,0.76)] px-4 py-3 ring-1 ring-[rgba(15,23,42,0.06)] transition duration-200 focus-within:bg-white focus-within:ring-[rgba(15,23,42,0.12)] focus-within:shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <Command className="h-4 w-4 text-[rgba(15,23,42,0.38)]" />
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    config.endpoint
                      ? '直接问当前对象。按 Enter 发送。'
                      : '当前页面还没有对象级 AI 上下文'
                  }
                  className="h-auto border-0 bg-transparent px-0 py-0 text-[15px] text-[rgba(15,23,42,0.92)] shadow-none placeholder:text-[rgba(15,23,42,0.34)] focus-visible:ring-0"
                  disabled={!config.endpoint || loading || taskLoading}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void ask(draft);
                    }
                  }}
                />
                <div className="hidden text-[11px] text-[rgba(15,23,42,0.34)] sm:block">⌘K</div>
              </div>

              {config.suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {config.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full bg-[rgba(15,23,42,0.045)] px-3.5 py-1.5 text-left text-[12px] font-medium text-[rgba(15,23,42,0.72)] transition hover:bg-[rgba(15,23,42,0.08)]"
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
                  'min-h-[180px] rounded-[24px] bg-[rgba(255,255,255,0.72)] px-5 py-4 ring-1 ring-[rgba(15,23,42,0.06)]',
                  !result && !errorMessage && !loading && 'flex items-center'
                )}
              >
                {loading || taskLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[rgba(15,23,42,0.48)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {taskLoading ? '正在加入任务中心…' : '正在整理当前对象上下文…'}
                  </div>
                ) : errorMessage ? (
                  <div className="text-sm leading-6 text-[rgba(185,28,28,0.88)]">
                    {errorMessage}
                  </div>
                ) : result ? (
                  <StreamdownMessage content={result} />
                ) : (
                  <div className="text-sm leading-6 text-[rgba(15,23,42,0.48)]">
                    {config.endpoint
                      ? '只问当前对象最关键的问题。'
                      : '进入环境页或发布页后再使用。'}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  className="h-10 rounded-full bg-[rgba(15,23,42,0.045)] px-4 text-[rgba(15,23,42,0.68)] shadow-none hover:bg-[rgba(15,23,42,0.08)]"
                  onClick={() => setOpen(false)}
                >
                  关闭
                </Button>
                <Button
                  className="h-10 rounded-full bg-[rgba(15,23,42,0.92)] px-5 text-white shadow-none hover:bg-[rgba(15,23,42,0.82)]"
                  disabled={!canSubmit || taskLoading}
                  onClick={() => void ask(draft)}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  发送
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-0 bg-[rgba(15,23,42,0.06)] px-5 text-[rgba(15,23,42,0.72)] shadow-none hover:bg-[rgba(15,23,42,0.1)]"
                  disabled={!canSubmit || loading || !config.taskEndpoint}
                  onClick={() => void runAsTask(draft)}
                >
                  {taskLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  加入任务
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
