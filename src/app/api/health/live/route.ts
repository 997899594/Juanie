import { getLivenessResponse } from '@/lib/health/responses';

export async function GET() {
  return getLivenessResponse();
}
