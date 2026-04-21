'use client';

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      closeButton
      expand={false}
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast:
            '!rounded-[22px] !border-0 !bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(246,244,239,0.98))] !text-foreground !shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.05),0_24px_56px_rgba(55,53,47,0.12)]',
          title: '!text-sm !font-semibold',
          description: '!text-sm !text-muted-foreground',
          actionButton:
            '!rounded-2xl !bg-primary !text-primary-foreground !shadow-none hover:!bg-primary/92',
          cancelButton:
            '!rounded-2xl !bg-secondary !text-secondary-foreground !shadow-none hover:!bg-secondary/92',
          closeButton:
            '!border-0 !bg-white/90 !text-muted-foreground !shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_0_0_1px_rgba(17,17,17,0.04)] hover:!bg-white hover:!text-foreground',
        },
      }}
    />
  );
}
