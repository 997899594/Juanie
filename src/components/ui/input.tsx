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
          'flex h-11 w-full min-w-0 rounded-[18px] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm text-foreground shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_0_0_1px_rgba(17,17,17,0.035),0_6px_18px_rgba(55,53,47,0.025)] transition-[background-color,box-shadow,color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/52 selection:bg-primary/10 hover:bg-[rgba(255,255,255,0.9)] hover:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_10px_22px_rgba(55,53,47,0.04)] focus-visible:bg-white focus-visible:shadow-[0_1px_0_rgba(255,255,255,0.96)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_0_0_4px_rgba(55,53,47,0.035),0_12px_28px_rgba(55,53,47,0.05)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(196,85,77,0.2),0_0_0_4px_rgba(196,85,77,0.06)]',
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
