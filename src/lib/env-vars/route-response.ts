import { NextResponse } from 'next/server';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { isEnvVarControlError } from '@/lib/env-vars/control-service';

export function toEnvVarRouteErrorResponse(
  error: unknown,
  fallbackMessage = 'Environment variable request failed'
): NextResponse {
  if (isAccessError(error)) {
    return toAccessErrorResponse(error);
  }

  if (isEnvVarControlError(error)) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details,
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : fallbackMessage,
    },
    { status: 500 }
  );
}
