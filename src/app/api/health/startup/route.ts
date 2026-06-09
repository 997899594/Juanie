import { getStartupResponse } from '@/lib/health/responses';

export async function GET() {
  return getStartupResponse();
}
