'use client';

import { SessionProvider } from 'next-auth/react';
import { AppLayout } from '@/components/layout';
import { Toaster } from '@/components/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppLayout>{children}</AppLayout>
      <Toaster />
    </SessionProvider>
  );
}
