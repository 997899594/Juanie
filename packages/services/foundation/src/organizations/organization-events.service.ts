import { DomainEvents, EventPublisher } from '@juanie/core/events'
import { Injectable } from '@nestjs/common'

export interface OrganizationCreatedEvent {
  organizationId: string
  name: string
  gitSyncEnabled: boolean
  gitProvider?: string
  gitOrgName?: string
  createdBy: string
}

export interface OrganizationMemberAddedEvent {
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  addedBy: string
}

export interface OrganizationMemberRemovedEvent {
  organizationId: string
  userId: string
  removedBy: string
}

export interface OrganizationMemberRoleUpdatedEvent {
  organizationId: string
  userId: string
  oldRole: 'owner' | 'admin' | 'member'
  newRole: 'owner' | 'admin' | 'member'
  updatedBy: string
}

@Injectable()
export class OrganizationEventsService {
  constructor(private eventPublisher: EventPublisher) {}

  async emitOrganizationCreated(event: OrganizationCreatedEvent) {
    await this.eventPublisher.publishDomain({
      type: DomainEvents.ORGANIZATION_CREATED,
      version: 1,
      resourceId: event.organizationId,
      userId: event.createdBy,
      data: {
        name: event.name,
        gitSyncEnabled: event.gitSyncEnabled,
        gitProvider: event.gitProvider,
        gitOrgName: event.gitOrgName,
      },
    })
  }

  async emitMemberAdded(event: OrganizationMemberAddedEvent) {
    await this.eventPublisher.publishDomain({
      type: DomainEvents.ORGANIZATION_MEMBER_ADDED,
      version: 1,
      resourceId: event.organizationId,
      userId: event.addedBy,
      data: {
        memberId: event.userId,
        role: event.role,
      },
    })
  }

  async emitMemberRemoved(event: OrganizationMemberRemovedEvent) {
    await this.eventPublisher.publishDomain({
      type: DomainEvents.ORGANIZATION_MEMBER_REMOVED,
      version: 1,
      resourceId: event.organizationId,
      userId: event.removedBy,
      data: {
        memberId: event.userId,
      },
    })
  }

  async emitMemberRoleUpdated(event: OrganizationMemberRoleUpdatedEvent) {
    await this.eventPublisher.publishDomain({
      type: DomainEvents.ORGANIZATION_MEMBER_ROLE_UPDATED,
      version: 1,
      resourceId: event.organizationId,
      userId: event.updatedBy,
      data: {
        memberId: event.userId,
        oldRole: event.oldRole,
        newRole: event.newRole,
      },
    })
  }
}
