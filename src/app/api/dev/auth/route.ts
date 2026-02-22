import { NextResponse } from 'next/server';
import { getOrCreateDevUser } from '@/lib/auth';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only' }, { status: 403 });
  }

  const devUser = await getOrCreateDevUser();

  return NextResponse.json({
    user: devUser,
    message: 'Dev user created/retrieved. Use this ID for development.',
  });
}
