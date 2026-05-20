import { NextResponse } from 'next/server';
import { getOidcJwks } from '@/lib/oidc/provider';

export async function GET() {
  return NextResponse.json(getOidcJwks());
}
