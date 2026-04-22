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
    <div className="prose prose-sm max-w-none text-[rgba(15,23,42,0.88)] prose-headings:mb-2 prose-headings:mt-4 prose-headings:font-semibold prose-headings:tracking-[-0.03em] prose-p:my-2 prose-p:text-[rgba(15,23,42,0.82)] prose-strong:text-[rgba(15,23,42,0.96)] prose-ul:my-2 prose-ol:my-2 prose-li:marker:text-[rgba(15,23,42,0.35)] prose-code:rounded prose-code:bg-[rgba(15,23,42,0.06)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:text-[rgba(15,23,42,0.84)] prose-pre:rounded-[18px] prose-pre:border-0 prose-pre:bg-[rgba(15,23,42,0.94)] prose-pre:shadow-none prose-blockquote:border-l-[2px] prose-blockquote:border-[rgba(15,23,42,0.16)] prose-blockquote:text-[rgba(15,23,42,0.58)]">
      <SafeStreamdown {...input} className={input.className} />
    </div>
  );
}
