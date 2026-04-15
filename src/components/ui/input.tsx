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
          'flex h-11 w-full min-w-0 rounded-2xl border border-black/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(250,248,244,0.93))] px-4 py-2 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_0_0_1px_rgba(255,255,255,0.42)_inset,0_8px_20px_rgba(55,53,47,0.035)] transition-[border-color,background-color,box-shadow,transform,color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/68 selection:bg-primary/12 hover:border-black/10 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(251,249,246,0.96))] hover:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(255,255,255,0.5)_inset,0_12px_26px_rgba(55,53,47,0.05)] focus-visible:-translate-y-px focus-visible:border-black/14 focus-visible:bg-white focus-visible:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_0_0_1px_rgba(255,255,255,0.54)_inset,0_0_0_4px_rgba(47,45,40,0.06),0_18px_34px_rgba(55,53,47,0.08)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive/35 aria-invalid:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(255,255,255,0.42)_inset,0_0_0_4px_rgba(196,85,77,0.09)]',
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
