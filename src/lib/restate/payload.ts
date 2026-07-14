import * as restate from '@restatedev/restate-sdk';

export function readDurableCommandString(
  payload: Record<string, unknown>,
  field: string,
  fallback?: string
): string {
  const value = payload[field];
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (fallback) {
    return fallback;
  }
  throw new restate.TerminalError(`Durable command payload is missing ${field}`);
}
