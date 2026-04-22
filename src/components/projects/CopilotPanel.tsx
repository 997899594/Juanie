'use client';

import { Loader2, MessageSquareText, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { StreamdownMessage } from './StreamdownMessage';

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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
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

    const assistantMessageId = buildMessageId();

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

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Copilot 暂时不可用'
        );
      }

      const provider = response.headers.get('X-AI-Provider');
      const model = response.headers.get('X-AI-Model');
      const suggestionHeader = response.headers.get('X-Copilot-Suggestions');

      if (suggestionHeader) {
        try {
          const parsedSuggestions = JSON.parse(decodeURIComponent(suggestionHeader)) as string[];
          if (Array.isArray(parsedSuggestions) && parsedSuggestions.length > 0) {
            setSuggestions(parsedSuggestions);
          }
        } catch {}
      }

      setStreamingMessageId(assistantMessageId);
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          meta: provider && model ? `${provider} · ${model}` : 'Juanie AI',
        },
      ]);

      if (!response.body) {
        throw new Error('Copilot 响应流不可用');
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
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: streamedContent,
                }
              : message
          )
        );
      }

      streamedContent += decoder.decode();
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: streamedContent,
              }
            : message
        )
      );
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
      setErrorMessage(error instanceof Error ? error.message : 'Copilot 暂时不可用');
    } finally {
      setStreamingMessageId(null);
      setLoading(false);
    }
  };

  const emptyHint = useMemo(
    () => (loading ? '正在整理当前上下文…' : '从下面选一个问题，或者直接问。'),
    [loading]
  );

  return (
    <aside className="xl:sticky xl:top-24">
      <section className="overflow-hidden rounded-[28px] bg-[rgba(251,250,247,0.96)] shadow-[0_24px_60px_rgba(15,23,42,0.06)] ring-1 ring-[rgba(15,23,42,0.06)] backdrop-blur">
        <div className="px-6 pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(17,24,39,0.04)] text-[rgba(17,24,39,0.72)]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(17,24,39,0.42)]">
                    Copilot
                  </div>
                  <div className="text-[15px] font-semibold tracking-[-0.03em] text-[rgba(15,23,42,0.96)]">
                    {input.title}
                  </div>
                </div>
              </div>
              <div className="max-w-[28rem] text-[13px] leading-6 text-[rgba(15,23,42,0.58)]">
                {input.description}
              </div>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border-0 bg-[rgba(17,24,39,0.05)] px-3 py-1 text-[11px] font-medium text-[rgba(15,23,42,0.56)] shadow-none"
            >
              当前对象
            </Badge>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div
            ref={viewportRef}
            className="max-h-[48vh] space-y-4 overflow-y-auto pr-1 xl:max-h-[54vh]"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'rounded-[22px] px-4 py-3.5 transition-colors',
                  message.role === 'assistant'
                    ? 'bg-[rgba(15,23,42,0.035)]'
                    : 'ml-8 bg-[rgba(15,23,42,0.06)]'
                )}
              >
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(15,23,42,0.42)]">
                  {message.role === 'assistant' ? (
                    <>
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Juanie
                    </>
                  ) : (
                    '你'
                  )}
                </div>
                {message.role === 'assistant' ? (
                  <div className="mt-2 text-sm leading-7 text-[rgba(15,23,42,0.88)]">
                    <StreamdownMessage
                      content={message.content}
                      isStreaming={streamingMessageId === message.id}
                    />
                  </div>
                ) : (
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[rgba(15,23,42,0.88)]">
                    {message.content}
                  </div>
                )}
                {message.meta ? (
                  <div className="mt-3 text-[11px] text-[rgba(15,23,42,0.42)]">{message.meta}</div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="rounded-[22px] bg-[rgba(15,23,42,0.035)] px-4 py-3.5">
                <div className="flex items-center gap-2 text-sm text-[rgba(15,23,42,0.5)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {emptyHint}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full bg-[rgba(15,23,42,0.045)] px-3.5 py-1.5 text-left text-[12px] font-medium text-[rgba(15,23,42,0.72)] transition hover:bg-[rgba(15,23,42,0.08)]"
                onClick={() => send(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[24px] bg-[rgba(255,255,255,0.72)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-[rgba(15,23,42,0.06)] transition duration-200 focus-within:bg-white focus-within:ring-[rgba(15,23,42,0.12)] focus-within:shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
            <div className="space-y-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="直接问当前对象最关键的事。"
                className="min-h-[140px] resize-none border-0 bg-transparent px-1 py-1 text-[14px] leading-7 text-[rgba(15,23,42,0.9)] shadow-none ring-0 placeholder:text-[rgba(15,23,42,0.34)] focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(trimmedDraft);
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.06)] px-1 pt-3">
                <div className="text-[12px] text-[rgba(15,23,42,0.42)]">{emptyHint}</div>
                <Button
                  type="button"
                  className="h-10 rounded-full bg-[rgba(15,23,42,0.92)] px-5 text-white shadow-none hover:bg-[rgba(15,23,42,0.82)]"
                  disabled={!canSubmit}
                  onClick={() => send(trimmedDraft)}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  发送
                </Button>
              </div>
              {errorMessage ? (
                <div className="px-1 text-sm text-[rgba(185,28,28,0.88)]">{errorMessage}</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}
