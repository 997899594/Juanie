import { NextResponse } from 'next/server';
import { requirePlatformOperator } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { listDeadLetterMessages } from '@/lib/outbox/operations';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requirePlatformOperator();
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
    const resolved = url.searchParams.get('resolved') === 'true';
    const messages = await listDeadLetterMessages({ limit, resolved });
    return NextResponse.json({ messages });
  } catch (error) {
    if (isAccessError(error)) return toAccessErrorResponse(error);
    throw error;
  }
}
