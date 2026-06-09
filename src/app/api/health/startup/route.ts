import { getStartupResponse } from '@/lib/health/probes';

export async function GET() {
  return getStartupResponse();
}
