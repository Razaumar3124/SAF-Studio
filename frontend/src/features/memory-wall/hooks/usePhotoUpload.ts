import { useCallback, useEffect, useRef } from 'react'
import { isApiError, resolveApiUrl } from '@/services/apiClient'
import { uploadPhoto } from '@/services/photoApi'
import { tokenStorage } from '@/services/tokenStorage'
import { PHOTO_UPLOAD_MIME_TYPES } from '@/types/api'
import type { PhotoRef } from '../lib/plannerState'

/** Largest accepted upload; the server stores a compressed copy of at most 2 MB. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MIN_SIDE_PX = 300

export type UploadResult =
  { ok: true; photo: Extract<PhotoRef, { kind: 'upload' }> } | { ok: false; error: string }

/**
 * Uploads a customer photograph to Cloudflare R2 and MongoDB via POST /api/v1/photos/upload.
 * Generates signed WebP preview and thumbnail URLs, extracts natural dimensions,
 * and maintains object URL revocation for temporary previews and offline fallback.
 */
export function usePhotoUpload() {
  const urls = useRef(new Set<string>())
  const mounted = useRef(true)

  useEffect(() => {
    const set = urls.current
    mounted.current = true
    return () => {
      mounted.current = false
      set.forEach((u) => URL.revokeObjectURL(u))
      set.clear()
    }
  }, [])

  return useCallback(async (file: File): Promise<UploadResult> => {
    if (!(PHOTO_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, error: 'Please choose a JPEG, PNG or WebP photo.' }
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: 'That photo is larger than 15 MB. Please choose a smaller file.' }
    }

    const localUrl = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = localUrl
      await img.decode()

      if (Math.min(img.naturalWidth, img.naturalHeight) < MIN_SIDE_PX) {
        URL.revokeObjectURL(localUrl)
        return { ok: false, error: `That photo is too small to print well (under ${MIN_SIDE_PX} px).` }
      }

      if (!mounted.current) {
        URL.revokeObjectURL(localUrl)
        return { ok: false, error: 'The upload was cancelled.' }
      }

      // If authenticated, persist to Cloudflare R2 and MongoDB
      if (tokenStorage.hasSession()) {
        try {
          const res = await uploadPhoto(file)
          URL.revokeObjectURL(localUrl) // Free browser memory

          const previewUrl = resolveApiUrl(res.preview_url) || res.preview_url
          const thumbUrl = resolveApiUrl(res.thumbnail_url) || res.thumbnail_url

          return {
            ok: true,
            photo: {
              kind: 'upload',
              photoId: String(res.id),
              url: previewUrl,
              thumbnailUrl: thumbUrl,
              name: res.original_filename || file.name.slice(0, 120),
              widthPx: res.width_px || img.naturalWidth,
              heightPx: res.height_px || img.naturalHeight,
            },
          }
        } catch (err) {
          // The server answered with a reason (storage full, library limit, invalid image, …):
          // show it instead of pretending the photo was saved.
          if (isApiError(err) && !err.isNetworkError) {
            URL.revokeObjectURL(localUrl)
            return {
              ok: false,
              error:
                err.status >= 500 && err.status !== 507
                  ? 'We couldn’t save your photo right now. Please try again in a moment.'
                  : err.message,
            }
          }
          // Network blip: keep a session-only local preview so the planner stays usable
          urls.current.add(localUrl)
          return {
            ok: true,
            photo: {
              kind: 'upload',
              url: localUrl,
              name: file.name.slice(0, 120),
              widthPx: img.naturalWidth,
              heightPx: img.naturalHeight,
            },
          }
        }
      }

      // Guest / unauthenticated fallback
      urls.current.add(localUrl)
      return {
        ok: true,
        photo: {
          kind: 'upload',
          url: localUrl,
          name: file.name.slice(0, 120),
          widthPx: img.naturalWidth,
          heightPx: img.naturalHeight,
        },
      }
    } catch {
      URL.revokeObjectURL(localUrl)
      return {
        ok: false,
        error: 'We couldn’t read that image. It may be damaged or in an unsupported format.',
      }
    }
  }, [])
}

/** Effective print resolution of a photo cropped to fill an opening (cover). */
export function effectiveDpi(widthPx: number, heightPx: number, opening: { w: number; h: number }) {
  return Math.round(Math.min(widthPx / opening.w, heightPx / opening.h))
}

export function dpiQuality(dpi: number): { label: string; tone: 'success' | 'warning' | 'error' } {
  if (dpi >= 300) return { label: 'Excellent print quality', tone: 'success' }
  if (dpi >= 150) return { label: 'Good print quality', tone: 'success' }
  if (dpi >= 100) return { label: 'Fair. May look soft up close', tone: 'warning' }
  return { label: 'Low. Choose a smaller frame or larger photo', tone: 'error' }
}
