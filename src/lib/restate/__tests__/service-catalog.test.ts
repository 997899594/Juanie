import { describe, expect, it } from 'bun:test';
import {
  assertExpectedRestateServices,
  expectedRestateServiceNames,
} from '@/lib/restate/service-catalog';

describe('Restate service catalog', () => {
  it('requires every platform workflow while allowing unrelated registered services', () => {
    const catalog = assertExpectedRestateServices({
      services: [...expectedRestateServiceNames, 'AnotherService'].map((name) => ({ name })),
    });

    expect(catalog).toEqual({
      registeredServices: [...expectedRestateServiceNames, 'AnotherService'],
      expectedServiceCount: 8,
    });
  });

  it('reports every missing platform workflow', () => {
    expect(() =>
      assertExpectedRestateServices({
        services: expectedRestateServiceNames
          .filter((name) => !['SchemaRepairWorkflow', 'SourceDeliveryWorkflow'].includes(name))
          .map((name) => ({ name })),
      })
    ).toThrow('Restate is missing required services: SchemaRepairWorkflow, SourceDeliveryWorkflow');
  });

  it('rejects malformed Restate responses', () => {
    expect(() => assertExpectedRestateServices({ services: [{ revision: 1 }] })).toThrow(
      'Restate returned an invalid service catalog'
    );
  });
});
