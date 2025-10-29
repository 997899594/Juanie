import { describe, expect, it } from 'vitest'
import { generateId, generateOAuthState, generateSessionId, generateShortId } from '../src/id'

describe('ID Utils', () => {
  describe('generateId', () => {
    it('should generate a unique ID with default length', () => {
      const id = generateId()
      expect(id).toBeDefined()
      expect(id.length).toBe(21)
    })

    it('should generate ID with custom length', () => {
      const id = generateId(10)
      expect(id.length).toBe(10)
    })

    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateShortId', () => {
    it('should generate a 10 character ID', () => {
      const id = generateShortId()
      expect(id.length).toBe(10)
    })
  })

  describe('generateSessionId', () => {
    it('should generate a 32 character session ID', () => {
      const id = generateSessionId()
      expect(id.length).toBe(32)
    })
  })

  describe('generateOAuthState', () => {
    it('should generate a 16 character OAuth state', () => {
      const state = generateOAuthState()
      expect(state.length).toBe(16)
    })
  })
})
