import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[112px] w-full resize-y rounded-[18px] bg-[rgba(255,255,255,0.78)] px-4 py-3 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_0_0_1px_rgba(17,17,17,0.035),0_6px_18px_rgba(55,53,47,0.025)] transition-[background-color,box-shadow,color] outline-none placeholder:text-muted-foreground/52 selection:bg-primary/10 hover:bg-[rgba(255,255,255,0.9)] hover:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_10px_22px_rgba(55,53,47,0.04)] focus-visible:bg-white focus-visible:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_0_0_4px_rgba(55,53,47,0.035),0_12px_28px_rgba(55,53,47,0.05)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(196,85,77,0.2),0_0_0_4px_rgba(196,85,77,0.06)]',
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
