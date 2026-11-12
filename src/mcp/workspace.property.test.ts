import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as fc from 'fast-check'
import { rootUriToPath } from './workspace.ts'

const absPosixPath = fc.oneof(
  fc.constant('/'),
  fc
    .array(
      fc
        .string({ minLength: 1, maxLength: 24 })
        .filter((s) => !(s.includes('\0') || s.includes('/') || s === '.' || s === '..')),
      { minLength: 1, maxLength: 8 },
    )
    .map((parts) => `/${parts.join('/')}`),
)

describe('rootUriToPath', () => {
  test('does not throw and returns string | null on arbitrary input', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (uri) => {
          const result = rootUriToPath(uri)
          return result === null || typeof result === 'string'
        }),
      ),
    ).not.toThrow()
  })

  test('does not throw on arbitrary file:// suffixes', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (suffix) => {
          const result = rootUriToPath(`file://${suffix}`)
          return result === null || typeof result === 'string'
        }),
      ),
    ).not.toThrow()
  })

  test('returns null when the string is not a file:// URI', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.startsWith('file://')),
          (uri) => rootUriToPath(uri) === null,
        ),
      ),
    ).not.toThrow()
  })

  test('round-trips POSIX paths through pathToFileURL', () => {
    expect(() =>
      fc.assert(fc.property(absPosixPath, (abs) => rootUriToPath(pathToFileURL(abs).href) === abs)),
    ).not.toThrow()
  })

  test('non-null output is an absolute path without NUL', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (uri) => {
          const result = rootUriToPath(uri)
          if (result === null) {
            return true
          }
          return result.startsWith('/') && !result.includes('\0')
        }),
      ),
    ).not.toThrow()
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (suffix) => {
          const result = rootUriToPath(`file://${suffix}`)
          if (result === null) {
            return true
          }
          return result.startsWith('/') && !result.includes('\0')
        }),
      ),
    ).not.toThrow()
  })

  test('non-null output round-trips through pathToFileURL', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.string(), (suffix) => {
          const result = rootUriToPath(`file://${suffix}`)
          if (result === null) {
            return true
          }
          // URL parsing folds a backslash into '/', so '//' and '/' name the same directory.
          const again = rootUriToPath(pathToFileURL(result).href)
          return again !== null && resolve(again) === resolve(result)
        }),
      ),
    ).not.toThrow()
  })
})
