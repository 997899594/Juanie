import { getReadinessResponse } from '@/lib/health/responses';

export async function GET() {
  return getReadinessResponse();
}
