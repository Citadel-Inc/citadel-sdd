import { pathToFileURL } from 'node:url'
import { describe, test } from 'bun:test'
import * as fc from 'fast-check'
import { rootUriToPath } from './workspace.ts'

const absPosixPath = fc.oneof(
  fc.constant('/'),
  fc
    .array(
      fc
        .string({ minLength: 1, maxLength: 24 })
        .filter((s) => !s.includes('\0') && !s.includes('/')),
      { minLength: 1, maxLength: 8 },
    )
    .map((parts) => `/${parts.join('/')}`),
)

describe('rootUriToPath', () => {
  test('does not throw and returns string | null on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (uri) => {
        const result = rootUriToPath(uri)
        return result === null || typeof result === 'string'
      }),
    )
  })

  test('does not throw on arbitrary file:// suffixes', () => {
    fc.assert(
      fc.property(fc.string(), (suffix) => {
        const result = rootUriToPath(`file://${suffix}`)
        return result === null || typeof result === 'string'
      }),
    )
  })

  test('returns null when the string is not a file:// URI', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.startsWith('file://')),
        (uri) => rootUriToPath(uri) === null,
      ),
    )
  })

  test('round-trips POSIX paths through pathToFileURL', () => {
    fc.assert(fc.property(absPosixPath, (abs) => rootUriToPath(pathToFileURL(abs).href) === abs))
  })

  test('non-null output is an absolute path without NUL', () => {
    fc.assert(
      fc.property(fc.string(), (uri) => {
        const result = rootUriToPath(uri)
        if (result === null) {
          return true
        }
        return result.startsWith('/') && !result.includes('\0')
      }),
    )
    fc.assert(
      fc.property(fc.string(), (suffix) => {
        const result = rootUriToPath(`file://${suffix}`)
        if (result === null) {
          return true
        }
        return result.startsWith('/') && !result.includes('\0')
      }),
    )
  })

  test('non-null output round-trips through pathToFileURL', () => {
    fc.assert(
      fc.property(fc.string(), (suffix) => {
        const result = rootUriToPath(`file://${suffix}`)
        if (result === null) {
          return true
        }
        return rootUriToPath(pathToFileURL(result).href) === result
      }),
    )
  })
})
