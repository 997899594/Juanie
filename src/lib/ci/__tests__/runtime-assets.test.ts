import { describe, expect, it } from 'bun:test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  ciRuntimeAssetDigests,
  ciRuntimeAssetNames,
  getCiRuntimeDescriptor,
  isCiRuntimeAssetName,
  readCiRuntimeAsset,
} from '@/lib/ci/runtime-assets';

describe('versioned CI runtime assets', () => {
  it('serves only the immutable runtime allowlist', async () => {
    expect(ciRuntimeAssetNames).toEqual([
      'build-run.sh',
      'delivery-artifacts.sh',
      'workload-identity.sh',
    ]);
    expect(isCiRuntimeAssetName('../package.json')).toBe(false);
    expect(await readCiRuntimeAsset('build-run.sh')).toContain('JUANIE_BUILD_STATE_DIR');
    expect(await readCiRuntimeAsset('build-run.sh')).toContain('query affected');
    expect(await readCiRuntimeAsset('build-run.sh')).toContain('--target juanie-turbo-cache');
    expect(await readCiRuntimeAsset('workload-identity.sh')).toContain(
      'Juanie API %s %s returned HTTP %s'
    );

    for (const asset of ciRuntimeAssetNames) {
      const content = await readCiRuntimeAsset(asset);
      expect(createHash('sha256').update(content, 'utf8').digest('hex')).toBe(
        ciRuntimeAssetDigests[asset]
      );
    }
  });

  it('keeps the platform-owned GitHub workflow syntactically valid', async () => {
    const workflow = await readFile(
      join(process.cwd(), '.github', 'workflows', 'application-delivery.yml'),
      'utf8'
    );
    const parsed = parse(workflow) as { jobs?: Record<string, unknown> };

    expect(Object.keys(parsed.jobs ?? {})).toEqual(['plan', 'build', 'release', 'deliver']);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('workflow_call:');
    for (const digest of Object.values(ciRuntimeAssetDigests)) {
      expect(workflow).toContain(digest);
    }
    expect(workflow).not.toContain('--show-error +');
    expect(workflow).not.toContain(
      'JUANIE_DELIVERABLES_FILE="$RUNNER_TEMP/juanie-deliverable.json" +'
    );
    expect(workflow).not.toContain('jq -cn +');
    expect(workflow).toContain('build-run.sh" prepare');
    expect(workflow).toContain('baseSha=$' + '{JUANIE_BEFORE_SHA}');
    expect(workflow).toContain('Remove synthetic source history');
    expect(workflow).toContain('Restore service-scoped Turbo cache');
  });

  it('prints structured Juanie API failures from the managed shell runtime', async () => {
    const runtime = join(process.cwd(), 'templates', 'ci', 'runtime', 'v1', 'workload-identity.sh');
    const child = spawn(
      'bash',
      [
        '-c',
        `
          source "$1"
          curl() {
            local output_file=''
            while [ "$#" -gt 0 ]; do
              case "$1" in
                --output) output_file="$2"; shift 2 ;;
                *) shift ;;
              esac
            done
            printf '%s' '{"error":"Invalid build analysis request","details":["source.target"]}' > "$output_file"
            printf '%s' '400'
          }
          request_juanie_json POST https://juanie.example.test/api/build-runs/analysis '' '{}'
        `,
        'runtime-error-test',
        runtime,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });

    expect(exitCode).toBe(22);
    expect(stderr).toContain('returned HTTP 400');
    expect(stderr).toContain('Invalid build analysis request');
    expect(stderr).toContain('source.target');
  });

  it('accepts only a normalized control-plane origin', () => {
    const previousPublicOrigin = process.env.JUANIE_PUBLIC_ORIGIN;
    const previousSourceRepository = process.env.JUANIE_SOURCE_REPOSITORY;
    const previousSourceRevision = process.env.JUANIE_SOURCE_REVISION;
    try {
      Reflect.set(process.env, 'JUANIE_PUBLIC_ORIGIN', 'https://juanie.example.com/');
      Reflect.set(process.env, 'JUANIE_SOURCE_REPOSITORY', '997899594/Juanie');
      Reflect.set(process.env, 'JUANIE_SOURCE_REVISION', 'main');
      expect(getCiRuntimeDescriptor().baseUrl).toBe('https://juanie.example.com');
    } finally {
      if (previousPublicOrigin === undefined) {
        Reflect.deleteProperty(process.env, 'JUANIE_PUBLIC_ORIGIN');
      } else {
        Reflect.set(process.env, 'JUANIE_PUBLIC_ORIGIN', previousPublicOrigin);
      }
      if (previousSourceRepository === undefined) {
        Reflect.deleteProperty(process.env, 'JUANIE_SOURCE_REPOSITORY');
      } else {
        Reflect.set(process.env, 'JUANIE_SOURCE_REPOSITORY', previousSourceRepository);
      }
      if (previousSourceRevision === undefined) {
        Reflect.deleteProperty(process.env, 'JUANIE_SOURCE_REVISION');
      } else {
        Reflect.set(process.env, 'JUANIE_SOURCE_REVISION', previousSourceRevision);
      }
    }
  });
});
