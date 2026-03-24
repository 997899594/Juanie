import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Legacy deployment trigger is removed. Use POST /api/releases.',
    },
    { status: 410 }
  );
}
