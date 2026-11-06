import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeStorage } from '@/test/fakeStorage'

/**
 * Regression tests (audit 2026-11-06): malformed error bodies must degrade to a usable ApiError.
 * Before the fix, a FastAPI `detail[]` item without `loc` threw a TypeError inside the error path,
 * and non-string `details[].issue` values reached React (which throws on object children).
 */
async function setup() {
  vi.stubGlobal('localStorage', createFakeStorage())
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  vi.resetModules()
  const client = await import('./apiClient')
  return { ...client, fetchMock }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function failWith(body: unknown, status = 422) {
  const { api, fetchMock, ApiError } = await setup()
  fetchMock.mockResolvedValueOnce(json(status, body))
  const error: unknown = await api.post('/auth/login', {}).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as InstanceType<typeof ApiError>
}

describe('apiClient: malformed error bodies', () => {
  beforeEach(() => vi.useRealTimers())

  it('tolerates FastAPI detail items without loc/msg', async () => {
    const error = await failWith({ detail: [{ msg: 'bad email' }, null, 'oops', { loc: 'email', msg: 42 }] })
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.details).toEqual([{ field: '', issue: 'bad email' }])
    expect(error.fieldErrors).toEqual({})
  })

  it('drops non-string issues/fields from the contract envelope', async () => {
    const error = await failWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        details: [
          { field: 'email', issue: { html: '<b>x</b>' } },
          { field: { nested: true }, issue: 'ignored field name' },
          { field: 'phone', issue: 'Enter a valid mobile number.' },
          'garbage',
        ],
      },
    })
    expect(error.details).toEqual([
      { field: '', issue: 'ignored field name' },
      { field: 'phone', issue: 'Enter a valid mobile number.' },
    ])
    expect(error.fieldErrors).toEqual({ phone: 'Enter a valid mobile number.' })
  })

  it('tolerates details that is not an array, and a non-string code/message', async () => {
    const error = await failWith({ error: { code: 7, message: { a: 1 }, details: { email: 'x' } } }, 400)
    expect(error.details).toEqual([])
    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(typeof error.message).toBe('string')
    expect(error.fieldErrors).toEqual({})
  })

  it('maps field names that collide with Object.prototype keys', async () => {
    const error = await failWith({
      error: { code: 'VALIDATION_ERROR', message: 'x', details: [{ field: 'constructor', issue: 'y' }] },
    })
    expect(error.fieldErrors).toEqual({ constructor: 'y' })
  })

  it('treats an empty error body as a generic failure', async () => {
    const { api, fetchMock } = await setup()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 400 }))
    await expect(api.get('/x')).rejects.toMatchObject({ status: 400, code: 'UNKNOWN_ERROR', details: [] })
  })
})
