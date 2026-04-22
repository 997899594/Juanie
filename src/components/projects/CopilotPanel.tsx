'use client';

import { Loader2, MessageSquareText, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface CopilotPanelProps {
  title: string;
  description: string;
  endpoint: string;
  initialPrompts: string[];
  introMessage: string;
}

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: string | null;
}

interface CopilotReplyPayload {
  message: string;
  suggestions: string[];
  provider: string | null;
  model: string | null;
  generatedAt: string;
}

function buildMessageId(): string {
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CopilotPanel(input: CopilotPanelProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: buildMessageId(),
      role: 'assistant',
      content: input.introMessage,
      meta: '已接入当前对象上下文',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(input.initialPrompts);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  });

  const trimmedDraft = draft.trim();
  const canSubmit = trimmedDraft.length > 0 && !loading;

  const send = async (question: string) => {
    const content = question.trim();
    if (!content || loading) {
      return;
    }

    const nextMessages: CopilotMessage[] = [
      ...messages,
      {
        id: buildMessageId(),
        role: 'user',
        content,
      },
    ];

    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(input.endpoint, {
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

      const data = (await response.json().catch(() => null)) as
        | CopilotReplyPayload
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Copilot 暂时不可用'
        );
      }

      const reply = data as CopilotReplyPayload;
      setMessages((current) => [
        ...current,
        {
          id: buildMessageId(),
          role: 'assistant',
          content: reply.message,
          meta: reply.provider && reply.model ? `${reply.provider} · ${reply.model}` : 'Juanie AI',
        },
      ]);
      setSuggestions(reply.suggestions);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Copilot 暂时不可用');
    } finally {
      setLoading(false);
    }
  };

  const emptyHint = useMemo(
    () => (loading ? '正在整理当前上下文…' : '从下面选一个问题，或者直接问。'),
    [loading]
  );

  return (
    <aside className="xl:sticky xl:top-24">
      <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.95))] shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_22px_52px_rgba(55,53,47,0.08)]">
        <div className="border-b border-[rgba(17,17,17,0.06)] px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[rgba(244,240,232,0.92)] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Copilot
                  </div>
                  <div className="text-base font-semibold tracking-[-0.03em] text-foreground">
                    {input.title}
                  </div>
                </div>
              </div>
              <div className="text-sm leading-6 text-muted-foreground">{input.description}</div>
            </div>
            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
              对象内
            </Badge>
          </div>
        </div>

        <div className="px-5 py-4">
          <div
            ref={viewportRef}
            className="max-h-[48vh] space-y-3 overflow-y-auto pr-1 xl:max-h-[54vh]"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'rounded-[18px] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]',
                  message.role === 'assistant'
                    ? 'bg-[rgba(243,240,233,0.72)]'
                    : 'bg-[rgba(251,250,247,0.96)]'
                )}
              >
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {message.role === 'assistant' ? (
                    <>
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Juanie
                    </>
                  ) : (
                    '你'
                  )}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {message.content}
                </div>
                {message.meta ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">{message.meta}</div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="rounded-[18px] bg-[rgba(243,240,233,0.72)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {emptyHint}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full bg-[rgba(244,240,232,0.88)] px-3 py-1.5 text-left text-xs text-foreground shadow-[0_1px_0_rgba(255,255,255,0.78)_inset] transition hover:bg-white"
                onClick={() => send(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="直接问当前对象。只问这个环境 / 这次发布最有价值的事。"
              className="min-h-[136px] resize-none"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(trimmedDraft);
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">{emptyHint}</div>
              <Button
                type="button"
                className="h-10 rounded-full px-5"
                disabled={!canSubmit}
                onClick={() => send(trimmedDraft)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                发送
              </Button>
            </div>
            {errorMessage ? <div className="text-sm text-destructive">{errorMessage}</div> : null}
          </div>
        </div>
      </section>
    </aside>
  );
}
