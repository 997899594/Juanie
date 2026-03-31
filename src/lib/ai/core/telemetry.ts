export interface AIRunTelemetryInput {
  pluginId: string;
  modelPolicy: string;
  provider: string | null;
  model: string | null;
  resourceType: string;
  resourceId: string;
  latencyMs?: number | null;
  degradedReason?: string | null;
}

export function recordAIRunTelemetry(input: AIRunTelemetryInput): void {
  console.info('[AIPluginRun]', {
    pluginId: input.pluginId,
    modelPolicy: input.modelPolicy,
    provider: input.provider,
    model: input.model,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    latencyMs: input.latencyMs ?? null,
    degradedReason: input.degradedReason ?? null,
  });
}
