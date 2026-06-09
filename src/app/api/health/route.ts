import { getHealthResponse } from '@/lib/health/dependency-checks';

export async function GET() {
  return getHealthResponse();
}
