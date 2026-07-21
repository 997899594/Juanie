import { describe, expect, it } from 'bun:test';
import {
  controlPlaneReadModelNames,
  runControlPlaneReadModelSmoke,
} from '@/lib/db/control-plane-read-model-smoke';
import { verifyControlPlaneReleaseGate } from '@/lib/db/control-plane-release-gate';

describe('control-plane read-model release gate', () => {
  it('executes every representative read model in stable order', async () => {
    const executed: string[] = [];

    await runControlPlaneReadModelSmoke(async (name) => {
      executed.push(name);
    });

    expect(executed).toEqual([...controlPlaneReadModelNames]);
  });

  it('reports the failed read model without exposing query results', async () => {
    let caught: unknown;
    try {
      await runControlPlaneReadModelSmoke(async (name) => {
        if (name === 'release-migration-plans') throw new Error('relation does not exist');
      });
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof Error ? caught.message : null).toBe(
      'Control-plane read-model smoke failed at release-migration-plans: relation does not exist'
    );
  });

  it('never runs application queries when the schema contract fails', async () => {
    const execution: string[] = [];

    let caught: unknown;
    try {
      await verifyControlPlaneReleaseGate('postgresql://control-plane', {
        assertSchemaContract: async () => {
          execution.push('schema');
          throw new Error('schema mismatch');
        },
        runReadModelSmoke: async () => {
          execution.push('read-model');
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof Error ? caught.message : null).toBe('schema mismatch');
    expect(execution).toEqual(['schema']);
  });
});
