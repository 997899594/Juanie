import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth'

export default async function ProjectsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const response = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/projects`,
    {
      headers: {
        cookie: `next-auth.session-token=${session}`,
      },
    },
  )

  const projects = response.ok ? await response.json() : []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold">
              Juanie
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg">Projects</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.user?.email}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Projects</h1>
          <Link href="/projects/new">
            <Button>New Project</Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>Create your first project to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/projects/new">
                <Button className="w-full">Create Project</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((item: any) => (
              <Link key={item.project.id} href={`/projects/${item.project.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.project.name}</CardTitle>
                    <CardDescription>{item.teamName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.project.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : item.project.status === 'initializing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.project.status}
                      </span>
                      {item.project.gitRepository && (
                        <span className="text-xs text-muted-foreground">
                          {item.project.gitRepository.split('/').slice(-2).join('/')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
