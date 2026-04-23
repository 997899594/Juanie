'use client';

import { Loader2, Send, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StreamdownMessage } from '@/components/projects/StreamdownMessage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { getCommandBarConfig } from '@/lib/ai/command-bar';
import { cn } from '@/lib/utils';

interface TaskReplyPayload {
  summary: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const openEventName = 'juanie:open-ai-command-bar';

function buildMessageId(): string {
  return `ai-command-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function openAICommandBar(): void {
  window.dispatchEvent(new Event(openEventName));
}

export function AICommandBar() {
  const pathname = usePathname();
  const config = useMemo(() => getCommandBarConfig(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

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
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  });

  useEffect(() => {
    if (!open) {
      setDraft('');
      setMessages([]);
      setErrorMessage(null);
      setLoading(false);
      setTaskLoading(false);
      setStreamingMessageId(null);
    }
  }, [open]);

  const trimmedDraft = draft.trim();
  const canSubmit = trimmedDraft.length > 0 && !!config.endpoint && !loading && !taskLoading;

  const send = async (question: string) => {
    const content = question.trim();
    if (!content || !config.endpoint || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: buildMessageId(),
      role: 'user',
      content,
    };
    const assistantMessageId = buildMessageId();
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    setErrorMessage(null);
    setStreamingMessageId(assistantMessageId);
    setMessages((current) => [
      ...current,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      },
    ]);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
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
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId ? { ...message, content: streamedContent } : message
          )
        );
      }

      streamedContent += decoder.decode();
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId ? { ...message, content: streamedContent } : message
        )
      );
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
      setErrorMessage(error instanceof Error ? error.message : 'AI 暂时不可用');
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
    }
  };

  const runAsTask = async () => {
    if (!trimmedDraft || !config.taskEndpoint || taskLoading) {
      return;
    }

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
          question: trimmedDraft,
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

      setDraft('');
      setMessages((current) => [
        ...current,
        {
          id: buildMessageId(),
          role: 'assistant',
          content: `已加入任务。\n\n${(data as TaskReplyPayload).summary}`,
        },
      ]);
      window.dispatchEvent(new Event('juanie:refresh-ai-task-center'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'AI 任务提交失败');
    } finally {
      setTaskLoading(false);
    }
  };

  const scopeLabel = config.endpoint ? config.title : '未进入对象';

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
        <DialogContent className="overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[min(100vw-2rem,30rem)] lg:mr-8 lg:ml-auto lg:mt-8 lg:h-[calc(100vh-4rem)] lg:max-h-[calc(100vh-4rem)] lg:max-w-[30rem] lg:translate-x-0 lg:translate-y-0 lg:top-0 lg:left-auto">
          <section className="flex h-full min-h-[38rem] flex-col overflow-hidden rounded-[30px] bg-[rgba(251,250,247,0.98)] shadow-[0_28px_80px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)] backdrop-blur">
            <DialogHeader className="border-b border-[rgba(15,23,42,0.06)] px-5 py-5 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[rgba(15,23,42,0.72)]">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                    AI
                  </DialogTitle>
                  <div className="mt-1 text-[13px] text-[rgba(15,23,42,0.5)]">{scopeLabel}</div>
                </div>
              </div>
            </DialogHeader>

            <div ref={viewportRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {!config.endpoint ? (
                <div className="rounded-[22px] bg-[rgba(15,23,42,0.035)] px-4 py-3.5 text-sm leading-7 text-[rgba(15,23,42,0.52)]">
                  进入环境或发布后使用。
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[88%] rounded-[24px] px-4 py-3.5 text-sm leading-7',
                      message.role === 'user'
                        ? 'rounded-br-md bg-[rgba(15,23,42,0.96)] text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.3)]'
                        : 'rounded-bl-md bg-[rgba(15,23,42,0.035)] text-[rgba(15,23,42,0.88)]'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <StreamdownMessage
                        content={message.content}
                        isStreaming={streamingMessageId === message.id}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </div>
              ))}

              {loading && !messages.some((message) => message.id === streamingMessageId) ? (
                <div className="flex justify-start">
                  <div className="rounded-[24px] rounded-bl-md bg-[rgba(15,23,42,0.035)] px-4 py-3 text-[rgba(15,23,42,0.5)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-[18px] bg-[rgba(185,28,28,0.06)] px-4 py-3 text-sm text-[rgba(185,28,28,0.84)]">
                  {errorMessage}
                </div>
              ) : null}
            </div>

            <div className="border-t border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.6)] px-4 pb-4 pt-4">
              {config.endpoint && config.suggestions.length > 0 && messages.length === 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {config.suggestions.slice(0, 2).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full bg-[rgba(15,23,42,0.045)] px-3.5 py-1.5 text-[12px] font-medium text-[rgba(15,23,42,0.72)] transition hover:bg-[rgba(15,23,42,0.08)]"
                      onClick={() => void send(suggestion)}
                      disabled={loading || taskLoading}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="rounded-[24px] bg-white p-3 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.12)] ring-1 ring-[rgba(15,23,42,0.06)]">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={config.endpoint ? '问当前对象' : '当前不可用'}
                  className="min-h-[92px] resize-none border-0 bg-transparent px-1 py-1 text-[14px] leading-7 text-[rgba(15,23,42,0.9)] shadow-none ring-0 placeholder:text-[rgba(15,23,42,0.34)] focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={!config.endpoint || loading || taskLoading}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send(trimmedDraft);
                    }
                  }}
                />
                <div className="mt-3 flex items-center justify-between border-t border-[rgba(15,23,42,0.06)] pt-3">
                  <button
                    type="button"
                    className="text-[12px] text-[rgba(15,23,42,0.42)] transition hover:text-[rgba(15,23,42,0.7)]"
                    disabled={!trimmedDraft || loading || taskLoading || !config.taskEndpoint}
                    onClick={() => void runAsTask()}
                  >
                    加入任务
                  </button>

                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 rounded-full bg-[rgba(15,23,42,0.96)] text-white shadow-none hover:bg-[rgba(15,23,42,0.84)]"
                    disabled={!canSubmit}
                    onClick={() => void send(trimmedDraft)}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
