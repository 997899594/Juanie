import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Next.js App',
  description: 'Built with Next.js 15 and deployed on Kubernetes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  )
}
