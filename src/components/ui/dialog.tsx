'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const dialogContentSizeClasses = {
  compact: 'sm:[--dialog-content-width:40rem] lg:[--dialog-content-width:46rem]',
  form: 'sm:[--dialog-content-width:52rem] lg:[--dialog-content-width:64rem]',
  workspace:
    'sm:[--dialog-content-width:56rem] lg:[--dialog-content-width:78rem] xl:[--dialog-content-width:92rem]',
} as const;

type DialogContentSize = keyof typeof dialogContentSizeClasses;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[rgba(28,27,24,0.18)] backdrop-blur-[8px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: DialogContentSize;
  }
>(({ className, children, size = 'compact', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 grid max-h-[88dvh] w-full gap-5 overflow-y-auto bg-[linear-gradient(180deg,rgba(252,251,249,0.995),rgba(246,244,239,0.99))] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 shadow-[0_-28px_88px_rgba(55,53,47,0.12)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:left-[50%] sm:top-[50%] sm:max-h-[90vh] sm:w-[min(calc(100vw-4rem),var(--dialog-content-width,40rem))] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[32px] sm:px-7 sm:pb-7 sm:pt-7 sm:shadow-[0_1px_0_rgba(255,255,255,0.94)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_32px_96px_rgba(55,53,47,0.16)] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]',
        dialogContentSizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,240,233,0.9))] text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.82)_inset,0_0_0_1px_rgba(17,17,17,0.04),0_12px_24px_rgba(55,53,47,0.05)] transition-[background-color,box-shadow,color,transform] hover:-translate-y-px hover:bg-white hover:text-foreground hover:shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_16px_28px_rgba(55,53,47,0.07)] focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none sm:right-5 sm:top-5">
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-xl font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm leading-6 text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
