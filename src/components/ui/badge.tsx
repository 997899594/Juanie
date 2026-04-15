import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/94',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[0_1px_2px_rgba(55,53,47,0.03)] hover:bg-secondary/92',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/94',
        outline: 'ui-control text-muted-foreground',
        success:
          'bg-[rgba(79,127,100,0.14)] text-[rgb(79,127,100)] hover:bg-[rgba(79,127,100,0.14)]',
        warning:
          'bg-[rgba(159,122,75,0.14)] text-[rgb(159,122,75)] hover:bg-[rgba(159,122,75,0.14)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
