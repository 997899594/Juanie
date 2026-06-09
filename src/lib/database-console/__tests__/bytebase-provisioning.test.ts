import { describe, expect, it, mock } from 'bun:test';
import { provisionBytebaseDatabaseConsole } from '@/lib/database-console/bytebase-provisioning';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const target = {
  project: { id: '4979986a-1192-476e-9dbd-a96d50a61077', name: 'nexusnote' },
  environment: { id: '190d3ba0-be6d-4f1c-98dc-a222c70a9308', name: 'production' },
  database: {
    id: '219a1b86-a655-4f46-b4bb-4b66f7f59ade',
    name: 'primary',
    type: 'postgresql',
    connectionString: 'postgres://app:secret@primary-rw.namespace.svc.cluster.local:5432/app',
  },
  actor: {
    email: 'Alice@Juanie.Art',
    name: 'Alice',
  },
};

const config = {
  enabled: true,
  workspaceUrl: 'https://bytebase.juanie.art',
  apiToken: null,
  serviceAccountEmail: 'service@juanie.art',
  serviceAccountKey: 'service-key',
  bootstrapEmail: null,
  bootstrapPassword: null,
  bootstrapTitle: 'Juanie Platform',
  oidcClientId: 'bytebase',
  oidcClientSecret: 'oidc-secret',
  oidcIssuer: 'https://juanie.art',
};

describe('provisionBytebaseDatabaseConsole', () => {
  it('creates the Bytebase context before returning a console URL', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: requestUrl, method, body });

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (requestUrl.includes('/v1/projects/') && requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({ bindings: [], etag: 'etag-1' });
      }

      if (requestUrl.includes('/v1/projects/') && requestUrl.endsWith(':setIamPolicy')) {
        return jsonResponse({});
      }

      if (requestUrl.includes('/v1/users/alice%40juanie.art')) {
        return jsonResponse({}, method === 'GET' ? 404 : 200);
      }

      if (
        requestUrl.includes('/v1/projects/') ||
        requestUrl.includes('/v1/instances/') ||
        requestUrl.includes('/v1/idps/')
      ) {
        return jsonResponse({}, method === 'GET' ? 404 : 200);
      }

      return jsonResponse({});
    });

    const result = await provisionBytebaseDatabaseConsole(target, config, {
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.url).toContain('https://bytebase.juanie.art/sql-editor');
    expect(result.url).toContain(
      'instance=instances%2Fjuanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade'
    );
    expect(result.url).toContain('database=app');
    const createProjectCall = calls.find(
      (call) => call.method === 'POST' && call.url.includes('/v1/projects?projectId=')
    );
    expect(createProjectCall?.body).toEqual({ title: 'nexusnote' });
    const createInstanceCall = calls.find(
      (call) => call.method === 'POST' && call.url.includes('/v1/instances?instanceId=')
    );
    expect(
      createInstanceCall?.body &&
        typeof createInstanceCall.body === 'object' &&
        'environment' in createInstanceCall.body
        ? createInstanceCall.body.environment
        : null
    ).toBe('environments/prod');
    expect(
      createInstanceCall?.body &&
        typeof createInstanceCall.body === 'object' &&
        'activation' in createInstanceCall.body
        ? createInstanceCall.body.activation
        : null
    ).toBe(false);
    expect(
      createInstanceCall?.body &&
        typeof createInstanceCall.body === 'object' &&
        'dataSources' in createInstanceCall.body &&
        Array.isArray(createInstanceCall.body.dataSources)
        ? createInstanceCall.body.dataSources[0]?.port
        : null
    ).toBe('5432');
    const syncInstanceCall = calls.find(
      (call) => call.method === 'POST' && call.url.endsWith(':sync')
    );
    expect(syncInstanceCall?.body).toEqual({ enableFullSync: false });
    const createUserCall = calls.find(
      (call) => call.method === 'POST' && call.url.endsWith('/v1/users')
    );
    expect(
      createUserCall?.body &&
        typeof createUserCall.body === 'object' &&
        'email' in createUserCall.body
        ? createUserCall.body.email
        : null
    ).toBe('alice@juanie.art');
    const setIamPolicyCall = calls.find(
      (call) => call.method === 'POST' && call.url.endsWith(':setIamPolicy')
    );
    expect(setIamPolicyCall?.body).toEqual({
      policy: {
        bindings: [
          {
            role: 'roles/sqlEditorUser',
            members: ['user:alice@juanie.art'],
            condition: {
              expression:
                'resource.database == "instances/juanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade/databases/app"',
              title: 'Juanie SQL Editor access',
              description: 'Grant SQL Editor access for the selected Juanie database.',
            },
          },
        ],
        etag: 'etag-1',
      },
      etag: 'etag-1',
    });
    expect(calls.map((call) => call.method)).toEqual([
      'POST',
      'GET',
      'POST',
      'GET',
      'POST',
      'GET',
      'POST',
      'POST',
      'GET',
      'POST',
      'GET',
      'POST',
    ]);
  });

  it('bootstraps the first Bytebase admin when login is not available', async () => {
    const calls: string[] = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      calls.push(requestUrl);

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ code: 16, message: 'invalid email or password' }, 401);
      }

      if (requestUrl.endsWith('/v1/auth/signup')) {
        return jsonResponse({ token: 'bootstrap-token' });
      }

      if (requestUrl.includes('/v1/projects/') && requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({ bindings: [] });
      }

      if (
        requestUrl.includes('/v1/projects/') ||
        requestUrl.includes('/v1/instances/') ||
        requestUrl.includes('/v1/idps/') ||
        requestUrl.includes('/v1/users/')
      ) {
        return jsonResponse({}, init?.method === 'GET' ? 404 : 200);
      }

      return jsonResponse({});
    });

    await provisionBytebaseDatabaseConsole(
      {
        project: { id: 'project-1', name: 'nexusnote' },
        environment: { id: 'env-1', name: 'production' },
        database: {
          id: 'database-1',
          name: 'primary',
          type: 'postgresql',
          connectionString: 'postgres://app:secret@primary-rw.namespace.svc.cluster.local:5432/app',
        },
        actor: target.actor,
      },
      {
        enabled: true,
        workspaceUrl: 'https://bytebase.juanie.art',
        apiToken: null,
        serviceAccountEmail: 'service@juanie.art',
        serviceAccountKey: 'service-key',
        bootstrapEmail: 'platform@juanie.art',
        bootstrapPassword: 'bootstrap-secret',
        bootstrapTitle: 'Juanie Platform',
        oidcClientId: 'bytebase',
        oidcClientSecret: 'oidc-secret',
        oidcIssuer: 'https://juanie.art',
      },
      { fetchFn: fetchFn as unknown as typeof fetch }
    );

    expect(calls[0]).toBe('https://bytebase.juanie.art/v1/auth/login');
    expect(calls[1]).toBe('https://bytebase.juanie.art/v1/auth/signup');
  });

  it('maps non-production Juanie environments to the Bytebase test environment', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: requestUrl, method, body });

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({ bindings: [] });
      }

      return jsonResponse({}, method === 'GET' ? 404 : 200);
    });

    await provisionBytebaseDatabaseConsole(
      {
        ...target,
        environment: { id: 'staging-env-id', name: 'staging', isProduction: false },
      },
      config,
      { fetchFn: fetchFn as unknown as typeof fetch }
    );

    const createInstanceCall = calls.find(
      (call) => call.method === 'POST' && call.url.includes('/v1/instances?instanceId=')
    );
    expect(
      createInstanceCall?.body &&
        typeof createInstanceCall.body === 'object' &&
        'environment' in createInstanceCall.body
        ? createInstanceCall.body.environment
        : null
    ).toBe('environments/test');
  });

  it('creates a Bytebase instance when Bytebase reports missing instances as 500', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: requestUrl, method, body });

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (method === 'GET' && requestUrl.includes('/v1/instances/')) {
        return jsonResponse(
          {
            code: 13,
            message:
              'failed to populate raw resources instance "instances/juanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade" not found',
          },
          500
        );
      }

      if (requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({ bindings: [] });
      }

      return jsonResponse({}, method === 'GET' ? 404 : 200);
    });

    await provisionBytebaseDatabaseConsole(target, config, {
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(
      calls.some((call) => call.method === 'POST' && call.url.includes('/v1/instances?instanceId='))
    ).toBe(true);
  });

  it('does not block console provisioning when SSO provider management is forbidden', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';
      calls.push({ url: requestUrl, method });

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (requestUrl.endsWith('/v1/idps/juanie')) {
        return jsonResponse({ message: 'permission denied' }, 403);
      }

      if (requestUrl.includes('/v1/projects/') && requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({ bindings: [] });
      }

      if (
        requestUrl.includes('/v1/projects/') ||
        requestUrl.includes('/v1/instances/') ||
        requestUrl.includes('/v1/users/')
      ) {
        return jsonResponse({}, method === 'GET' ? 404 : 200);
      }

      return jsonResponse({});
    });

    const result = await provisionBytebaseDatabaseConsole(
      {
        project: { id: 'project-1', name: 'nexusnote' },
        environment: { id: 'env-1', name: 'production' },
        database: {
          id: 'database-1',
          name: 'primary',
          type: 'postgresql',
          connectionString: 'postgres://app:secret@primary-rw.namespace.svc.cluster.local:5432/app',
        },
        actor: target.actor,
      },
      {
        enabled: true,
        workspaceUrl: 'https://bytebase.juanie.art',
        apiToken: null,
        serviceAccountEmail: 'service@juanie.art',
        serviceAccountKey: 'service-key',
        bootstrapEmail: null,
        bootstrapPassword: null,
        bootstrapTitle: 'Juanie Platform',
        oidcClientId: 'bytebase',
        oidcClientSecret: 'oidc-secret',
        oidcIssuer: 'https://juanie.art',
      },
      { fetchFn: fetchFn as unknown as typeof fetch }
    );

    expect(result.url).toContain('https://bytebase.juanie.art/sql-editor');
    expect(calls.some((call) => call.url.endsWith('/v1/idps/juanie'))).toBe(true);
    expect(calls.some((call) => call.url.includes('/v1/projects/'))).toBe(true);
  });

  it('includes Bytebase response details when project creation fails', async () => {
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (requestUrl.includes('/v1/idps/')) {
        return jsonResponse({}, method === 'GET' ? 404 : 200);
      }

      if (requestUrl.includes('/v1/projects/') && method === 'GET') {
        return jsonResponse({}, 404);
      }

      if (requestUrl.includes('/v1/projects?projectId=')) {
        return jsonResponse({ message: 'unknown field "key"' }, 400);
      }

      return jsonResponse({});
    });

    let error: unknown;
    try {
      await provisionBytebaseDatabaseConsole(
        {
          project: { id: 'project-1', name: 'nexusnote' },
          environment: { id: 'env-1', name: 'production' },
          database: {
            id: 'database-1',
            name: 'primary',
            type: 'postgresql',
            connectionString:
              'postgres://app:secret@primary-rw.namespace.svc.cluster.local:5432/app',
          },
          actor: target.actor,
        },
        {
          enabled: true,
          workspaceUrl: 'https://bytebase.juanie.art',
          apiToken: null,
          serviceAccountEmail: 'service@juanie.art',
          serviceAccountKey: 'service-key',
          bootstrapEmail: null,
          bootstrapPassword: null,
          bootstrapTitle: 'Juanie Platform',
          oidcClientId: 'bytebase',
          oidcClientSecret: 'oidc-secret',
          oidcIssuer: 'https://juanie.art',
        },
        { fetchFn: fetchFn as unknown as typeof fetch }
      );
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error instanceof Error).toBe(true);
    expect(error instanceof Error ? error.message : String(error)).toBe(
      '创建 Bytebase project 失败：400：unknown field "key"'
    );
  });

  it('adds the actor to an existing SQL Editor IAM binding without widening access', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: requestUrl, method, body });

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({
          bindings: [
            {
              role: 'roles/sqlEditorUser',
              members: ['user:bob@juanie.art'],
              condition: {
                expression:
                  'resource.database == "instances/juanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade/databases/app"',
              },
            },
          ],
        });
      }

      return jsonResponse({});
    });

    await provisionBytebaseDatabaseConsole(target, config, {
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const setIamPolicyCall = calls.find(
      (call) => call.method === 'POST' && call.url.endsWith(':setIamPolicy')
    );

    expect(
      setIamPolicyCall?.body &&
        typeof setIamPolicyCall.body === 'object' &&
        'policy' in setIamPolicyCall.body
        ? setIamPolicyCall.body.policy
        : null
    ).toEqual({
      bindings: [
        {
          role: 'roles/sqlEditorUser',
          members: ['user:bob@juanie.art', 'user:alice@juanie.art'],
          condition: {
            expression:
              'resource.database == "instances/juanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade/databases/app"',
          },
        },
      ],
    });
  });

  it('does not update Bytebase IAM when the actor already has database-scoped SQL Editor access', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchFn = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      const method = init?.method ?? 'GET';
      calls.push({ url: requestUrl, method });

      if (requestUrl.endsWith('/v1/auth/login')) {
        return jsonResponse({ token: 'token-1' });
      }

      if (requestUrl.endsWith(':getIamPolicy')) {
        return jsonResponse({
          bindings: [
            {
              role: 'roles/sqlEditorUser',
              members: ['user:alice@juanie.art'],
              condition: {
                expression:
                  'resource.database == "instances/juanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade/databases/app"',
              },
            },
          ],
        });
      }

      return jsonResponse({});
    });

    await provisionBytebaseDatabaseConsole(target, config, {
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(calls.some((call) => call.url.endsWith(':setIamPolicy'))).toBe(false);
  });

  it('fails before provisioning when the actor has no email', async () => {
    let fetchCallCount = 0;
    const fetchFn = mock(async () => {
      fetchCallCount += 1;
      return jsonResponse({ token: 'token-1' });
    });

    let error: unknown;
    try {
      await provisionBytebaseDatabaseConsole(
        {
          ...target,
          actor: { email: null, name: null },
        },
        config,
        { fetchFn: fetchFn as unknown as typeof fetch }
      );
    } catch (caughtError) {
      error = caughtError;
    }

    expect(fetchCallCount).toBe(0);
    expect(error instanceof Error ? error.message : String(error)).toBe(
      '当前用户缺少邮箱，不能配置 Bytebase SQL Editor 权限'
    );
  });
});
