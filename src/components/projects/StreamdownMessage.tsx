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
    <div className="prose prose-sm max-w-none text-[rgba(15,23,42,0.88)] prose-headings:mb-2 prose-headings:mt-5 prose-headings:font-semibold prose-headings:tracking-[-0.03em] prose-h1:text-[1.18rem] prose-h2:text-[1.02rem] prose-h3:text-[0.94rem] prose-p:my-2 prose-p:leading-7 prose-p:text-[rgba(15,23,42,0.82)] prose-a:text-[rgba(15,23,42,0.82)] prose-a:no-underline hover:prose-a:text-[rgba(15,23,42,0.96)] prose-strong:font-semibold prose-strong:text-[rgba(15,23,42,0.96)] prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:pl-1 prose-li:marker:text-[rgba(15,23,42,0.3)] prose-hr:my-5 prose-hr:border-[rgba(15,23,42,0.08)] prose-code:rounded-md prose-code:bg-[rgba(15,23,42,0.06)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.88em] prose-code:font-medium prose-code:text-[rgba(15,23,42,0.84)] prose-pre:my-4 prose-pre:rounded-[20px] prose-pre:border prose-pre:border-[rgba(255,255,255,0.08)] prose-pre:bg-[rgba(28,27,24,0.96)] prose-pre:px-4 prose-pre:py-3.5 prose-pre:text-[rgba(248,246,240,0.92)] prose-pre:shadow-[0_20px_44px_-30px_rgba(15,23,42,0.3)] prose-blockquote:border-l-[2px] prose-blockquote:border-[rgba(15,23,42,0.12)] prose-blockquote:pl-4 prose-blockquote:text-[rgba(15,23,42,0.56)]">
      <SafeStreamdown {...input} className={input.className} />
    </div>
  );
}
