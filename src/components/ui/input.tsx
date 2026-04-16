'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        data-slot="input"
        type={type}
        className={cn(
          'flex h-11 w-full min-w-0 rounded-2xl border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(247,245,241,0.96))] px-4 py-2 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.94)_inset,0_0_0_1px_rgba(255,255,255,0.34)_inset,0_6px_18px_rgba(55,53,47,0.028)] transition-[border-color,background-color,box-shadow,transform,color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/58 selection:bg-primary/12 hover:border-black/8 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.995),rgba(249,247,243,0.985))] hover:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_0_0_1px_rgba(255,255,255,0.42)_inset,0_10px_24px_rgba(55,53,47,0.04)] focus-visible:-translate-y-px focus-visible:border-black/10 focus-visible:bg-white focus-visible:shadow-[0_1px_0_rgba(255,255,255,0.98)_inset,0_0_0_1px_rgba(255,255,255,0.52)_inset,0_0_0_3px_rgba(28,27,24,0.045),0_16px_32px_rgba(55,53,47,0.065)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive/28 aria-invalid:shadow-[0_1px_0_rgba(255,255,255,0.94)_inset,0_0_0_1px_rgba(255,255,255,0.34)_inset,0_0_0_3px_rgba(196,85,77,0.08)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
