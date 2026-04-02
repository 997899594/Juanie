import { getLivenessResponse } from '../route';

export async function GET() {
  return getLivenessResponse();
}
