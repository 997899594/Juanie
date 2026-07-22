import { describe, expect, it } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { verifyApplicationDeliveryCapability } from '@/lib/ci/application-delivery';

const managedEnvironment = [
  'JUANIE_PUBLIC_ORIGIN',
  'JUANIE_SOURCE_REPOSITORY',
  'JUANIE_SOURCE_REVISION',
  'JUANIE_GITHUB_APP_ID',
  'JUANIE_GITHUB_APP_INSTALLATION_ID',
  'JUANIE_GITHUB_APP_PRIVATE_KEY',
] as const;
const originalEnvironment = Object.fromEntries(
  managedEnvironment.map((name) => [name, process.env[name]])
);
const originalFetch = globalThis.fetch;

function restoreEnvironment(): void {
  globalThis.fetch = originalFetch;
  for (const name of managedEnvironment) {
    const value = originalEnvironment[name];
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else Reflect.set(process.env, name, value);
  }
}

function configureApplicationDeliveryIdentity(): void {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  Reflect.set(process.env, 'JUANIE_PUBLIC_ORIGIN', 'https://juanie.art');
  Reflect.set(process.env, 'JUANIE_SOURCE_REPOSITORY', '997899594/Juanie');
  Reflect.set(process.env, 'JUANIE_SOURCE_REVISION', 'main');
  Reflect.set(process.env, 'JUANIE_GITHUB_APP_ID', '12345');
  Reflect.deleteProperty(process.env, 'JUANIE_GITHUB_APP_INSTALLATION_ID');
  Reflect.set(
    process.env,
    'JUANIE_GITHUB_APP_PRIVATE_KEY',
    privateKey.export({ format: 'pem', type: 'pkcs1' }).toString()
  );
}

describe('platform-owned application delivery capability', () => {
  it('resolves the installation and verifies the active workflow', async () => {
    try {
      configureApplicationDeliveryIdentity();
      const requests: Array<{ url: string; init?: RequestInit }> = [];
      globalThis.fetch = (async (input, init) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.endsWith('/repos/997899594/Juanie/installation')) {
          return Response.json({ id: 77 });
        }
        if (url.endsWith('/app/installations/77/access_tokens')) {
          return Response.json({ token: 'installation-token' });
        }
        if (url.endsWith('/actions/workflows/application-delivery.yml')) {
          expect(new Headers(init?.headers).get('authorization')).toBe('Bearer installation-token');
          return Response.json({
            id: 99,
            path: '.github/workflows/application-delivery.yml',
            state: 'active',
          });
        }
        return Response.json({ message: 'unexpected request' }, { status: 500 });
      }) as typeof fetch;

      expect(await verifyApplicationDeliveryCapability()).toEqual({
        repository: '997899594/Juanie',
        workflow: '.github/workflows/application-delivery.yml',
        state: 'active',
      });
      expect(requests.map((request) => request.url).length).toBe(3);
    } finally {
      restoreEnvironment();
    }
  });

  it('rejects a disabled workflow before a release can roll out', async () => {
    try {
      configureApplicationDeliveryIdentity();
      Reflect.set(process.env, 'JUANIE_GITHUB_APP_INSTALLATION_ID', '77');
      globalThis.fetch = (async (input) => {
        const url = String(input);
        if (url.endsWith('/access_tokens')) return Response.json({ token: 'installation-token' });
        return Response.json({
          id: 99,
          path: '.github/workflows/application-delivery.yml',
          state: 'disabled_manually',
        });
      }) as typeof fetch;

      let caught: unknown;
      try {
        await verifyApplicationDeliveryCapability();
      } catch (error) {
        caught = error;
      }
      expect(caught instanceof Error ? caught.message : null).toBe(
        'GitHub workflow application-delivery.yml is not active: disabled_manually'
      );
    } finally {
      restoreEnvironment();
    }
  });
});
