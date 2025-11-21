import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

{
  -
  if
  .enableAnalytics
}

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

{
  ;-end
}

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{ .appName }}',
  description: 'Built with Next.js 15 and deployed on Kubernetes',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:{{ .port }}'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        {{ - if .enableAnalytics }}
        <Analytics />
        <SpeedInsights />
        {{ - end }}
      </body>
    </html>
  )
}
