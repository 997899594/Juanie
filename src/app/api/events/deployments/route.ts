import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deployments, environments, projects } from '@/lib/db/schema'

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')

  if (!projectId) {
    return new Response('Project ID required', { status: 400 })
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  if (!project) {
    return new Response('Project not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      sendEvent({ type: 'connected', timestamp: Date.now() })

      let lastDeploymentId: string | null = null
      let isActive = true

      const checkDeployments = async () => {
        if (!isActive) return

        const recentDeployments = await db
          .select({
            id: deployments.id,
            status: deployments.status,
            version: deployments.version,
            commitSha: deployments.commitSha,
            environmentId: deployments.environmentId,
            createdAt: deployments.createdAt,
          })
          .from(deployments)
          .where(eq(deployments.projectId, projectId))
          .orderBy(desc(deployments.createdAt))
          .limit(1)

        if (recentDeployments.length > 0) {
          const latest = recentDeployments[0]

          if (lastDeploymentId !== latest.id) {
            lastDeploymentId = latest.id

            const env = await db.query.environments.findFirst({
              where: eq(environments.id, latest.environmentId),
            })

            sendEvent({
              type: 'deployment',
              data: {
                ...latest,
                environmentName: env?.name,
              },
            })
          }
        }
      }

      const interval = setInterval(checkDeployments, 3000)

      request.signal.addEventListener('abort', () => {
        isActive = false
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
