import { describe, expect, it } from 'vitest'
import {
  camelToSnake,
  capitalize,
  maskString,
  slugify,
  snakeToCamel,
  truncate,
} from '../src/string'

describe('String Utils', () => {
  describe('slugify', () => {
    it('should convert string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world')
      expect(slugify('My Project Name')).toBe('my-project-name')
    })

    it('should handle special characters', () => {
      expect(slugify('Hello@World!')).toBe('helloworld')
    })
  })

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...')
    })

    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello')
    })
  })

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
    })
  })

  describe('camelToSnake', () => {
    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('helloWorld')).toBe('hello_world')
    })
  })

  describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('hello_world')).toBe('helloWorld')
    })
  })

  describe('maskString', () => {
    it('should mask middle part of string', () => {
      const masked = maskString('test@example.com')
      expect(masked).toContain('***')
      expect(masked.startsWith('tes')).toBe(true)
      expect(masked.endsWith('com')).toBe(true)
    })
  })
})
