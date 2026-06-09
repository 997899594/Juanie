import { getHealthResponse } from '@/lib/health/responses';

export async function GET() {
  return getHealthResponse();
}
