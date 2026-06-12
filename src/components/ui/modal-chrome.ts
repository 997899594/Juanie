export const modalOverlayClassName =
  'fixed inset-0 z-50 bg-[rgba(28,27,24,0.26)] backdrop-blur-[9px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

export const modalSheetClassName =
  'fixed inset-x-0 bottom-0 z-50 w-full bg-[rgba(251,250,247,0.995)] shadow-[0_-28px_88px_rgba(15,23,42,0.14)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[32px] sm:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(17,17,17,0.045),0_34px_96px_rgba(55,53,47,0.18)] sm:ring-1 sm:ring-[rgba(15,23,42,0.055)] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]';

export const modalHeaderClassName = 'flex flex-col gap-2 text-center sm:text-left';

export const modalFooterClassName = 'flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end';
