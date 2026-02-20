'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDeployments } from '@/hooks/useDeployments'

const statusColors: Record<string, string> = {
  pending: 'warning',
  deploying: 'default',
  syncing: 'default',
  deployed: 'success',
  failed: 'destructive',
  rolled_back: 'destructive',
}

export default function DeploymentsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const envFilter = searchParams.get('env')

  const { deployments, isConnected, error } = useDeployments({
    projectId,
  })

  const filteredDeployments = envFilter
    ? deployments.filter((d) => d.environmentName === envFilter)
    : deployments

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deployments</h2>
          <p className="text-sm text-muted-foreground">Real-time deployment status</p>
        </div>
        <Badge variant={isConnected ? 'success' : 'destructive'}>
          {isConnected ? 'Live' : 'Offline'}
        </Badge>
      </div>

      {error && <div className="p-3 text-sm bg-yellow-100 text-yellow-800 rounded-md">{error}</div>}

      <div className="space-y-2">
        {filteredDeployments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No deployments yet. Push to your repository to trigger a deployment.
            </CardContent>
          </Card>
        ) : (
          filteredDeployments.map((deployment) => (
            <Card key={deployment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{deployment.environmentName}</CardTitle>
                    <Badge variant={statusColors[deployment.status] as any}>
                      {deployment.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">v{deployment.version}</span>
                </div>
              </CardHeader>
              <CardContent>
                {deployment.commitSha && (
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {deployment.commitSha.slice(0, 7)}
                  </code>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {deployment.createdAt ? new Date(deployment.createdAt).toLocaleString() : '-'}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
