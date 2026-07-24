import { describe, expect, it } from 'bun:test';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
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

    expect(Object.keys(parsed.jobs ?? {})).toEqual([
      'plan',
      'build',
      'release',
      'deliver',
      'complete',
    ]);
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
    expect(workflow).toContain('download_juanie_source_archive');
    expect(workflow).toContain('"$JUANIE_BEFORE_SHA"');
    expect(await readCiRuntimeAsset('workload-identity.sh')).toContain(
      '--data-urlencode "baseSha=$' + '{base_sha}"'
    );
    expect(workflow).not.toContain('curl --fail --silent --show-error --get');
    expect(workflow).toContain('Remove synthetic source history');
    expect(workflow).toContain('Restore service-scoped Turbo cache');
  });

  it('atomically downloads and validates a complete source archive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'juanie-source-archive-'));
    const fixture = join(directory, 'fixture.tar.gz');
    const output = join(directory, 'source.tar.gz');
    await writeFile(fixture, gzipSync('immutable source'));

    try {
      const runtime = join(
        process.cwd(),
        'templates',
        'ci',
        'runtime',
        'v1',
        'workload-identity.sh'
      );
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
              cp "$JUANIE_ARCHIVE_FIXTURE" "$output_file"
              printf '%s' '200'
            }
            download_juanie_source_archive token "$JUANIE_ARCHIVE_OUTPUT"
          `,
          'runtime-archive-test',
          runtime,
        ],
        {
          env: {
            ...process.env,
            JUANIE_ARCHIVE_FIXTURE: fixture,
            JUANIE_ARCHIVE_OUTPUT: output,
            JUANIE_EXTERNAL_RUN_ID: 'delivery-1',
            JUANIE_PROVIDER: 'github',
            JUANIE_RELEASE_REF: 'refs/heads/main',
            JUANIE_REPOSITORY: 'acme/demo',
            JUANIE_SOURCE_SHA: 'a'.repeat(40),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });

      expect(exitCode).toBe(0);
      expect(await readFile(output)).toEqual(await readFile(fixture));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
