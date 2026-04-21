export const platformDatabaseTypes = ['postgresql', 'mysql', 'redis', 'mongodb'] as const;
export type PlatformDatabaseType = (typeof platformDatabaseTypes)[number];

export const platformDatabaseProvisionTypes = ['shared', 'standalone', 'external'] as const;
export type PlatformDatabaseProvisionType = (typeof platformDatabaseProvisionTypes)[number];

interface DatabasePlatformSupportDescriptor {
  label: string;
  provisionTypes: readonly PlatformDatabaseProvisionType[];
  defaultProvisionType: PlatformDatabaseProvisionType;
  supportsCapabilities: boolean;
  supportsAutomatedMigrations: boolean;
  previewCloneProvisionTypes: readonly PlatformDatabaseProvisionType[];
}

export interface DatabasePlatformSelectionLike {
  name?: string | null;
  type: PlatformDatabaseType;
  provisionType?: PlatformDatabaseProvisionType | null;
  externalUrl?: string | null;
  capabilities?: readonly string[] | null;
}

export interface DatabaseSelectionValidationIssue {
  code:
    | 'unsupported_provision_type'
    | 'external_url_required'
    | 'invalid_external_url'
    | 'unsupported_capabilities';
  message: string;
}

export interface UnsupportedPreviewCloneDatabase {
  name: string | null;
  type: PlatformDatabaseType;
  provisionType: PlatformDatabaseProvisionType;
  reason: string;
}

const databasePlatformSupport: Record<PlatformDatabaseType, DatabasePlatformSupportDescriptor> = {
  postgresql: {
    label: 'PostgreSQL',
    provisionTypes: ['shared', 'standalone', 'external'],
    defaultProvisionType: 'shared',
    supportsCapabilities: true,
    supportsAutomatedMigrations: true,
    previewCloneProvisionTypes: ['shared', 'standalone'],
  },
  mysql: {
    label: 'MySQL',
    provisionTypes: ['standalone', 'external'],
    defaultProvisionType: 'standalone',
    supportsCapabilities: false,
    supportsAutomatedMigrations: true,
    previewCloneProvisionTypes: [],
  },
  redis: {
    label: 'Redis',
    provisionTypes: ['shared', 'standalone', 'external'],
    defaultProvisionType: 'shared',
    supportsCapabilities: false,
    supportsAutomatedMigrations: false,
    previewCloneProvisionTypes: [],
  },
  mongodb: {
    label: 'MongoDB',
    provisionTypes: ['external'],
    defaultProvisionType: 'external',
    supportsCapabilities: false,
    supportsAutomatedMigrations: false,
    previewCloneProvisionTypes: [],
  },
};

export class PreviewCloneUnsupportedError extends Error {
  constructor(readonly databases: UnsupportedPreviewCloneDatabase[]) {
    super(formatUnsupportedPreviewCloneDatabasesMessage(databases));
    this.name = 'PreviewCloneUnsupportedError';
  }
}

export function isPlatformDatabaseType(value: string): value is PlatformDatabaseType {
  return platformDatabaseTypes.includes(value as PlatformDatabaseType);
}

export function isPlatformDatabaseProvisionType(
  value: string
): value is PlatformDatabaseProvisionType {
  return platformDatabaseProvisionTypes.includes(value as PlatformDatabaseProvisionType);
}

export function toPlatformDatabaseProvisionType(
  value: string | null | undefined
): PlatformDatabaseProvisionType | null {
  if (!value || !isPlatformDatabaseProvisionType(value)) {
    return null;
  }

  return value;
}

export function getDatabaseTypeLabel(type: PlatformDatabaseType): string {
  return databasePlatformSupport[type].label;
}

export function getDatabaseProvisionTypeLabel(
  provisionType: PlatformDatabaseProvisionType
): string {
  switch (provisionType) {
    case 'shared':
      return '共享资源';
    case 'standalone':
      return '独立资源';
    case 'external':
      return '外部实例';
  }
}

export function getSupportedDatabaseProvisionTypes(
  type: PlatformDatabaseType
): readonly PlatformDatabaseProvisionType[] {
  return databasePlatformSupport[type].provisionTypes;
}

export function getDefaultDatabaseProvisionType(
  type: PlatformDatabaseType
): PlatformDatabaseProvisionType {
  return databasePlatformSupport[type].defaultProvisionType;
}

export function resolveDatabaseProvisionType(
  type: PlatformDatabaseType,
  provisionType?: PlatformDatabaseProvisionType | null
): PlatformDatabaseProvisionType {
  return provisionType ?? getDefaultDatabaseProvisionType(type);
}

export function supportsDatabaseProvisionType(
  type: PlatformDatabaseType,
  provisionType: PlatformDatabaseProvisionType
): boolean {
  return databasePlatformSupport[type].provisionTypes.includes(provisionType);
}

export function supportsDatabaseCapabilities(type: PlatformDatabaseType): boolean {
  return databasePlatformSupport[type].supportsCapabilities;
}

export function supportsDatabaseAutomatedMigrations(type: PlatformDatabaseType): boolean {
  return databasePlatformSupport[type].supportsAutomatedMigrations;
}

export function supportsDatabasePreviewClone(input: {
  type: PlatformDatabaseType;
  provisionType?: PlatformDatabaseProvisionType | null;
}): boolean {
  const provisionType = resolveDatabaseProvisionType(input.type, input.provisionType);
  return databasePlatformSupport[input.type].previewCloneProvisionTypes.includes(provisionType);
}

export function formatUnsupportedDatabaseProvisionTypeMessage(
  type: PlatformDatabaseType,
  provisionType: PlatformDatabaseProvisionType
): string {
  const supportedLabels = getSupportedDatabaseProvisionTypes(type)
    .map((item) => getDatabaseProvisionTypeLabel(item))
    .join('、');

  return `${getDatabaseTypeLabel(type)} 目前只支持 ${supportedLabels}，不支持 ${getDatabaseProvisionTypeLabel(provisionType)}`;
}

export function formatUnsupportedDatabaseCapabilitiesMessage(type: PlatformDatabaseType): string {
  return `${getDatabaseTypeLabel(type)} 暂不支持数据库能力声明，当前只有 PostgreSQL 支持 capabilities`;
}

function getAllowedExternalProtocols(type: PlatformDatabaseType): string[] {
  switch (type) {
    case 'postgresql':
      return ['postgresql:', 'postgres:'];
    case 'mysql':
      return ['mysql:'];
    case 'redis':
      return ['redis:', 'rediss:'];
    case 'mongodb':
      return ['mongodb:', 'mongodb+srv:'];
  }
}

export function validateExternalDatabaseUrl(
  type: PlatformDatabaseType,
  externalUrl: string
): string | null {
  let parsed: URL;

  try {
    parsed = new URL(externalUrl);
  } catch {
    return 'externalUrl 不是合法的连接串 URL';
  }

  const allowedProtocols = getAllowedExternalProtocols(type);
  if (!allowedProtocols.includes(parsed.protocol)) {
    return `${getDatabaseTypeLabel(type)} 外部连接串必须使用 ${allowedProtocols.join(' / ')} 协议`;
  }

  return null;
}

export function getDatabaseSelectionValidationIssues(
  input: DatabasePlatformSelectionLike
): DatabaseSelectionValidationIssue[] {
  const issues: DatabaseSelectionValidationIssue[] = [];
  const provisionType = resolveDatabaseProvisionType(input.type, input.provisionType);

  if (!supportsDatabaseProvisionType(input.type, provisionType)) {
    issues.push({
      code: 'unsupported_provision_type',
      message: formatUnsupportedDatabaseProvisionTypeMessage(input.type, provisionType),
    });
  }

  if (provisionType === 'external' && !input.externalUrl?.trim()) {
    issues.push({
      code: 'external_url_required',
      message: '外部数据库必须提供 externalUrl 连接串',
    });
  } else if (provisionType === 'external' && input.externalUrl?.trim()) {
    const externalUrlError = validateExternalDatabaseUrl(input.type, input.externalUrl.trim());
    if (externalUrlError) {
      issues.push({
        code: 'invalid_external_url',
        message: externalUrlError,
      });
    }
  }

  if ((input.capabilities?.length ?? 0) > 0 && !supportsDatabaseCapabilities(input.type)) {
    issues.push({
      code: 'unsupported_capabilities',
      message: formatUnsupportedDatabaseCapabilitiesMessage(input.type),
    });
  }

  return issues;
}

export function formatUnsupportedPreviewCloneReason(
  type: PlatformDatabaseType,
  provisionType: PlatformDatabaseProvisionType
): string {
  if (type === 'postgresql' && provisionType === 'external') {
    return '外部 PostgreSQL 暂不支持独立预览库，请改为平台托管 PostgreSQL 或使用继承模式';
  }

  return '独立预览库当前只支持平台托管 PostgreSQL';
}

export function getUnsupportedPreviewCloneDatabases(
  databases: readonly DatabasePlatformSelectionLike[]
): UnsupportedPreviewCloneDatabase[] {
  return databases.flatMap((database) => {
    const provisionType = resolveDatabaseProvisionType(database.type, database.provisionType);

    if (supportsDatabasePreviewClone({ type: database.type, provisionType })) {
      return [];
    }

    return [
      {
        name: database.name?.trim() || null,
        type: database.type,
        provisionType,
        reason: formatUnsupportedPreviewCloneReason(database.type, provisionType),
      },
    ];
  });
}

export function formatUnsupportedPreviewCloneDatabasesMessage(
  databases: readonly UnsupportedPreviewCloneDatabase[]
): string {
  if (databases.length === 0) {
    return '独立预览库当前只支持平台托管 PostgreSQL';
  }

  const details = databases
    .map((database) => {
      const name = database.name ? `${database.name}` : '未命名数据库';
      return `${name}（${getDatabaseTypeLabel(database.type)} / ${getDatabaseProvisionTypeLabel(database.provisionType)}）`;
    })
    .join('；');

  return `独立预览库当前只支持平台托管 PostgreSQL。以下数据库暂不支持克隆：${details}`;
}

export function assertDatabasePreviewCloneSupport(
  databases: readonly DatabasePlatformSelectionLike[]
): void {
  const unsupportedDatabases = getUnsupportedPreviewCloneDatabases(databases);
  if (unsupportedDatabases.length > 0) {
    throw new PreviewCloneUnsupportedError(unsupportedDatabases);
  }
}
