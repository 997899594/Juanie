import { NextResponse } from 'next/server';
import { readGitLabCiComponent } from '@/lib/ci/runtime-assets';

export async function GET(): Promise<NextResponse> {
  return new NextResponse(await readGitLabCiComponent(), {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'application/yaml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
