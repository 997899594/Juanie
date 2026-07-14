import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformOperator } from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import { OutboxOperationConflictError, replayDeadLetterMessage } from '@/lib/outbox/operations';
import { isUuid } from '@/lib/uuid';

const replaySchema = z.object({ note: z.string().trim().max(1000).optional() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await requirePlatformOperator();
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    const parsed = replaySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid replay request' }, { status: 400 });
    }
    const message = await replayDeadLetterMessage({
      messageId: id,
      operatorUserId: session.user.id,
      note: parsed.data.note,
    });
    return NextResponse.json({ message }, { status: 202 });
  } catch (error) {
    if (isAccessError(error)) return toAccessErrorResponse(error);
    if (error instanceof OutboxOperationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
