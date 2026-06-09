import { getReadinessResponse } from '@/lib/health/dependency-checks';

export async function GET() {
  return getReadinessResponse();
}
