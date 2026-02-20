'use client'

import { useCallback, useEffect, useState } from 'react'

interface Deployment {
  id: string
  status: string
  version: string
  commitSha: string
  environmentName: string
  createdAt: string
}

interface UseDeploymentsOptions {
  projectId: string
  onDeployment?: (deployment: Deployment) => void
}

export function useDeployments({ projectId, onDeployment }: UseDeploymentsOptions) {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return

    const eventSource = new EventSource(`/api/events/deployments?projectId=${projectId}`)

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'connected') {
          console.log('SSE connected')
        } else if (data.type === 'deployment') {
          setDeployments((prev) => {
            const exists = prev.find((d) => d.id === data.data.id)
            if (exists) return prev
            return [data.data, ...prev]
          })
          onDeployment?.(data.data)
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      setError('Connection lost. Reconnecting...')
      eventSource.close()
      setTimeout(() => {
        if (!eventSource.readyState) {
        }
      }, 3000)
    }

    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [projectId, onDeployment])

  const addDeployment = useCallback((deployment: Deployment) => {
    setDeployments((prev) => [deployment, ...prev])
  }, [])

  return {
    deployments,
    isConnected,
    error,
    addDeployment,
  }
}
