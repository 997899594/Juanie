import { describe, expect, it, mock } from 'bun:test';
import { provisionBytebaseDatabaseConsole } from '@/lib/database-console/bytebase-provisioning';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

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

      if (
        requestUrl.includes('/v1/projects/') ||
        requestUrl.includes('/v1/environments/') ||
        requestUrl.includes('/v1/instances/') ||
        requestUrl.includes('/v1/idps/')
      ) {
        return jsonResponse({}, method === 'GET' ? 404 : 200);
      }

      return jsonResponse({});
    });

    const result = await provisionBytebaseDatabaseConsole(
      {
        project: { id: '4979986a-1192-476e-9dbd-a96d50a61077', name: 'nexusnote' },
        environment: { id: '190d3ba0-be6d-4f1c-98dc-a222c70a9308', name: 'production' },
        database: {
          id: '219a1b86-a655-4f46-b4bb-4b66f7f59ade',
          name: 'primary',
          type: 'postgresql',
          connectionString: 'postgres://app:secret@primary-rw.namespace.svc.cluster.local:5432/app',
        },
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
    expect(result.url).toContain(
      'instance=instances%2Fjuanie-219a1b86-a655-4f46-b4bb-4b66f7f59ade'
    );
    expect(result.url).toContain('database=app');
    expect(calls.map((call) => call.method)).toEqual([
      'POST',
      'GET',
      'POST',
      'GET',
      'POST',
      'GET',
      'POST',
      'GET',
      'POST',
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

      if (
        requestUrl.includes('/v1/projects/') ||
        requestUrl.includes('/v1/environments/') ||
        requestUrl.includes('/v1/instances/') ||
        requestUrl.includes('/v1/idps/')
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

      if (
        requestUrl.includes('/v1/projects/') ||
        requestUrl.includes('/v1/environments/') ||
        requestUrl.includes('/v1/instances/')
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
});
