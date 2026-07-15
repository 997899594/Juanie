import { NextResponse } from 'next/server';
import { isCiRuntimeAssetName, readCiRuntimeAsset } from '@/lib/ci/runtime-assets';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> }
): Promise<NextResponse> {
  const { asset } = await params;
  if (!isCiRuntimeAssetName(asset)) {
    return NextResponse.json({ error: 'CI runtime asset not found' }, { status: 404 });
  }

  const content = await readCiRuntimeAsset(asset);
  return new NextResponse(content, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': asset.endsWith('.mjs')
        ? 'text/javascript; charset=utf-8'
        : 'text/x-shellscript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
