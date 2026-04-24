import { NextResponse } from 'next/server';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';

export function toAIRouteErrorResponse(
  error: unknown,
  fallbackMessage = 'AI 请求失败'
): NextResponse {
  if (isAccessError(error)) {
    return toAccessErrorResponse(error);
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: 500 }
  );
}
