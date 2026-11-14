// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/apiClient'
import * as photoApi from '@/services/photoApi'
import { tokenStorage } from '@/services/tokenStorage'
import { MAX_UPLOAD_BYTES, usePhotoUpload } from './usePhotoUpload'

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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

/** Server-side safeguards (storage cap, library limit) must reach the user, not be hidden. */
describe('usePhotoUpload server errors', () => {
  const upload = async () => {
    const { result } = renderHook(() => usePhotoUpload())
    const pending = result.current(photo())
    await flush()
    decodes.shift()?.()
    return pending
  }

  beforeEach(() => {
    vi.spyOn(tokenStorage, 'hasSession').mockReturnValue(true)
  })

  it('accepts files up to 15 MB and rejects larger ones before uploading', async () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024)
    const spy = vi.spyOn(photoApi, 'uploadPhoto')
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 })
    const { result } = renderHook(() => usePhotoUpload())
    const res = await result.current(big)
    expect(res).toEqual({
      ok: false,
      error: 'That photo is larger than 15 MB. Please choose a smaller file.',
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows the storage-full message instead of a fake local success', async () => {
    const message =
      'Photo uploads are temporarily paused because our storage is full. Your existing photos and designs are safe.'
    vi.spyOn(photoApi, 'uploadPhoto').mockRejectedValue(
      new ApiError({ status: 507, code: 'STORAGE_QUOTA_EXCEEDED', message }),
    )
    const res = await upload()
    expect(res).toEqual({ ok: false, error: message })
    expect(revoked).toEqual(created) // the temporary preview URL is released
  })

  it('shows the per-user library limit message', async () => {
    const message =
      'Your photo library is full (250 MB). Remove a few photos you no longer need to upload more.'
    vi.spyOn(photoApi, 'uploadPhoto').mockRejectedValue(
      new ApiError({ status: 507, code: 'USER_STORAGE_LIMIT_REACHED', message }),
    )
    expect(await upload()).toEqual({ ok: false, error: message })
  })

  it('uses a friendly message for other server failures', async () => {
    vi.spyOn(photoApi, 'uploadPhoto').mockRejectedValue(
      new ApiError({ status: 503, code: 'STORAGE_UNAVAILABLE', message: 'raw detail' }),
    )
    expect(await upload()).toEqual({
      ok: false,
      error: 'We couldn’t save your photo right now. Please try again in a moment.',
    })
  })

  it('keeps a local preview only when the server is unreachable', async () => {
    vi.spyOn(photoApi, 'uploadPhoto').mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }),
    )
    const res = await upload()
    expect(res).toMatchObject({ ok: true, photo: { kind: 'upload', url: 'blob:test/1' } })
    expect(res).not.toHaveProperty('photo.photoId')
  })
})
