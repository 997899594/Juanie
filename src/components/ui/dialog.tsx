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
  compact: 'sm:[--dialog-content-width:38rem] lg:[--dialog-content-width:42rem]',
  form: 'sm:[--dialog-content-width:44rem] lg:[--dialog-content-width:52rem]',
  workspace:
    'sm:[--dialog-content-width:64rem] lg:[--dialog-content-width:78rem] xl:[--dialog-content-width:88rem]',
} as const;

type DialogContentSize = keyof typeof dialogContentSizeClasses;

const dialogContentLayoutClasses = {
  bare: '',
  default:
    'grid max-h-[92dvh] gap-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 sm:max-h-[88dvh] sm:px-7 sm:pb-7 sm:pt-7',
  form: 'flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[86dvh]',
  workspace:
    'flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[min(88dvh,46rem)] sm:max-h-[88dvh]',
} as const;

type DialogContentLayout = keyof typeof dialogContentLayoutClasses;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[rgba(28,27,24,0.28)] backdrop-blur-[10px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
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
    layout?: DialogContentLayout;
  }
>(({ className, children, size = 'compact', layout = 'default', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 w-full bg-[rgba(251,250,247,0.995)] shadow-[0_-28px_88px_rgba(15,23,42,0.14)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:left-[50%] sm:top-[50%] sm:w-[min(calc(100vw-3rem),var(--dialog-content-width,40rem))] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[34px] sm:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.045),0_34px_96px_rgba(55,53,47,0.18)] sm:ring-1 sm:ring-[rgba(15,23,42,0.055)] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]',
        dialogContentLayoutClasses[layout],
        dialogContentSizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(15,23,42,0.04)] text-[rgba(15,23,42,0.46)] shadow-none transition-[background-color,color,transform] hover:-translate-y-px hover:bg-[rgba(15,23,42,0.07)] hover:text-[rgba(15,23,42,0.74)] focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none sm:right-5 sm:top-5">
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

type DialogChromeProps = React.HTMLAttributes<HTMLDivElement> & {
  chrome?: boolean;
};

const DialogHeader = ({ className, chrome = false, ...props }: DialogChromeProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 text-center sm:text-left',
      chrome && 'shrink-0 px-5 py-5 pr-16 sm:px-7 sm:py-6',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7 sm:py-5',
      className
    )}
    {...props}
  />
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = ({ className, chrome = false, ...props }: DialogChromeProps) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end',
      chrome &&
        'console-divider-top shrink-0 bg-[#fbfaf7] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-7 sm:pb-4',
      className
    )}
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
  DialogBody,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
