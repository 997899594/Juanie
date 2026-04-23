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
          'flex h-11 w-full min-w-0 rounded-[18px] bg-[rgba(255,255,255,0.72)] px-4 py-2 text-sm text-[rgba(15,23,42,0.9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_10px_26px_-20px_rgba(15,23,42,0.12)] ring-1 ring-[rgba(15,23,42,0.045)] transition-[background-color,box-shadow,color,transform,ring-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[rgba(15,23,42,0.32)] selection:bg-primary/10 hover:bg-[rgba(255,255,255,0.84)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_34px_-22px_rgba(15,23,42,0.16)] hover:ring-[rgba(15,23,42,0.065)] focus-visible:-translate-y-[1px] focus-visible:bg-white focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_18px_38px_-24px_rgba(15,23,42,0.2)] focus-visible:ring-[rgba(15,23,42,0.09)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:ring-[rgba(196,85,77,0.16)] aria-invalid:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_14px_28px_-22px_rgba(196,85,77,0.12)]',
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
