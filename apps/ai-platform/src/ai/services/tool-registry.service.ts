import { Injectable } from '@nestjs/common'

@Injectable()
export class ToolRegistryService {
  /**
   * Get all available tools for AI model
   * TODO: Implement real tools with proper AI SDK tool() API (Tasks 4.2-4.4)
   * Note: Placeholder implementation - will be replaced with actual tool definitions
   */
  getTools() {
    // Placeholder - will be implemented with proper AI SDK tool() API
    return {}
  }

  /**
   * Get tool descriptions for system prompt
   */
  getToolDescriptions(): string {
    return `
Available Tools:
TODO: Add real tools:
- showClusterDashboard: Display K8s cluster status
- showDeploymentDiff: Show deployment YAML diff
- showDiagnosticTree: Display diagnostic tree for alerts
`
  }

  /**
   * Execute a tool by name
   * TODO: Implement proper tool execution with error handling
   * Note: In the latest AI SDK, tools are executed automatically by streamText
   */
  async executeTool(toolName: string, _args: Record<string, unknown>): Promise<unknown> {
    throw new Error(`Tool execution not yet implemented: ${toolName}`)
  }
}
