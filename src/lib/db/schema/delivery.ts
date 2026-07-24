import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  buildArtifactKindEnum,
  buildRunStatusEnum,
  buildUnitStatusEnum,
  deliveryExecutionStatusEnum,
  deploymentStatusEnum,
  gitProviderTypeEnum,
  outboxStatusEnum,
  promotionRequestStatusEnum,
  ReleaseArtifactKind,
  ReleaseArtifactStatus,
  releaseStatusEnum,
  repositoryWebhookReconcileStatusEnum,
  sourceDeliveryStatusEnum,
} from '@/lib/db/schema/enums';
import { repositories, users } from '@/lib/db/schema/identity';
import { environments, projects, services } from '@/lib/db/schema/projects';
import { teams } from '@/lib/db/schema/teams';
import type { DeploymentDiagnosticSnapshot } from '@/lib/deployments/diagnostics-types';
import type { ReleaseRecapRecord } from '@/lib/releases/recap-record';

// ============================================
// Release Tables
// ============================================

export const deliveryExecutions = pgTable(
  'deliveryExecution',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repositoryId')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    provider: gitProviderTypeEnum('provider').notNull(),
    providerDeliveryId: varchar('providerDeliveryId', { length: 255 }).notNull(),
    sourceRepository: varchar('sourceRepository', { length: 255 }).notNull(),
    sourceRef: varchar('sourceRef', { length: 255 }).notNull(),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }).notNull(),
    status: deliveryExecutionStatusEnum('status').notNull().default('received'),
    lastErrorCode: varchar('lastErrorCode', { length: 100 }),
    lastError: text('lastError'),
    lastSignalAt: timestamp('lastSignalAt').defaultNow().notNull(),
    startedAt: timestamp('startedAt').defaultNow().notNull(),
    completedAt: timestamp('completedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    providerDeliveryUnique: unique('deliveryExecution_provider_delivery_unique').on(
      table.provider,
      table.providerDeliveryId
    ),
    projectCreatedIdx: index('deliveryExecution_project_created_idx').on(
      table.projectId,
      table.createdAt
    ),
    statusSignalIdx: index('deliveryExecution_status_signal_idx').on(
      table.status,
      table.lastSignalAt
    ),
  })
);

export const deliveryExecutionEvents = pgTable(
  'deliveryExecutionEvent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequence: bigserial('sequence', { mode: 'number' }).notNull(),
    deliveryExecutionId: uuid('deliveryExecutionId')
      .notNull()
      .references(() => deliveryExecutions.id, { onDelete: 'cascade' }),
    eventKey: varchar('eventKey', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    fromStatus: deliveryExecutionStatusEnum('fromStatus'),
    toStatus: deliveryExecutionStatusEnum('toStatus').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurredAt').defaultNow().notNull(),
  },
  (table) => ({
    executionSequenceIdx: index('deliveryExecutionEvent_execution_sequence_idx').on(
      table.deliveryExecutionId,
      table.sequence
    ),
    eventKeyUnique: unique('deliveryExecutionEvent_execution_event_key_unique').on(
      table.deliveryExecutionId,
      table.eventKey
    ),
  })
);

export const sourceDeliveries = pgTable(
  'sourceDelivery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repositoryId')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    deliveryExecutionId: uuid('deliveryExecutionId')
      .notNull()
      .references(() => deliveryExecutions.id, { onDelete: 'cascade' }),

    provider: gitProviderTypeEnum('provider').notNull(),
    providerDeliveryId: varchar('providerDeliveryId', { length: 255 }).notNull(),
    sourceRepository: varchar('sourceRepository', { length: 255 }).notNull(),
    sourceRef: varchar('sourceRef', { length: 255 }).notNull(),
    beforeCommitSha: varchar('beforeCommitSha', { length: 100 }),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }).notNull(),
    forceFullBuild: boolean('forceFullBuild').notNull().default(false),

    status: sourceDeliveryStatusEnum('status').notNull().default('received'),
    attemptCount: integer('attemptCount').notNull().default(0),
    lastError: text('lastError'),
    dispatchedAt: timestamp('dispatchedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('sourceDelivery_projectId_idx').on(table.projectId),
    repositoryIdIdx: index('sourceDelivery_repositoryId_idx').on(table.repositoryId),
    deliveryExecutionUnique: unique('sourceDelivery_deliveryExecution_unique').on(
      table.deliveryExecutionId
    ),
    statusIdx: index('sourceDelivery_status_idx').on(table.status),
    providerDeliveryUnique: unique('sourceDelivery_provider_delivery_unique').on(
      table.provider,
      table.providerDeliveryId
    ),
  })
);

export const buildRuns = pgTable(
  'buildRun',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repositoryId').references(() => repositories.id, { onDelete: 'set null' }),
    deliveryExecutionId: uuid('deliveryExecutionId').references(() => deliveryExecutions.id, {
      onDelete: 'set null',
    }),
    releaseId: uuid('releaseId').references((): AnyPgColumn => releases.id, {
      onDelete: 'set null',
    }),

    sourceRepository: varchar('sourceRepository', { length: 255 }).notNull(),
    sourceRef: varchar('sourceRef', { length: 255 }).notNull(),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }).notNull(),
    provider: varchar('provider', { length: 40 }).notNull().default('github'),
    externalRunId: varchar('externalRunId', { length: 255 }),
    status: buildRunStatusEnum('status').notNull().default('pending'),
    plan: jsonb('plan').notNull().default(sql`'{}'::jsonb`),
    errorMessage: text('errorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    startedAt: timestamp('startedAt'),
    finishedAt: timestamp('finishedAt'),
  },
  (table) => ({
    projectIdIdx: index('buildRun_projectId_idx').on(table.projectId),
    repositoryIdIdx: index('buildRun_repositoryId_idx').on(table.repositoryId),
    deliveryExecutionIdx: index('buildRun_deliveryExecution_idx').on(table.deliveryExecutionId),
    releaseIdIdx: index('buildRun_releaseId_idx').on(table.releaseId),
    sourceIdx: index('buildRun_source_idx').on(
      table.sourceRepository,
      table.sourceRef,
      table.sourceCommitSha
    ),
    externalRunUnique: unique('buildRun_repository_provider_external_unique').on(
      table.repositoryId,
      table.provider,
      table.externalRunId
    ),
    statusIdx: index('buildRun_status_idx').on(table.status),
  })
);

export const buildUnits = pgTable(
  'buildUnit',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildRunId: uuid('buildRunId')
      .notNull()
      .references(() => buildRuns.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    unitKey: varchar('unitKey', { length: 120 }).notNull(),
    serviceName: varchar('serviceName', { length: 100 }).notNull(),
    status: buildUnitStatusEnum('status').notNull().default('pending'),
    image: varchar('image', { length: 1000 }),
    imageDigest: varchar('imageDigest', { length: 255 }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    errorMessage: text('errorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    startedAt: timestamp('startedAt'),
    finishedAt: timestamp('finishedAt'),
  },
  (table) => ({
    buildRunIdIdx: index('buildUnit_buildRunId_idx').on(table.buildRunId),
    serviceIdIdx: index('buildUnit_serviceId_idx').on(table.serviceId),
    statusIdx: index('buildUnit_status_idx').on(table.status),
    buildRunUnitUnique: unique('buildUnit_buildRun_unit_unique').on(
      table.buildRunId,
      table.unitKey
    ),
  })
);

export const buildArtifacts = pgTable(
  'buildArtifact',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buildRunId: uuid('buildRunId')
      .notNull()
      .references(() => buildRuns.id, { onDelete: 'cascade' }),
    buildUnitId: uuid('buildUnitId')
      .notNull()
      .references(() => buildUnits.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    kind: buildArtifactKindEnum('kind').notNull().default('image'),
    name: varchar('name', { length: 120 }).notNull(),
    uri: varchar('uri', { length: 1000 }).notNull(),
    digest: varchar('digest', { length: 255 }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    buildRunIdIdx: index('buildArtifact_buildRunId_idx').on(table.buildRunId),
    buildUnitIdIdx: index('buildArtifact_buildUnitId_idx').on(table.buildUnitId),
    serviceIdIdx: index('buildArtifact_serviceId_idx').on(table.serviceId),
    buildUnitArtifactUnique: unique('buildArtifact_buildUnit_kind_name_unique').on(
      table.buildUnitId,
      table.kind,
      table.name
    ),
  })
);

export const releases = pgTable(
  'release',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    deliveryExecutionId: uuid('deliveryExecutionId').references(() => deliveryExecutions.id, {
      onDelete: 'set null',
    }),
    promotionRequestId: uuid('promotionRequestId').references(
      (): AnyPgColumn => promotionRequests.id,
      { onDelete: 'set null' }
    ),

    executionKey: varchar('executionKey', { length: 255 }).notNull(),
    executionGeneration: integer('executionGeneration').notNull(),

    sourceRepository: varchar('sourceRepository', { length: 255 }).notNull(),
    sourceRef: varchar('sourceRef', { length: 255 }).notNull(),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }),
    externalRunId: varchar('externalRunId', { length: 255 }),
    configCommitSha: varchar('configCommitSha', { length: 100 }),
    sourceReleaseId: uuid('sourceReleaseId').references((): AnyPgColumn => releases.id, {
      onDelete: 'set null',
    }),
    status: releaseStatusEnum('status').notNull().default('queued'),
    triggeredBy: varchar('triggeredBy', { length: 20 }).notNull().default('api'),
    triggeredByUserId: uuid('triggeredByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    summary: text('summary'),
    recap: jsonb('recap').$type<ReleaseRecapRecord | null>(),
    errorMessage: text('errorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('release_projectId_idx').on(table.projectId),
    environmentIdIdx: index('release_environmentId_idx').on(table.environmentId),
    deliveryExecutionIdx: index('release_deliveryExecution_idx').on(table.deliveryExecutionId),
    promotionRequestIdx: index('release_promotionRequest_idx').on(table.promotionRequestId),
    sourceReleaseIdIdx: index('release_sourceReleaseId_idx').on(table.sourceReleaseId),
    statusIdx: index('release_status_idx').on(table.status),
    sourceRepoIdx: index('release_sourceRepository_idx').on(table.sourceRepository),
  })
);

export const promotionRequests = pgTable(
  'promotionRequest',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deliveryExecutionId: uuid('deliveryExecutionId').references(() => deliveryExecutions.id, {
      onDelete: 'set null',
    }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceReleaseId: uuid('sourceReleaseId')
      .notNull()
      .references(() => releases.id, { onDelete: 'restrict' }),
    targetEnvironmentId: uuid('targetEnvironmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'restrict' }),
    productionReleaseId: uuid('productionReleaseId').references(() => releases.id, {
      onDelete: 'set null',
    }),
    status: promotionRequestStatusEnum('status').notNull().default('requested'),
    contentDigest: varchar('contentDigest', { length: 71 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    requireDistinctApprover: boolean('requireDistinctApprover').notNull().default(false),
    requestedByUserId: uuid('requestedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedByUserId: uuid('approvedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    requestedAt: timestamp('requestedAt').defaultNow().notNull(),
    approvedAt: timestamp('approvedAt'),
    completedAt: timestamp('completedAt'),
    lastError: text('lastError'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectCreatedIdx: index('promotionRequest_project_created_idx').on(
      table.projectId,
      table.createdAt
    ),
    executionIdx: index('promotionRequest_deliveryExecution_idx').on(table.deliveryExecutionId),
    sourceTargetDigestUnique: unique('promotionRequest_source_target_digest_unique').on(
      table.sourceReleaseId,
      table.targetEnvironmentId,
      table.contentDigest
    ),
  })
);

export const promotionApprovalEvents = pgTable(
  'promotionApprovalEvent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    promotionRequestId: uuid('promotionRequestId')
      .notNull()
      .references(() => promotionRequests.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 20 }).$type<'approved' | 'rejected'>().notNull(),
    contentDigest: varchar('contentDigest', { length: 71 }).notNull(),
    actorUserId: uuid('actorUserId').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    requestCreatedIdx: index('promotionApprovalEvent_request_created_idx').on(
      table.promotionRequestId,
      table.createdAt
    ),
  })
);

export const repositoryWebhookControllers = pgTable(
  'repositoryWebhookController',
  {
    repositoryId: uuid('repositoryId')
      .primaryKey()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    desiredGeneration: integer('desiredGeneration').notNull().default(1),
    observedGeneration: integer('observedGeneration').notNull().default(0),
    canonicalUrl: varchar('canonicalUrl', { length: 500 }).notNull(),
    observedWebhookId: varchar('observedWebhookId', { length: 255 }),
    observedUrl: varchar('observedUrl', { length: 500 }),
    status: repositoryWebhookReconcileStatusEnum('status').notNull().default('pending'),
    attemptCount: integer('attemptCount').notNull().default(0),
    retryAt: timestamp('retryAt'),
    lastErrorCode: varchar('lastErrorCode', { length: 100 }),
    lastError: text('lastError'),
    lastReconciledAt: timestamp('lastReconciledAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    reconcileIdx: index('repositoryWebhookController_reconcile_idx').on(
      table.status,
      table.retryAt
    ),
  })
);

export const executionOwnerships = pgTable(
  'executionOwnership',
  {
    scopeKey: varchar('scopeKey', { length: 255 }).primaryKey(),
    scopeType: varchar('scopeType', { length: 40 }).notNull(),
    ownerType: varchar('ownerType', { length: 40 }).notNull(),
    ownerId: uuid('ownerId').notNull(),
    generation: integer('generation').notNull(),
    acquiredAt: timestamp('acquiredAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index('executionOwnership_owner_idx').on(table.ownerType, table.ownerId),
  })
);

export const releaseEvents = pgTable(
  'releaseEvent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequence: bigserial('sequence', { mode: 'number' }).notNull(),
    releaseId: uuid('releaseId')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actorUserId').references(() => users.id, { onDelete: 'set null' }),
    eventKey: varchar('eventKey', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    correlationId: varchar('correlationId', { length: 255 }).notNull(),
    causationId: varchar('causationId', { length: 255 }),
    occurredAt: timestamp('occurredAt').defaultNow().notNull(),
  },
  (table) => ({
    releaseSequenceIdx: index('releaseEvent_release_sequence_idx').on(
      table.releaseId,
      table.sequence
    ),
    projectOccurredAtIdx: index('releaseEvent_project_occurred_at_idx').on(
      table.projectId,
      table.occurredAt
    ),
    releaseEventKeyUnique: unique('releaseEvent_release_event_key_unique').on(
      table.releaseId,
      table.eventKey
    ),
    correlationIdIdx: index('releaseEvent_correlation_id_idx').on(table.correlationId),
  })
);

export const outboxMessages = pgTable(
  'outboxMessage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topic: varchar('topic', { length: 100 }).notNull(),
    aggregateType: varchar('aggregateType', { length: 50 }).notNull(),
    aggregateId: varchar('aggregateId', { length: 255 }).notNull(),
    commandId: varchar('commandId', { length: 255 }).notNull(),
    dedupeKey: varchar('dedupeKey', { length: 700 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum('status').notNull().default('pending'),
    attemptCount: integer('attemptCount').notNull().default(0),
    availableAt: timestamp('availableAt').defaultNow().notNull(),
    claimedAt: timestamp('claimedAt'),
    claimedBy: varchar('claimedBy', { length: 255 }),
    deliveredAt: timestamp('deliveredAt'),
    lastError: text('lastError'),
    replayedFromId: uuid('replayedFromId').references((): AnyPgColumn => outboxMessages.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('createdByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolvedAt'),
    resolvedByUserId: uuid('resolvedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolutionNote: text('resolutionNote'),
    replayMessageId: uuid('replayMessageId').references((): AnyPgColumn => outboxMessages.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    dedupeKeyUnique: unique('outboxMessage_dedupe_key_unique').on(table.dedupeKey),
    dispatchIdx: index('outboxMessage_dispatch_idx').on(table.status, table.availableAt),
    aggregateIdx: index('outboxMessage_aggregate_idx').on(table.aggregateType, table.aggregateId),
    replayedFromIdx: index('outboxMessage_replayed_from_idx').on(table.replayedFromId),
    unresolvedDeadLetterIdx: index('outboxMessage_unresolved_dead_letter_idx').on(
      table.status,
      table.resolvedAt,
      table.createdAt
    ),
    replayMessageUnique: unique('outboxMessage_replay_message_unique').on(table.replayMessageId),
  })
);

export const releaseArtifacts = pgTable(
  'releaseArtifact',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    releaseId: uuid('releaseId')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'cascade' }),

    kind: varchar('kind', { length: 20 }).$type<ReleaseArtifactKind>().default('image').notNull(),
    name: varchar('name', { length: 100 }),
    variant: varchar('variant', { length: 100 }),
    platform: varchar('platform', { length: 80 }),
    format: varchar('format', { length: 40 }),
    uri: varchar('uri', { length: 1000 }),
    checksum: varchar('checksum', { length: 255 }),
    sizeBytes: bigint('sizeBytes', { mode: 'number' }),
    sbomUri: varchar('sbomUri', { length: 1000 }),
    provenanceUri: varchar('provenanceUri', { length: 1000 }),
    status: varchar('status', { length: 20 })
      .$type<ReleaseArtifactStatus>()
      .default('succeeded')
      .notNull(),

    imageUrl: varchar('imageUrl', { length: 500 }),
    imageDigest: varchar('imageDigest', { length: 255 }),
    sourceServiceId: uuid('sourceServiceId').references(() => services.id, {
      onDelete: 'set null',
    }),
    sourceImageUri: varchar('sourceImageUri', { length: 1000 }),
    sourceImageDigest: varchar('sourceImageDigest', { length: 255 }),
    sourceImagePlatform: varchar('sourceImagePlatform', { length: 80 }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    releaseIdIdx: index('releaseArtifact_releaseId_idx').on(table.releaseId),
    serviceIdIdx: index('releaseArtifact_serviceId_idx').on(table.serviceId),
    sourceServiceIdIdx: index('releaseArtifact_sourceServiceId_idx').on(table.sourceServiceId),
    kindIdx: index('releaseArtifact_kind_idx').on(table.kind),
    statusIdx: index('releaseArtifact_status_idx').on(table.status),
    releaseServiceUnique: unique('releaseArtifact_release_service_unique').on(
      table.releaseId,
      table.serviceId
    ),
    deliveryArtifactUnique: unique('releaseArtifact_release_delivery_unique').on(
      table.releaseId,
      table.kind,
      table.name,
      table.variant,
      table.platform
    ),
  })
);

export const artifactDownloadEvents = pgTable(
  'artifactDownloadEvent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    releaseId: uuid('releaseId')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    artifactId: uuid('artifactId')
      .notNull()
      .references(() => releaseArtifacts.id, { onDelete: 'cascade' }),
    userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
    ipAddress: varchar('ipAddress', { length: 50 }),
    userAgent: text('userAgent'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('artifactDownloadEvent_teamId_idx').on(table.teamId),
    projectIdIdx: index('artifactDownloadEvent_projectId_idx').on(table.projectId),
    releaseIdIdx: index('artifactDownloadEvent_releaseId_idx').on(table.releaseId),
    artifactIdIdx: index('artifactDownloadEvent_artifactId_idx').on(table.artifactId),
    userIdIdx: index('artifactDownloadEvent_userId_idx').on(table.userId),
    createdAtIdx: index('artifactDownloadEvent_createdAt_idx').on(table.createdAt),
  })
);

// ============================================
// Deployment Tables
// ============================================

export const deployments = pgTable(
  'deployment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    deliveryExecutionId: uuid('deliveryExecutionId').references(() => deliveryExecutions.id, {
      onDelete: 'set null',
    }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    version: varchar('version', { length: 100 }),
    status: deploymentStatusEnum('status').notNull().default('queued'),

    commitSha: varchar('commitSha', { length: 100 }),
    commitMessage: text('commitMessage'),
    branch: varchar('branch', { length: 100 }),

    imageUrl: varchar('imageUrl', { length: 500 }),
    imageDigest: varchar('imageDigest', { length: 255 }),
    buildLogs: text('buildLogs'),
    errorMessage: text('errorMessage'),

    deployedById: uuid('deployedById').references(() => users.id, { onDelete: 'set null' }),
    deployedAt: timestamp('deployedAt'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    releaseIdIdx: index('deployment_releaseId_idx').on(table.releaseId),
    deliveryExecutionIdx: index('deployment_deliveryExecution_idx').on(table.deliveryExecutionId),
    projectIdIdx: index('deployment_projectId_idx').on(table.projectId),
    statusIdx: index('deployment_status_idx').on(table.status),
  })
);

// ============================================
// Deployment Log Tables
// ============================================

export const deploymentLogs = pgTable(
  'deploymentLog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deploymentId: uuid('deploymentId')
      .notNull()
      .references(() => deployments.id, { onDelete: 'cascade' }),
    level: varchar('level', { length: 10 }).notNull().default('info'),
    message: text('message').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    deploymentIdIdx: index('deploymentLog_deploymentId_idx').on(table.deploymentId),
  })
);

export const deploymentDiagnostics = pgTable(
  'deploymentDiagnostic',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deploymentId: uuid('deploymentId')
      .notNull()
      .references(() => deployments.id, { onDelete: 'cascade' }),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    namespace: varchar('namespace', { length: 255 }),
    workloadKind: varchar('workloadKind', { length: 40 }).notNull(),
    workloadName: varchar('workloadName', { length: 255 }),
    reason: varchar('reason', { length: 80 }).notNull(),
    summary: text('summary').notNull(),
    errorMessage: text('errorMessage'),
    snapshot: jsonb('snapshot').$type<DeploymentDiagnosticSnapshot>().notNull(),
    capturedAt: timestamp('capturedAt').defaultNow().notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    deploymentIdIdx: index('deploymentDiagnostic_deploymentId_idx').on(table.deploymentId),
    releaseIdIdx: index('deploymentDiagnostic_releaseId_idx').on(table.releaseId),
    environmentCapturedAtIdx: index('deploymentDiagnostic_environment_capturedAt_idx').on(
      table.environmentId,
      table.capturedAt
    ),
    workloadIdx: index('deploymentDiagnostic_workload_idx').on(
      table.namespace,
      table.workloadKind,
      table.workloadName
    ),
  })
);
