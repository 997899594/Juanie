import type { DeliveryGraph, DeliveryGraphResource } from '@/lib/delivery-graph/model';

export interface DeliveryResourceBindings {
  projectKeys: Set<string>;
  serviceKeysByName: Map<string, Set<string>>;
}

export interface UnresolvedDeliveryResource {
  resource: DeliveryGraphResource;
  consumer: string;
  missingKeys: string[];
}

export function readProjectDeliveryGraph(configJson: unknown): DeliveryGraph | null {
  if (!configJson || typeof configJson !== 'object' || !('deliveryGraph' in configJson)) {
    return null;
  }
  const graph = (configJson as { deliveryGraph?: unknown }).deliveryGraph;
  if (!graph || typeof graph !== 'object') return null;
  const candidate = graph as Partial<DeliveryGraph>;
  return candidate.version === 1 && Array.isArray(candidate.resources)
    ? (candidate as DeliveryGraph)
    : null;
}

export function findUnresolvedRuntimeResources(
  graph: DeliveryGraph,
  bindings: DeliveryResourceBindings
): UnresolvedDeliveryResource[] {
  const workloadNameById = new Map(graph.workloads.map((workload) => [workload.id, workload.name]));
  const unresolved: UnresolvedDeliveryResource[] = [];

  for (const resource of graph.resources) {
    if (resource.management !== 'external' || resource.injection !== 'runtime') continue;
    const requiredKeys = [
      ...new Set([...resource.requiredEnvironmentKeys, ...resource.secretEnvironmentKeys]),
    ];
    for (const consumer of resource.consumers.length > 0 ? resource.consumers : ['project']) {
      const serviceName = workloadNameById.get(consumer);
      const serviceKeys = serviceName
        ? (bindings.serviceKeysByName.get(serviceName) ?? new Set<string>())
        : new Set<string>();
      const missingKeys = requiredKeys.filter(
        (key) => !bindings.projectKeys.has(key) && !serviceKeys.has(key)
      );
      if (missingKeys.length > 0) unresolved.push({ resource, consumer, missingKeys });
    }
  }
  return unresolved;
}
