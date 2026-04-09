import { NextResponse } from 'next/server';
import {
  getProjectAccessOrThrow,
  getProjectEnvironmentOrThrow,
  requireSession,
} from '@/lib/api/access';
import { isAccessError, toAccessErrorResponse } from '@/lib/api/errors';
import {
  deleteConfigMap,
  deleteSecret,
  getConfigMaps,
  getK8sClient,
  getSecrets,
  upsertConfigMap,
  upsertSecret,
} from '@/lib/k8s';
import { canManageConfigObjects, canReadProjectRuntime } from '@/lib/policies/runtime-access';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('type') || 'configmaps';
    const environmentId = url.searchParams.get('env');

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    if (!canReadProjectRuntime(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const environment = await getProjectEnvironmentOrThrow(id, environmentId);
    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    getK8sClient();
    let data: unknown;

    switch (resourceType) {
      case 'configmaps':
        data = await getConfigMaps(environment.namespace);
        break;
      case 'secrets':
        data = await getSecrets(environment.namespace);
        break;
      default:
        return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = await request.json();
    const { resourceType, name, data, environmentId } = body;

    if (!resourceType || !name || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    if (!canManageConfigObjects(member.role)) {
      return NextResponse.json(
        { error: '仅 owner 或 admin 可以修改 ConfigMap / Secret' },
        { status: 403 }
      );
    }

    const environment = await getProjectEnvironmentOrThrow(id, environmentId);
    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    getK8sClient();

    if (resourceType === 'configmap') {
      await upsertConfigMap(environment.namespace, name, data);
    } else if (resourceType === 'secret') {
      await upsertSecret(environment.namespace, name, data);
    } else {
      return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('type') || 'configmap';
    const name = url.searchParams.get('name');
    const environmentId = url.searchParams.get('env');

    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const { member } = await getProjectAccessOrThrow(id, session.user.id);
    if (!canManageConfigObjects(member.role)) {
      return NextResponse.json(
        { error: '仅 owner 或 admin 可以修改 ConfigMap / Secret' },
        { status: 403 }
      );
    }

    const environment = await getProjectEnvironmentOrThrow(id, environmentId);
    if (!environment.namespace) {
      return NextResponse.json({ error: 'Environment not configured' }, { status: 400 });
    }

    getK8sClient();

    if (resourceType === 'configmap') {
      await deleteConfigMap(environment.namespace, name);
    } else if (resourceType === 'secret') {
      await deleteSecret(environment.namespace, name);
    } else {
      return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAccessError(error)) {
      return toAccessErrorResponse(error);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
