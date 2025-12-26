import { DomainEvents } from '@juanie/core/events'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

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
  constructor(private eventPublisher: EventEmitter2) {}

  async emitOrganizationCreated(event: OrganizationCreatedEvent) {
    this.eventPublisher.emit(DomainEvents.ORGANIZATION_CREATED, event)
  }

  async emitMemberAdded(event: OrganizationMemberAddedEvent) {
    this.eventPublisher.emit(DomainEvents.ORGANIZATION_MEMBER_ADDED, event)
  }

  async emitMemberRemoved(event: OrganizationMemberRemovedEvent) {
    this.eventPublisher.emit(DomainEvents.ORGANIZATION_MEMBER_REMOVED, event)
  }

  async emitMemberRoleUpdated(event: OrganizationMemberRoleUpdatedEvent) {
    this.eventPublisher.emit(DomainEvents.ORGANIZATION_MEMBER_ROLE_UPDATED, event)
  }
}
