import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, parseAllDocuments } from 'yaml';
import {
  ciRuntimeAssetDigests,
  ciRuntimeAssetNames,
  getCiRuntimeDescriptor,
  getGitLabCiComponentIntegrity,
  isCiRuntimeAssetName,
  readCiRuntimeAsset,
  readGitLabCiComponent,
} from '@/lib/ci/runtime-assets';

describe('versioned CI runtime assets', () => {
  it('serves only the immutable runtime allowlist', async () => {
    expect(ciRuntimeAssetNames).toEqual([
      'build-run.sh',
      'changes.mjs',
      'delivery-artifacts.sh',
      'workload-identity.sh',
    ]);
    expect(isCiRuntimeAssetName('../package.json')).toBe(false);
    expect(await readCiRuntimeAsset('build-run.sh')).toContain('JUANIE_BUILD_STATE_DIR');

    for (const asset of ciRuntimeAssetNames) {
      const content = await readCiRuntimeAsset(asset);
      expect(createHash('sha256').update(content, 'utf8').digest('hex')).toBe(
        ciRuntimeAssetDigests[asset]
      );
    }
  });

  it('publishes a valid GitLab component with matching SHA-256 integrity', async () => {
    const component = await readGitLabCiComponent();
    const integrity = await getGitLabCiComponentIntegrity();

    expect(parseAllDocuments(component).every((document) => document.errors.length === 0)).toBe(
      true
    );
    expect(integrity).toBe(
      `sha256-${createHash('sha256').update(component, 'utf8').digest('base64')}`
    );
    for (const digest of Object.values(ciRuntimeAssetDigests)) {
      expect(component).toContain(digest);
    }
  });

  it('keeps the central GitHub reusable workflow syntactically valid', async () => {
    const workflow = await readFile(
      join(process.cwd(), '.github', 'workflows', 'application-delivery.yml'),
      'utf8'
    );
    const parsed = parse(workflow) as { jobs?: Record<string, unknown> };

    expect(Object.keys(parsed.jobs ?? {})).toEqual(['plan', 'build', 'release', 'deliver']);
    for (const digest of Object.values(ciRuntimeAssetDigests)) {
      expect(workflow).toContain(digest);
    }
    expect(workflow).not.toContain('--show-error +');
    expect(workflow).not.toContain(
      'JUANIE_DELIVERABLES_FILE="$RUNNER_TEMP/juanie-deliverable.json" +'
    );
    expect(workflow).not.toContain('jq -cn +');
  });

  it('accepts only a normalized control-plane origin', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousNextAuthUrl = process.env.NEXTAUTH_URL;
    try {
      Reflect.set(process.env, 'NODE_ENV', 'development');
      Reflect.set(process.env, 'NEXTAUTH_URL', 'https://juanie.example.com/');
      expect(getCiRuntimeDescriptor().baseUrl).toBe('https://juanie.example.com');

      Reflect.set(process.env, 'NEXTAUTH_URL', 'https://juanie.example.com/control-plane');
      expect(() => getCiRuntimeDescriptor()).toThrow('origin');

      Reflect.set(process.env, 'NODE_ENV', 'production');
      Reflect.set(process.env, 'NEXTAUTH_URL', 'http://juanie.example.com');
      expect(() => getCiRuntimeDescriptor()).toThrow('HTTPS');
    } finally {
      Reflect.set(process.env, 'NODE_ENV', previousNodeEnv);
      if (previousNextAuthUrl === undefined) Reflect.deleteProperty(process.env, 'NEXTAUTH_URL');
      else Reflect.set(process.env, 'NEXTAUTH_URL', previousNextAuthUrl);
    }
  });
});
