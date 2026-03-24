import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Git push webhooks are no longer supported for deployments. Use /api/releases or registry webhooks with built images.',
    },
    { status: 410 }
  );
}
