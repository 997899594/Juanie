import { getLivenessResponse } from '@/lib/health/probes';

export async function GET() {
  return getLivenessResponse();
}
