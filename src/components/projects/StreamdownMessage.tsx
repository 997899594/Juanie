'use client';

import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { Streamdown } from 'streamdown';
import 'katex/dist/katex.min.css';

interface StreamdownMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

function SafeStreamdown(input: StreamdownMessageProps) {
  try {
    return (
      <Streamdown
        plugins={{ code, math, mermaid, cjk }}
        isAnimating={input.isStreaming}
        className={input.className}
      >
        {input.content}
      </Streamdown>
    );
  } catch (error) {
    console.error('[Streamdown] Render error:', error);
    return <pre className={input.className}>{input.content}</pre>;
  }
}

export function StreamdownMessage(input: StreamdownMessageProps) {
  if (!input.content) {
    return null;
  }

  return (
    <div className="prose prose-sm max-w-none text-foreground prose-headings:tracking-[-0.03em] prose-p:my-2 prose-pre:rounded-2xl prose-pre:border prose-pre:border-[rgba(17,17,17,0.08)] prose-pre:bg-[rgba(255,255,255,0.72)] prose-code:text-[0.92em] prose-strong:text-foreground prose-ul:my-2 prose-ol:my-2">
      <SafeStreamdown {...input} className={input.className} />
    </div>
  );
}
