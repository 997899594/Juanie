import { NextResponse } from 'next/server';
import { getOidcDiscovery } from '@/lib/oidc/provider';

export async function GET() {
  return NextResponse.json(getOidcDiscovery());
}
