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
  constructor(private eventEmitter: EventEmitter2) {}

  emitOrganizationCreated(event: OrganizationCreatedEvent) {
    this.eventEmitter.emit('organization.created', event)
  }

  emitMemberAdded(event: OrganizationMemberAddedEvent) {
    this.eventEmitter.emit('organization.member.added', event)
  }

  emitMemberRemoved(event: OrganizationMemberRemovedEvent) {
    this.eventEmitter.emit('organization.member.removed', event)
  }

  emitMemberRoleUpdated(event: OrganizationMemberRoleUpdatedEvent) {
    this.eventEmitter.emit('organization.member.role.updated', event)
  }
}
