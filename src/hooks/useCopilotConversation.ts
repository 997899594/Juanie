'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CopilotSessionMetadata } from '@/lib/ai/copilot/types';

export interface CopilotConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface PersistedCopilotConversation {
  messages: CopilotConversationMessage[];
  metadata: CopilotSessionMetadata | null;
  history: CopilotConversationSnapshot[];
}

export interface CopilotConversationSnapshot {
  conversationId: string;
  generatedAt: string;
  messages: CopilotConversationMessage[];
  metadata: CopilotSessionMetadata | null;
}

function readConversation(key: string): PersistedCopilotConversation | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedCopilotConversation;
  } catch {
    return null;
  }
}

function writeConversation(key: string, value: PersistedCopilotConversation): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearConversation(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
}

export function useCopilotConversation(scopeKey: string | null) {
  const storageKey = useMemo(() => (scopeKey ? `juanie:copilot:${scopeKey}` : null), [scopeKey]);
  const [messages, setMessages] = useState<CopilotConversationMessage[]>([]);
  const [metadata, setMetadata] = useState<CopilotSessionMetadata | null>(null);
  const [history, setHistory] = useState<CopilotConversationSnapshot[]>([]);

  useEffect(() => {
    if (!storageKey) {
      setMessages([]);
      setMetadata(null);
      setHistory([]);
      return;
    }

    const persisted = readConversation(storageKey);
    setMessages(persisted?.messages ?? []);
    setMetadata(persisted?.metadata ?? null);
    setHistory(persisted?.history ?? []);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    writeConversation(storageKey, {
      messages,
      metadata,
      history,
    });
  }, [storageKey, messages, metadata, history]);

  return {
    messages,
    metadata,
    history,
    setMessages,
    setMetadata,
    replay(snapshot: CopilotConversationSnapshot) {
      setMessages(snapshot.messages);
      setMetadata(snapshot.metadata);
    },
    archiveCurrent() {
      if (!metadata || messages.length === 0) {
        return;
      }

      setHistory((current) =>
        [
          {
            conversationId: metadata.conversationId,
            generatedAt: metadata.generatedAt,
            messages,
            metadata,
          },
          ...current.filter((item) => item.conversationId !== metadata.conversationId),
        ].slice(0, 6)
      );
    },
    reset() {
      if (metadata && messages.length > 0) {
        setHistory((current) =>
          [
            {
              conversationId: metadata.conversationId,
              generatedAt: metadata.generatedAt,
              messages,
              metadata,
            },
            ...current.filter((item) => item.conversationId !== metadata.conversationId),
          ].slice(0, 6)
        );
      }

      if (storageKey) {
        clearConversation(storageKey);
      }
      setMessages([]);
      setMetadata(null);
    },
  };
}
