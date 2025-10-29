import { describe, expect, it } from 'vitest'
import { formatDuration, isExpired } from '../src/date'

describe('Date Utils', () => {
  describe('isExpired', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date('2020-01-01')
      expect(isExpired(pastDate)).toBe(true)
    })

    it('should return false for future dates', () => {
      const futureDate = new Date('2099-01-01')
      expect(isExpired(futureDate)).toBe(false)
    })
  })

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(45)).toBe('45s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s')
    })

    it('should format hours, minutes and seconds', () => {
      expect(formatDuration(3665)).toBe('1h 1m 5s')
    })

    it('should format hours only', () => {
      expect(formatDuration(3600)).toBe('1h')
    })
  })
})
