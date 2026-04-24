import { describe, expect, it } from 'bun:test';
import { buildSchemaRunnerJob } from '@/lib/schema-management/schema-runner-job';

describe('schema runner job', () => {
  it('builds inspect jobs with the inspect command', () => {
    const job = buildSchemaRunnerJob({
      namespace: 'juanie',
      jobName: 'schema-inspect-test',
      image: 'ghcr.io/example/juanie:schema-runner',
      mode: 'inspect',
      env: [
        {
          name: 'SCHEMA_INSPECT_PROJECT_ID',
          value: 'project-1',
        },
      ],
      labels: {
        'juanie.dev/schema-inspect': 'true',
      },
    });

    expect(job.spec?.template.spec?.containers?.[0]?.command).toEqual([
      './schema-runner',
      'inspect',
    ]);
    expect(job.spec?.template.spec?.containers?.[0]?.env?.[0]).toEqual({
      name: 'SCHEMA_INSPECT_PROJECT_ID',
      value: 'project-1',
    });
    expect(job.metadata?.labels?.['juanie.dev/schema-inspect']).toBe('true');
  });

  it('keeps redis wait container enabled by default', () => {
    const job = buildSchemaRunnerJob({
      namespace: 'juanie',
      jobName: 'schema-repair-test',
      image: 'ghcr.io/example/juanie:schema-runner',
      mode: 'schema-repair',
    });

    expect(job.spec?.template.spec?.initContainers?.map((container) => container.name)).toEqual([
      'wait-for-postgres',
      'wait-for-redis',
    ]);
    expect(job.spec?.template.spec?.containers?.[0]?.command).toEqual(['./schema-runner']);
  });

  it('builds migration jobs with the migration command', () => {
    const job = buildSchemaRunnerJob({
      namespace: 'juanie',
      jobName: 'migration-run-test',
      image: 'ghcr.io/example/juanie:schema-runner',
      mode: 'migration',
      env: [
        {
          name: 'MIGRATION_RUN_ID',
          value: 'run-1',
        },
      ],
    });

    expect(job.spec?.template.spec?.containers?.[0]?.command).toEqual([
      './schema-runner',
      'migration',
    ]);
    expect(job.spec?.template.spec?.containers?.[0]?.env?.[0]).toEqual({
      name: 'MIGRATION_RUN_ID',
      value: 'run-1',
    });
  });
});
