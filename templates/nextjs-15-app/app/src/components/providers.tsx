'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

{
  -
  if
  .enableAuth
}

import { SessionProvider } from 'next-auth/react'

{
  ;-end
}

import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    {{- if .enableAuth }
}
;<SessionProvider>
  {{ - end }}
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  </QueryClientProvider>
  {{ - if .enableAuth }}
</SessionProvider>
{
  ;-end
}
)
}
