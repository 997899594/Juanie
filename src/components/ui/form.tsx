'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const FormSection = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('ui-floating space-y-6 px-5 py-5 sm:px-6 sm:py-6', className)}
      {...props}
    />
  )
);
FormSection.displayName = 'FormSection';

const FormField = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2.5', className)} {...props} />
  )
);
FormField.displayName = 'FormField';

const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => (
  <Label ref={ref} className={cn('text-sm font-medium text-foreground', className)} {...props} />
));
FormLabel.displayName = 'FormLabel';

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs leading-5 text-muted-foreground', className)} {...props} />
));
FormDescription.displayName = 'FormDescription';

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('min-h-5 text-sm leading-5 text-destructive', className)} {...props} />
));
FormMessage.displayName = 'FormMessage';

const FormRow = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('grid gap-4 sm:grid-cols-2', className)} {...props} />
  )
);
FormRow.displayName = 'FormRow';

export { FormDescription, FormField, FormLabel, FormMessage, FormRow, FormSection };
