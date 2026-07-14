import type { projects, services } from '@/lib/db/schema';
import {
  findUnresolvedRuntimeResources,
  readProjectDeliveryGraph,
} from '@/lib/delivery-graph/resources';
import { getEnvironmentVariableOverview } from '@/lib/env-vars/overview';
import { ReleaseAdmissionError } from '@/lib/releases/admission';

export async function assertExternalResourceBindingsResolved(input: {
  project: Pick<typeof projects.$inferSelect, 'id' | 'configJson'> & {
    services: Array<Pick<typeof services.$inferSelect, 'id' | 'name'>>;
  };
  environmentId: string;
}): Promise<void> {
  const graph = readProjectDeliveryGraph(input.project.configJson);
  if (!graph) return;

  const overview = await getEnvironmentVariableOverview(input.project.id, input.environmentId);
  const projectKeys = new Set(
    overview.effective
      .filter((variable) => variable.injectionType !== 'build')
      .map((variable) => variable.key)
  );
  const serviceKeysByName = new Map(
    overview.serviceOverrides.map((group) => [
      group.serviceName,
      new Set(
        group.variables
          .filter((variable) => variable.injectionType !== 'build')
          .map((variable) => variable.key)
      ),
    ])
  );
  const unresolved = findUnresolvedRuntimeResources(graph, {
    projectKeys,
    serviceKeysByName,
  });
  if (unresolved.length === 0) return;

  const details = unresolved
    .map(({ resource, missingKeys }) => `${resource.name}: ${missingKeys.join(', ')}`)
    .join('; ');
  throw new ReleaseAdmissionError(
    `发布缺少外部资源绑定变量：${details}。请在项目环境变量中补齐后重试。`
  );
}
