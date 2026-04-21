import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/12 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(55,53,47,0.06)] hover:bg-primary/95 hover:shadow-[0_8px_22px_rgba(55,53,47,0.08)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[0_6px_18px_rgba(196,85,77,0.14)] hover:bg-destructive/95 hover:shadow-[0_8px_22px_rgba(196,85,77,0.18)]',
        outline:
          'bg-[rgba(255,255,255,0.72)] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.82)_inset,0_0_0_1px_rgba(17,17,17,0.035),0_6px_16px_rgba(55,53,47,0.025)] hover:bg-[rgba(255,255,255,0.88)] hover:text-foreground',
        secondary:
          'bg-[rgba(248,246,242,0.9)] text-secondary-foreground shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_6px_16px_rgba(55,53,47,0.02)] hover:bg-[rgba(243,240,233,0.96)]',
        ghost:
          'text-muted-foreground shadow-none hover:bg-[rgba(255,255,255,0.72)] hover:text-foreground',
        link: 'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-xl px-3 text-xs',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
