'use client';

import { SessionProvider } from 'next-auth/react';
import { AppLayout } from '@/components/layout';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppLayout>{children}</AppLayout>
    </SessionProvider>
  );
}
