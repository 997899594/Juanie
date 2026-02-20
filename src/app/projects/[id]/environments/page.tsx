'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Environment {
  id: string
  name: string
  order: number
  namespace: string | null
}

export default function EnvironmentsPage() {
  const params = useParams()
  const projectId = params.id as string
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEnvironments()
  }, [projectId])

  const fetchEnvironments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/environments`)
      if (res.ok) {
        const data = await res.json()
        setEnvironments(data)
      }
    } catch (error) {
      console.error('Failed to fetch environments:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Environments</h1>
        <p className="text-muted-foreground">Manage your project environments</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {environments.map((env) => (
          <Card key={env.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">{env.name}</CardTitle>
                <Badge variant={env.namespace ? 'success' : 'warning'}>
                  {env.namespace ? 'Deployed' : 'Pending'}
                </Badge>
              </div>
              <CardDescription>Order: {env.order}</CardDescription>
            </CardHeader>
            <CardContent>
              {env.namespace ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Namespace</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">{env.namespace}</code>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Environment not yet deployed</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
