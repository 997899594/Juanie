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
          'flex h-11 w-full min-w-0 rounded-[18px] bg-[rgba(255,255,255,0.76)] px-4 py-2 text-sm text-[rgba(15,23,42,0.9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_1px_2px_rgba(15,23,42,0.02),0_12px_28px_rgba(15,23,42,0.035)] ring-1 ring-[rgba(15,23,42,0.06)] transition-[background-color,box-shadow,color,transform] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[rgba(15,23,42,0.34)] selection:bg-primary/10 hover:bg-[rgba(255,255,255,0.9)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_2px_6px_rgba(15,23,42,0.03),0_16px_32px_rgba(15,23,42,0.05)] hover:ring-[rgba(15,23,42,0.08)] focus-visible:bg-white focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_2px_8px_rgba(15,23,42,0.04),0_20px_40px_rgba(15,23,42,0.06)] focus-visible:ring-[rgba(15,23,42,0.14)] disabled:pointer-events-none disabled:opacity-45 aria-invalid:ring-[rgba(196,85,77,0.22)] aria-invalid:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(196,85,77,0.05)]',
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
