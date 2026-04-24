'use client';

import { Folder, Inbox, Loader2, MoveRight, Send, Settings, Sparkles, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StreamdownMessage } from '@/components/projects/StreamdownMessage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCopilotConversation } from '@/hooks/useCopilotConversation';
import { getCommandBarConfig } from '@/lib/ai/command-bar';
import { getCopilotDefinition } from '@/lib/ai/copilot/registry';
import type { CopilotReplayPayload, CopilotSessionMetadata } from '@/lib/ai/copilot/types';
import { getJuanieToolById } from '@/lib/ai/tools/registry';
import { cn } from '@/lib/utils';

interface TaskReplyPayload {
  summary: string;
}

const openEventName = 'juanie:open-global-ai-panel';

const routeIcons = {
  项目: Folder,
  待办: Inbox,
  团队: Users,
  设置: Settings,
} as const;

function buildMessageId(): string {
  return `global-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultChatError = '稍后重试';
const defaultTaskError = '提交失败';

function formatTokenUsage(totalTokens: number | null): string | null {
  if (!totalTokens || totalTokens <= 0) {
    return null;
  }

  if (totalTokens >= 1000) {
    return `${(totalTokens / 1000).toFixed(1)}k tokens`;
  }

  return `${totalTokens} tokens`;
}

function formatToolScopeLabel(scope: string): string {
  if (scope === 'environment') {
    return '环境';
  }

  if (scope === 'release') {
    return '发布';
  }

  return '项目';
}

function formatRiskLevelLabel(riskLevel: string): string {
  if (riskLevel === 'read') {
    return '只读';
  }

  if (riskLevel === 'write') {
    return '写入';
  }

  if (riskLevel === 'dangerous') {
    return '高风险';
  }

  return riskLevel;
}

function formatSkillLabel(skillId: string | null | undefined): string {
  if (skillId === getCopilotDefinition('environment').skillId) {
    return getCopilotDefinition('environment').title;
  }

  if (skillId === getCopilotDefinition('release').skillId) {
    return getCopilotDefinition('release').title;
  }

  return '当前上下文';
}

export function openGlobalAIPanel(): void {
  window.dispatchEvent(new Event(openEventName));
}

export function openGlobalAIPanelWithReplay(input: {
  messages: CopilotReplayPayload['messages'];
  metadata?: CopilotReplayPayload['metadata'];
}): void {
  window.dispatchEvent(
    new CustomEvent(openEventName, {
      detail: input,
    })
  );
}

export function GlobalAIPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const config = useMemo(() => getCommandBarConfig(pathname), [pathname]);
  const conversation = useCopilotConversation(config.kind === 'chat' ? config.endpoint : null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [traceExpanded, setTraceExpanded] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<CopilotReplayPayload>).detail;

      if (detail?.messages?.length) {
        conversation.setMessages(
          detail.messages.map((message) => ({
            id: buildMessageId(),
            role: message.role,
            content: message.content,
            createdAt: new Date().toISOString(),
          }))
        );
        conversation.setMetadata(detail.metadata ?? null);
      }

      setOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(openEventName, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(openEventName, onOpen);
    };
  }, [conversation]);

  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  });

  useEffect(() => {
    if (!open) {
      setDraft('');
      setErrorMessage(null);
      setLoading(false);
      setTaskLoading(false);
      setStreamingMessageId(null);
      setTraceExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      if (!composerRef.current) {
        return;
      }

      composerRef.current.style.height = '0px';
      composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 220)}px`;
    }
  }, [open]);

  const trimmedDraft = draft.trim();
  const isChatMode = config.kind === 'chat';
  const canSubmit = trimmedDraft.length > 0 && isChatMode && !loading && !taskLoading;
  const suggestions = conversation.metadata?.suggestions ?? config.suggestions;
  const currentToolCalls = conversation.metadata?.toolCalls ?? [];
  const currentUsageLabel = formatTokenUsage(conversation.metadata?.usage?.totalTokens ?? null);
  const currentTraceLabel =
    currentToolCalls.length > 0 ? `${currentToolCalls.length} 次读取` : null;
  const currentTraceSummary =
    currentToolCalls.length > 0
      ? `已读取 ${currentToolCalls.length} 项${formatSkillLabel(conversation.metadata?.skillId)}上下文`
      : null;

  const send = async (question: string) => {
    const content = question.trim();
    if (!content || config.kind !== 'chat' || loading || !config.endpoint) {
      return;
    }
    const endpoint = config.endpoint;

    const userMessage = {
      id: buildMessageId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    } satisfies { id: string; role: 'user'; content: string; createdAt: string };
    const assistantMessageId = buildMessageId();
    const nextMessages = [...conversation.messages, userMessage];

    conversation.archiveCurrent();
    conversation.setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    setErrorMessage(null);
    setStreamingMessageId(assistantMessageId);
    conversation.setMessages((current) => [
      ...current,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch(endpoint, {
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
            : defaultChatError
        );
      }

      if (!response.body) {
        throw new Error(defaultChatError);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';
      let buffered = '';

      const applyAssistantText = (text: string) => {
        conversation.setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId ? { ...message, content: text } : message
          )
        );
      };

      const processEvent = (rawEvent: string) => {
        const lines = rawEvent.replace(/\r/g, '').split('\n');
        const eventName = lines
          .find((line) => line.startsWith('event:'))
          ?.slice('event:'.length)
          .trim();
        const dataLine = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length).trim())
          .join('\n');

        if (!eventName || !dataLine) {
          return;
        }

        const payload = JSON.parse(dataLine) as
          | CopilotSessionMetadata
          | { text: string }
          | { message: string };

        if (eventName === 'meta') {
          conversation.setMetadata(payload as CopilotSessionMetadata);
          return;
        }

        if (eventName === 'delta' && 'text' in payload) {
          streamedContent += payload.text;
          applyAssistantText(streamedContent);
          return;
        }

        if (eventName === 'error' && 'message' in payload) {
          throw new Error(payload.message);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffered += decoder.decode(value, { stream: true });

        while (buffered.includes('\n\n')) {
          const delimiterIndex = buffered.indexOf('\n\n');
          const rawEvent = buffered.slice(0, delimiterIndex);
          buffered = buffered.slice(delimiterIndex + 2);

          if (rawEvent.trim()) {
            processEvent(rawEvent);
          }
        }
      }

      buffered += decoder.decode();
      if (buffered.trim()) {
        processEvent(buffered.trim());
      }
    } catch (error) {
      conversation.setMessages((current) =>
        current.filter((message) => message.id !== assistantMessageId)
      );
      setErrorMessage(error instanceof Error ? error.message : defaultChatError);
    } finally {
      setLoading(false);
      setStreamingMessageId(null);
    }
  };

  const runAsTask = async () => {
    if (!trimmedDraft || config.kind !== 'chat' || !config.taskEndpoint || taskLoading) {
      return;
    }
    const taskEndpoint = config.taskEndpoint;

    setTaskLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(taskEndpoint, {
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
            : defaultTaskError
        );
      }

      setDraft('');
      conversation.setMessages((current) => [
        ...current,
        {
          id: buildMessageId(),
          role: 'assistant',
          content: `已加入任务\n\n${(data as TaskReplyPayload).summary}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      window.dispatchEvent(new Event('juanie:refresh-ai-task-center'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : defaultTaskError);
    } finally {
      setTaskLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(28,27,24,0.94)] text-[rgba(251,250,247,0.96)] shadow-[0_20px_36px_rgba(15,23,42,0.14)] transition duration-200 hover:scale-[1.02] hover:bg-[rgba(28,27,24,0.88)] lg:bottom-8 lg:right-8"
        aria-label="打开 AI"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[min(100vw-1.5rem,36rem)] sm:px-0 sm:py-0 lg:mr-4 lg:ml-auto lg:mt-4 lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)] lg:max-w-[38rem] lg:translate-x-0 lg:translate-y-0 lg:top-0 lg:left-auto">
          <section className="flex h-full min-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[32px] bg-[rgba(251,250,247,0.985)] shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:min-h-[44rem] lg:min-h-0">
            <DialogHeader className="px-5 py-4 text-left">
              <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.05)] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[rgba(15,23,42,0.62)]">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                    AI
                  </DialogTitle>
                  <div className="mt-1 text-[13px] text-[rgba(15,23,42,0.48)]">{config.title}</div>
                </div>
              </div>
            </DialogHeader>

            {isChatMode ? (
              <>
                <div ref={viewportRef} className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
                  {conversation.messages.length === 0 && suggestions.length > 0 ? (
                    <div className="pb-1">
                      {suggestions.slice(0, 1).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="rounded-full bg-[rgba(15,23,42,0.045)] px-3.5 py-1.5 text-[12px] font-medium text-[rgba(15,23,42,0.66)] transition hover:bg-[rgba(15,23,42,0.08)]"
                          onClick={() => void send(suggestion)}
                          disabled={loading || taskLoading}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {conversation.metadata ? (
                    <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-[rgba(15,23,42,0.4)]">
                      <span>{formatSkillLabel(conversation.metadata.skillId)}</span>
                      {currentTraceLabel ? (
                        <>
                          <span>·</span>
                          <span>{currentTraceLabel}</span>
                        </>
                      ) : null}
                      {currentUsageLabel ? (
                        <>
                          <span>·</span>
                          <span>{currentUsageLabel}</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {!conversation.messages.length && conversation.history.length > 0 ? (
                    <div className="space-y-2.5 px-1">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                        最近会话
                      </div>
                      <div className="grid gap-2">
                        {conversation.history.slice(0, 3).map((session) => (
                          <button
                            key={session.conversationId}
                            type="button"
                            className="rounded-[18px] bg-[rgba(15,23,42,0.04)] px-3.5 py-3 text-left transition hover:bg-[rgba(15,23,42,0.075)]"
                            onClick={() => conversation.replay(session)}
                            disabled={loading || taskLoading}
                          >
                            <div className="flex items-center justify-between gap-3 text-[11px] text-[rgba(15,23,42,0.42)]">
                              <span>{formatSkillLabel(session.metadata?.skillId)}</span>
                              <span>
                                {new Date(session.generatedAt).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[13px] leading-6 text-[rgba(15,23,42,0.72)]">
                              {session.messages.findLast((message) => message.role === 'user')
                                ?.content ?? '继续当前会话'}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {currentToolCalls.length > 0 ? (
                    <div className="space-y-2.5 px-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                          本次读取
                        </div>
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 text-[11px] text-[rgba(15,23,42,0.42)] transition hover:bg-[rgba(15,23,42,0.04)] hover:text-[rgba(15,23,42,0.72)]"
                          onClick={() => setTraceExpanded((current) => !current)}
                        >
                          {traceExpanded ? '收起' : '展开'}
                        </button>
                      </div>
                      <div className="rounded-[18px] bg-[rgba(15,23,42,0.04)] px-3.5 py-3">
                        <div className="text-[13px] leading-6 text-[rgba(15,23,42,0.66)]">
                          {currentTraceSummary}
                        </div>
                      </div>
                      {traceExpanded ? (
                        <div className="grid gap-2">
                          {currentToolCalls.map((toolCall) => {
                            const tool = getJuanieToolById(toolCall.toolId);

                            return (
                              <div
                                key={`${toolCall.toolId}-${toolCall.scope}-${toolCall.riskLevel}`}
                                className="rounded-[18px] bg-[rgba(15,23,42,0.04)] px-3.5 py-3"
                              >
                                <div className="flex items-center justify-between gap-3 text-[11px] text-[rgba(15,23,42,0.42)]">
                                  <span>{formatToolScopeLabel(toolCall.scope)}</span>
                                  <span>{formatRiskLevelLabel(toolCall.riskLevel)}</span>
                                </div>
                                <div className="mt-1 text-[13px] font-medium leading-6 text-[rgba(15,23,42,0.78)]">
                                  {tool?.title ?? toolCall.toolId}
                                </div>
                                <div className="mt-1 text-[12px] leading-6 text-[rgba(15,23,42,0.54)]">
                                  {toolCall.reason ?? tool?.description ?? '读取当前对象相关上下文'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[90%] px-1 text-sm leading-7',
                          message.role === 'user'
                            ? 'rounded-[22px] rounded-br-md bg-[rgba(28,27,24,0.96)] px-4 py-3.5 text-[rgba(251,250,247,0.96)] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)]'
                            : 'text-[rgba(15,23,42,0.9)]'
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

                  {loading &&
                  !conversation.messages.some((message) => message.id === streamingMessageId) ? (
                    <div className="flex justify-start">
                      <div className="px-1 py-2 text-[rgba(15,23,42,0.42)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <div className="rounded-[16px] bg-[rgba(15,23,42,0.04)] px-3.5 py-2.5 text-sm text-[rgba(15,23,42,0.54)]">
                      {errorMessage}
                    </div>
                  ) : null}
                </div>

                <div className="bg-[linear-gradient(180deg,rgba(251,250,247,0)_0%,rgba(251,250,247,0.82)_18%,rgba(251,250,247,1)_100%)] px-4 pb-4 pt-3">
                  <div className="rounded-[26px] bg-[rgba(255,255,255,0.94)] p-3 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.12)] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur">
                    <Textarea
                      ref={composerRef}
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        requestAnimationFrame(() => {
                          if (!composerRef.current) {
                            return;
                          }

                          composerRef.current.style.height = '0px';
                          composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 220)}px`;
                        });
                      }}
                      placeholder="问当前对象"
                      className="max-h-[220px] min-h-[56px] resize-none overflow-y-auto border-0 bg-transparent px-1 py-1 text-[14px] leading-7 text-[rgba(15,23,42,0.9)] shadow-none ring-0 placeholder:text-[rgba(15,23,42,0.34)] focus-visible:ring-0 focus-visible:ring-offset-0"
                      disabled={loading || taskLoading}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void send(trimmedDraft);
                        }
                      }}
                    />
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.06)] pt-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[rgba(15,23,42,0.34)]">
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 text-[11px] tracking-[0.16em] text-[rgba(15,23,42,0.42)] transition hover:bg-[rgba(15,23,42,0.04)] hover:text-[rgba(15,23,42,0.72)]"
                          disabled={!trimmedDraft || loading || taskLoading || !config.taskEndpoint}
                          onClick={() => void runAsTask()}
                        >
                          任务
                        </button>
                        {conversation.messages.length > 0 ? (
                          <button
                            type="button"
                            className="rounded-full px-2 py-1 text-[11px] tracking-[0.16em] text-[rgba(15,23,42,0.42)] transition hover:bg-[rgba(15,23,42,0.04)] hover:text-[rgba(15,23,42,0.72)]"
                            disabled={loading || taskLoading}
                            onClick={() => conversation.reset()}
                          >
                            清空
                          </button>
                        ) : null}
                        <span>Enter</span>
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        className="h-11 w-11 rounded-full bg-[rgba(28,27,24,0.96)] text-[rgba(251,250,247,0.96)] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.34)] hover:bg-[rgba(28,27,24,0.84)]"
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
              </>
            ) : (
              <div className="flex flex-1 flex-col px-5 pb-5 pt-1">
                <div className="space-y-1.5">
                  {config.routes.map((route) => {
                    const Icon = routeIcons[route.label as keyof typeof routeIcons] ?? Folder;
                    const active = pathname === route.href || pathname.startsWith(`${route.href}/`);

                    return (
                      <button
                        key={route.href}
                        type="button"
                        onClick={() => {
                          router.push(route.href);
                          setOpen(false);
                        }}
                        className={cn(
                          'group flex min-h-[64px] items-center justify-between rounded-[20px] px-4 py-2.5 text-left transition',
                          active
                            ? 'bg-[rgba(28,27,24,0.07)] text-[rgba(15,23,42,0.92)]'
                            : 'bg-[rgba(15,23,42,0.03)] text-[rgba(15,23,42,0.82)] hover:bg-[rgba(15,23,42,0.05)]'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/84 text-[rgba(15,23,42,0.58)] shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-[14px] font-medium tracking-[-0.02em]">
                            {route.label}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <MoveRight className="h-3.5 w-3.5 text-[rgba(15,23,42,0.38)] transition group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
