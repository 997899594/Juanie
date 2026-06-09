import { proxyDbGateRequest } from '@/lib/database-console/proxy-route';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; dbId: string }> }
) {
  return proxyDbGateRequest(request, await context.params);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; dbId: string }> }
) {
  return proxyDbGateRequest(request, await context.params);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; dbId: string }> }
) {
  return proxyDbGateRequest(request, await context.params);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; dbId: string }> }
) {
  return proxyDbGateRequest(request, await context.params);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; dbId: string }> }
) {
  return proxyDbGateRequest(request, await context.params);
}
