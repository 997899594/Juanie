import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deployments, environments, projects, teams } from '@/lib/db/schema'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params

  if (!session?.user?.id) {
    redirect('/login')
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      environments: true,
    },
  })

  if (!project) {
    redirect('/projects')
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, project.teamId),
  })

  const recentDeployments = await db.query.deployments.findMany({
    where: eq(deployments.projectId, id),
    orderBy: [desc(deployments.createdAt)],
    limit: 5,
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold">
              Juanie
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg">{project.name}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Project details and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <span className="text-sm font-medium">Status</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      project.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : project.status === 'initializing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                {project.gitRepository && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium">Repository</span>
                    <a
                      href={project.gitRepository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {project.gitRepository}
                    </a>
                  </div>
                )}
                {project.description && (
                  <div className="grid gap-2">
                    <span className="text-sm font-medium">Description</span>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Environments</CardTitle>
                <CardDescription>Deployment environments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {project.environments.map((env) => (
                    <div
                      key={env.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <span className="font-medium capitalize">{env.name}</span>
                        {env.namespace && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({env.namespace})
                          </span>
                        )}
                      </div>
                      <Link href={`/projects/${id}/deployments?env=${env.name}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{team?.name}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Deployments</CardTitle>
              </CardHeader>
              <CardContent>
                {recentDeployments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deployments yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentDeployments.map((deploy) => (
                      <div key={deploy.id} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{deploy.status}</span>
                        <span className="text-muted-foreground">
                          {deploy.createdAt ? new Date(deploy.createdAt).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Link href={`/projects/${id}/settings`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
