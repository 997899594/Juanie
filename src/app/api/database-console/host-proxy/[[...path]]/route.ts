import { proxyDbGateConsoleHostRequest } from '@/lib/database-console/host-proxy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}

export async function HEAD(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}

export async function OPTIONS(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}

export async function POST(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}

export async function PUT(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}

export async function PATCH(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}

export async function DELETE(request: Request) {
  return proxyDbGateConsoleHostRequest(request);
}
