import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[112px] w-full resize-y rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(246,244,239,0.95))] px-4 py-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.94)_inset,0_0_0_1px_rgba(17,17,17,0.045),0_10px_24px_rgba(55,53,47,0.04)] transition-[background-color,box-shadow,transform,color] outline-none placeholder:text-muted-foreground/58 selection:bg-primary/12 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.995),rgba(249,247,243,0.985))] hover:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_14px_28px_rgba(55,53,47,0.055)] focus-visible:-translate-y-px focus-visible:bg-white focus-visible:shadow-[0_1px_0_rgba(255,255,255,0.98)_inset,0_0_0_1px_rgba(17,17,17,0.06),0_0_0_6px_rgba(55,53,47,0.055),0_18px_34px_rgba(55,53,47,0.075)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:shadow-[0_1px_0_rgba(255,255,255,0.94)_inset,0_0_0_1px_rgba(196,85,77,0.22),0_0_0_6px_rgba(196,85,77,0.08)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
