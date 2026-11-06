// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePhotoUpload } from './usePhotoUpload'

/**
 * Object-URL lifecycle (audit B3): URLs live for the visit and are revoked on unmount, and a decode
 * that finishes after unmount must release its URL instead of registering it (it would leak).
 */
let created: string[]
let revoked: string[]
/** Resolves the pending `img.decode()` calls, in order. */
let decodes: Array<() => void>

beforeEach(() => {
  created = []
  revoked = []
  decodes = []
  let n = 0
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => {
      const url = `blob:test/${++n}`
      created.push(url)
      return url
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  })
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      naturalWidth = 1200
      naturalHeight = 1600
      decode() {
        return new Promise<void>((resolve) => decodes.push(resolve))
      }
    },
  )
})

afterEach(cleanup)

const photo = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('usePhotoUpload', () => {
  it('keeps a successful upload URL alive until the planner unmounts', async () => {
    const { result, unmount } = renderHook(() => usePhotoUpload())
    const pending = result.current(photo())
    await flush()
    decodes.shift()?.()
    const res = await pending
    expect(res.ok).toBe(true)
    expect(revoked).toEqual([])
    unmount()
    expect(revoked).toEqual(created)
  })

  it('revokes the URL when the planner unmounts before the decode finishes (no leak)', async () => {
    const { result, unmount } = renderHook(() => usePhotoUpload())
    const pending = result.current(photo())
    await flush()
    unmount()
    decodes.shift()?.()
    const res = await pending
    expect(res.ok).toBe(false)
    expect(created).toHaveLength(1)
    expect(revoked).toEqual(created)
  })

  it('rejects unsupported types without creating a URL', async () => {
    const { result } = renderHook(() => usePhotoUpload())
    const res = await result.current(new File(['x'], 'a.gif', { type: 'image/gif' }))
    expect(res.ok).toBe(false)
    expect(created).toEqual([])
  })
})
