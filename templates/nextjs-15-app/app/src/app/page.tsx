import { ArrowRight, Rocket, Shield, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Welcome to <span className="text-primary">{{ appName }}</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built with Next.js 15, React Server Components, and deployed on Kubernetes
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs">Documentation</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Powered by Next.js 15 with Turbopack and React Server Components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Partial Prerendering (PPR)</li>
                <li>• Server Actions</li>
                <li>• Automatic code splitting</li>
                <li>• Edge Runtime support</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Production Ready</CardTitle>
              <CardDescription>
                Enterprise-grade security and best practices built-in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {{ - if .enableAuth }}
                <li>• NextAuth.js authentication</li>
                {{ - end }}
                {{ - if .enableDatabase }}
                <li>• PostgreSQL + Drizzle ORM</li>
                {{ - end }}
                <li>• TypeScript strict mode</li>
                <li>• Zod validation</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Rocket className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Cloud Native</CardTitle>
              <CardDescription>Deployed on Kubernetes with GitOps and auto-scaling</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Kubernetes deployment</li>
                <li>• Flux CD GitOps</li>
                <li>• Horizontal Pod Autoscaling</li>
                <li>• Health checks & monitoring</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle>Tech Stack</CardTitle>
            <CardDescription>Built with the latest and greatest technologies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">Next.js 15</div>
                <div className="text-sm text-muted-foreground">Framework</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">React 19</div>
                <div className="text-sm text-muted-foreground">UI Library</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">TypeScript</div>
                <div className="text-sm text-muted-foreground">Language</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">Tailwind CSS 4</div>
                <div className="text-sm text-muted-foreground">Styling</div>
              </div>
              {{ - if .enableDatabase }}
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">PostgreSQL</div>
                <div className="text-sm text-muted-foreground">Database</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">Drizzle ORM</div>
                <div className="text-sm text-muted-foreground">ORM</div>
              </div>
              {{ - end }}
              {{ - if .enableCache }}
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">Redis</div>
                <div className="text-sm text-muted-foreground">Cache</div>
              </div>
              {{ - end }}
              <div className="text-center p-4 border rounded-lg">
                <div className="font-semibold">Kubernetes</div>
                <div className="text-sm text-muted-foreground">Orchestration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
