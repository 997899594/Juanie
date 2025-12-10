# Troubleshooting Service

AI-powered fault diagnosis service that analyzes logs and Kubernetes events to provide root cause analysis and fix guides.

## Features

- **Log Analysis**: Analyze application logs to identify errors and issues
- **Kubernetes Event Analysis**: Analyze K8s events to diagnose cluster issues
- **Comprehensive Diagnosis**: Combined analysis of logs and events
- **Root Cause Analysis**: Identify fundamental causes, not just symptoms
- **Fix Guides**: Step-by-step instructions with commands
- **Time Estimation**: Realistic estimates for fix duration
- **Prevention Measures**: Recommendations to prevent recurrence

## Usage

### Basic Log Analysis

```typescript
import { TroubleshootingService } from './troubleshooting.service'

const service = new TroubleshootingService(aiService)

const result = await service.analyzeLogs({
  logs: [
    'ERROR: Connection refused to database',
    'WARN: Retrying connection attempt 3/5',
    'ERROR: Max retries exceeded',
  ],
  context: {
    service: 'api-gateway',
    environment: 'production',
    timeRange: {
      start: new Date('2024-01-01T10:00:00Z'),
      end: new Date('2024-01-01T10:30:00Z'),
    },
  },
})

console.log('Root Cause:', result.rootCause.rootCause)
console.log('Severity:', result.rootCause.severity)
console.log('Fix Steps:', result.fixGuide.steps.length)
console.log('Estimated Time:', result.timeEstimate.average, 'minutes')
```

### Kubernetes Event Analysis

```typescript
const result = await service.analyzeK8sEvents({
  events: [
    {
      type: 'Warning',
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      timestamp: new Date(),
      involvedObject: {
        kind: 'Pod',
        name: 'api-gateway-7d8f9c5b6-xyz',
        namespace: 'production',
      },
    },
    {
      type: 'Warning',
      reason: 'Failed',
      message: 'Error: ImagePullBackOff',
      timestamp: new Date(),
      involvedObject: {
        kind: 'Pod',
        name: 'api-gateway-7d8f9c5b6-xyz',
        namespace: 'production',
      },
    },
  ],
  context: {
    namespace: 'production',
    resource: 'api-gateway',
  },
})
```

### Comprehensive Diagnosis

```typescript
const result = await service.comprehensiveDiagnosis(
  {
    logs: applicationLogs,
    context: { service: 'api-gateway' },
  },
  {
    events: k8sEvents,
    context: { namespace: 'production' },
  },
)
```

## Result Structure

### Root Cause Analysis

```typescript
{
  summary: "Database connection failure causing API downtime",
  rootCause: "PostgreSQL service is not accessible from the application pod",
  contributingFactors: [
    "Network policy blocking traffic",
    "Database credentials expired"
  ],
  affectedComponents: ["api-gateway", "database"],
  severity: "critical"
}
```

### Fix Guide

```typescript
{
  title: "How to Fix Database Connection Issue",
  overview: "Restore database connectivity by updating network policies and credentials",
  prerequisites: [
    "kubectl access to production namespace",
    "Database admin credentials"
  ],
  steps: [
    {
      step: 1,
      title: "Verify database service status",
      description: "Check if the database service is running and accessible",
      command: "kubectl get svc postgres -n production",
      verification: "Service should show CLUSTER-IP and PORT(S)",
      estimatedTime: "2 minutes"
    },
    {
      step: 2,
      title: "Check network policies",
      description: "Verify network policies allow traffic from api-gateway to database",
      command: "kubectl get networkpolicies -n production",
      verification: "Policy should allow ingress from api-gateway",
      estimatedTime: "5 minutes"
    }
  ],
  rollbackPlan: "Revert network policy changes if connectivity issues persist",
  preventionMeasures: [
    "Implement health checks for database connectivity",
    "Set up alerts for connection failures",
    "Use connection pooling with retry logic"
  ]
}
```

### Time Estimate

```typescript
{
  minimum: 15,      // minutes
  maximum: 60,      // minutes
  average: 30,      // minutes
  confidence: "high",
  factors: [
    "Network policy changes require cluster admin access",
    "Credential rotation may need approval",
    "Testing connectivity adds 10-15 minutes"
  ]
}
```

## AI Configuration

The service uses Claude 3.5 Sonnet by default for accurate analysis. You can customize:

```typescript
const result = await service.analyzeLogs(options, {
  provider: 'openai',
  model: 'gpt-4-turbo',
  temperature: 0.2,
  maxTokens: 4000,
})
```

## Best Practices

1. **Provide Context**: Include service name, environment, and time range
2. **Limit Log Volume**: Service automatically limits to 100 log lines
3. **Recent Events**: Focus on recent events (last 1-2 hours)
4. **Combine Sources**: Use comprehensive diagnosis for complex issues
5. **Verify Steps**: Always verify each fix step before proceeding

## Error Handling

The service throws errors for:
- Invalid AI responses
- Missing required fields
- Malformed JSON output
- AI service failures

Always wrap calls in try-catch:

```typescript
try {
  const result = await service.analyzeLogs(options)
  // Handle result
} catch (error) {
  console.error('Troubleshooting failed:', error)
  // Fallback to manual diagnosis
}
```

## Requirements Validation

This service validates:

- **Requirement 9.1**: Analyzes application logs ✓
- **Requirement 9.2**: Analyzes Kubernetes events ✓
- **Requirement 9.3**: Provides root cause analysis ✓
- **Requirement 9.4**: Provides step-by-step fix guides ✓
- **Requirement 9.5**: Estimates fix time ✓

## Related Services

- `AIService`: Core AI completion service
- `PromptService`: Template management for common issues
- `UsageTrackingService`: Track troubleshooting API usage
- `AICacheService`: Cache analysis results for similar issues
