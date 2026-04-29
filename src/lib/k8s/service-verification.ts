export const SERVICE_VERIFY_IMAGE = 'curlimages/curl:8.7.1';

interface ServiceVerificationScriptInput {
  serviceName: string;
  port: number;
  paths: string[];
  attemptCount: number;
  sleepSeconds: number;
  requestTimeoutSeconds: number;
}

export function normalizeServiceVerificationPath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }

  return path;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildVerificationPodName(serviceName: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${serviceName}-verify-${suffix}`.replace(/[^a-z0-9-]/g, '-').slice(0, 63);
}

export function buildServiceVerificationScript(input: ServiceVerificationScriptInput): string {
  const normalizedPaths = input.paths.map(normalizeServiceVerificationPath);
  const verificationCommands = normalizedPaths.map((path) =>
    [
      `last_error=''`,
      `attempt=1`,
      `while [ "$attempt" -le ${input.attemptCount} ]; do`,
      `  if code=$(curl --silent --show-error --output /tmp/verify-body --write-out '%{http_code}' --max-time ${input.requestTimeoutSeconds} ${shellQuote(`http://${input.serviceName}:${input.port}${path}`)} 2>/tmp/verify-error); then`,
      `    if [ "$code" -lt 400 ]; then`,
      `      break`,
      `    fi`,
      `    last_error=${shellQuote(`${path} returned `)}"$code"`,
      `  else`,
      `    last_error=$(cat /tmp/verify-error 2>/dev/null || true)`,
      `    [ -n "$last_error" ] || last_error='request failed'`,
      `  fi`,
      `  if [ "$attempt" -eq ${input.attemptCount} ]; then`,
      `    echo "$last_error" >&2`,
      `    exit 1`,
      `  fi`,
      `  attempt=$((attempt + 1))`,
      `  sleep ${input.sleepSeconds}`,
      `done`,
    ].join('\n')
  );

  return ['set -eu', ...verificationCommands, 'echo verification_ok'].join('\n');
}
