import { describe, expect, it } from 'vitest'
import {
  checkPasswordStrength,
  hasRequiredKeys,
  isValidEmail,
  isValidSlug,
  isValidUrl,
  isValidUuid,
} from '../src/validation'

describe('Validation Utils', () => {
  describe('isValidUuid', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    })

    it('should reject invalid UUIDs', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false)
      expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
    })
  })

  describe('isValidSlug', () => {
    it('should validate correct slugs', () => {
      expect(isValidSlug('my-project')).toBe(true)
    })

    it('should reject invalid slugs', () => {
      expect(isValidSlug('My Project')).toBe(false)
      expect(isValidSlug('my_project')).toBe(false)
    })
  })

  describe('checkPasswordStrength', () => {
    it('should check strong password', () => {
      const result = checkPasswordStrength('MyP@ssw0rd123')
      expect(result.isStrong).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(4)
    })

    it('should check weak password', () => {
      const result = checkPasswordStrength('weak')
      expect(result.isStrong).toBe(false)
      expect(result.feedback.length).toBeGreaterThan(0)
    })
  })

  describe('hasRequiredKeys', () => {
    it('should validate object with all required keys', () => {
      const obj = { name: 'test', email: 'test@example.com' }
      const result = hasRequiredKeys(obj, ['name', 'email'])
      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should detect missing keys', () => {
      const obj = { name: 'test' }
      const result = hasRequiredKeys(obj, ['name', 'email'])
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('email')
    })
  })
})
