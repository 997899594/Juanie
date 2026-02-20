export type NotificationEvent =
  | 'deployment.started'
  | 'deployment.completed'
  | 'deployment.failed'
  | 'rollback.completed'
  | 'health_check.failed'

export interface NotificationPayload {
  event: NotificationEvent
  projectId: string
  projectName: string
  environment: string
  version?: string
  commitSha?: string
  message?: string
  timestamp: string
}

export async function sendWebhookNotification(
  webhookUrl: string,
  secret: string,
  payload: NotificationPayload,
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret,
        'X-Webhook-Event': payload.event,
      },
      body: JSON.stringify(payload),
    })

    return response.ok
  } catch (error) {
    console.error('Failed to send webhook notification:', error)
    return false
  }
}

export async function notifyDeploymentStarted(
  projectId: string,
  projectName: string,
  environment: string,
  version?: string,
) {
  const payload: NotificationPayload = {
    event: 'deployment.started',
    projectId,
    projectName,
    environment,
    version,
    timestamp: new Date().toISOString(),
  }

  return payload
}

export async function notifyDeploymentCompleted(
  projectId: string,
  projectName: string,
  environment: string,
  version?: string,
  commitSha?: string,
) {
  const payload: NotificationPayload = {
    event: 'deployment.completed',
    projectId,
    projectName,
    environment,
    version,
    commitSha,
    timestamp: new Date().toISOString(),
  }

  return payload
}

export async function notifyDeploymentFailed(
  projectId: string,
  projectName: string,
  environment: string,
  message?: string,
) {
  const payload: NotificationPayload = {
    event: 'deployment.failed',
    projectId,
    projectName,
    environment,
    message,
    timestamp: new Date().toISOString(),
  }

  return payload
}
