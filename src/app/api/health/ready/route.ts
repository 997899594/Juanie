import { getReadinessResponse } from '../route';

export async function GET() {
  return getReadinessResponse();
}
