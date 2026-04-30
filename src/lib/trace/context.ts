import crypto from 'node:crypto';

const traceIdPattern = /^[a-f0-9]{32}$/;

export interface TraceContextInput {
  traceId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  releaseId?: string | null;
  deploymentId?: string | null;
  migrationRunId?: string | null;
  jobId?: string | number | null;
  queue?: string | null;
}

export interface TraceLogFields {
  [key: string]: string | undefined;
  traceId: string;
  traceparent: string;
  projectId?: string;
  environmentId?: string;
  releaseId?: string;
  deploymentId?: string;
  migrationRunId?: string;
  jobId?: string;
  queue?: string;
}

function normalizeTraceSeed(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replaceAll('-', '').toLowerCase();
  return traceIdPattern.test(normalized) && normalized !== '00000000000000000000000000000000'
    ? normalized
    : null;
}

export function createTraceId(seed?: string | null): string {
  const normalized = normalizeTraceSeed(seed);
  if (normalized) {
    return normalized;
  }

  const source = seed ?? crypto.randomUUID();
  const traceId = crypto.createHash('sha256').update(source).digest('hex').slice(0, 32);
  return traceId === '00000000000000000000000000000000'
    ? crypto.randomBytes(16).toString('hex')
    : traceId;
}

export function createSpanId(seed?: string | null): string {
  const source = seed ?? crypto.randomUUID();
  const spanId = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
  return spanId === '0000000000000000' ? crypto.randomBytes(8).toString('hex') : spanId;
}

export function buildTraceParent(traceId: string, spanSeed?: string | null): string {
  return `00-${createTraceId(traceId)}-${createSpanId(spanSeed ?? traceId)}-01`;
}

function putIfPresent(
  target: Record<string, string | undefined>,
  key: string,
  value: string | number | null | undefined
) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  target[key] = String(value);
}

export function buildTraceLogFields(input: TraceContextInput): TraceLogFields {
  const traceId = createTraceId(
    input.traceId ??
      input.releaseId ??
      input.deploymentId ??
      input.migrationRunId ??
      input.projectId ??
      null
  );
  const fields: TraceLogFields = {
    traceId,
    traceparent: buildTraceParent(traceId, input.jobId ? String(input.jobId) : undefined),
  };

  putIfPresent(fields, 'projectId', input.projectId);
  putIfPresent(fields, 'environmentId', input.environmentId);
  putIfPresent(fields, 'releaseId', input.releaseId);
  putIfPresent(fields, 'deploymentId', input.deploymentId);
  putIfPresent(fields, 'migrationRunId', input.migrationRunId);
  putIfPresent(fields, 'jobId', input.jobId);
  putIfPresent(fields, 'queue', input.queue);

  return fields;
}
