import { describe, expect, it } from 'bun:test';
import { databases } from '@/lib/db/schema';
import { getServiceBindingConfigs, resolveDatabaseForBinding } from '@/lib/migrations/resolver';

describe('migration resolver binding selection', () => {
  const databaseList = [
    {
      id: 'db_service_primary',
      serviceId: 'svc_web',
      name: 'primary',
      type: 'postgresql',
      role: 'primary',
    },
    {
      id: 'db_service_readonly',
      serviceId: 'svc_web',
      name: 'readonly',
      type: 'postgresql',
      role: 'readonly',
    },
    {
      id: 'db_project_primary',
      serviceId: null,
      name: 'shared-primary',
      type: 'postgresql',
      role: 'primary',
    },
  ] as Array<typeof databases.$inferSelect>;

  it('prefers service-level exact binding matches', () => {
    const resolved = resolveDatabaseForBinding(
      {
        binding: 'primary',
        migrate: {
          tool: 'drizzle',
          workingDirectory: '.',
          command: 'bun run db:migrate',
        },
      },
      'svc_web',
      databaseList
    );

    expect(resolved?.database.id).toBe('db_service_primary');
    expect(resolved?.resolution.strategy).toBe('binding_name');
  });

  it('uses selector matching when role or type is provided', () => {
    const resolved = resolveDatabaseForBinding(
      {
        role: 'readonly',
        type: 'postgresql',
        migrate: {
          tool: 'drizzle',
          workingDirectory: '.',
          command: 'bun run db:migrate',
        },
      },
      'svc_web',
      databaseList
    );

    expect(resolved?.database.id).toBe('db_service_readonly');
    expect(resolved?.resolution.strategy).toBe('selector_match');
  });

  it('falls back to service primary when no explicit selector is given', () => {
    const resolved = resolveDatabaseForBinding(
      {
        migrate: {
          tool: 'drizzle',
          workingDirectory: '.',
          command: 'bun run db:migrate',
        },
      },
      'svc_web',
      databaseList
    );

    expect(resolved?.database.id).toBe('db_service_primary');
    expect(resolved?.resolution.strategy).toBe('service_primary');
  });

  it('falls back to the project primary when the service has no direct database', () => {
    const resolved = resolveDatabaseForBinding(
      {
        migrate: {
          tool: 'drizzle',
          workingDirectory: '.',
          command: 'bun run db:migrate',
        },
      },
      'svc_worker',
      databaseList
    );

    expect(resolved?.database.id).toBe('db_project_primary');
    expect(resolved?.resolution.strategy).toBe('implicit_primary');
  });

  it('prefers database-level bindings over service-level migrate shorthand', () => {
    const configs = getServiceBindingConfigs({
      migrate: {
        tool: 'drizzle',
        workingDirectory: '.',
        command: 'bun run db:migrate',
      },
      databases: [
        {
          role: 'primary',
          migrate: {
            tool: 'drizzle',
            workingDirectory: '.',
            command: 'bun run db:migrate',
          },
        },
      ],
    });

    expect(configs.length).toBe(1);
    expect(configs[0]?.role).toBe('primary');
  });
});
