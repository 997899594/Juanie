import { restateServiceNames } from '@/lib/restate/config';

export const expectedRestateServiceNames = Object.freeze(Object.values(restateServiceNames));

export interface RestateServiceCatalog {
  registeredServices: string[];
  expectedServiceCount: number;
}

interface RestateServiceEntry {
  name: string;
}

function parseServiceEntries(payload: unknown): RestateServiceEntry[] {
  if (typeof payload !== 'object' || payload === null || !('services' in payload)) {
    throw new Error('Restate returned an invalid service catalog');
  }

  const services = payload.services;
  if (
    !Array.isArray(services) ||
    services.some(
      (service) =>
        typeof service !== 'object' ||
        service === null ||
        !('name' in service) ||
        typeof service.name !== 'string' ||
        service.name.length === 0
    )
  ) {
    throw new Error('Restate returned an invalid service catalog');
  }

  return services as RestateServiceEntry[];
}

export function assertExpectedRestateServices(payload: unknown): RestateServiceCatalog {
  const registeredServices = [...new Set(parseServiceEntries(payload).map(({ name }) => name))];
  const registered = new Set(registeredServices);
  const missing = expectedRestateServiceNames.filter((name) => !registered.has(name));

  if (missing.length > 0) {
    throw new Error(`Restate is missing required services: ${missing.join(', ')}`);
  }

  return {
    registeredServices,
    expectedServiceCount: expectedRestateServiceNames.length,
  };
}

export async function verifyRestateServiceCatalog(
  adminUrl: string
): Promise<RestateServiceCatalog> {
  const response = await fetch(`${adminUrl.replace(/\/$/u, '')}/services`, {
    signal: AbortSignal.timeout(2_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Restate service catalog returned HTTP ${response.status}`);
  }

  return assertExpectedRestateServices(await response.json());
}
