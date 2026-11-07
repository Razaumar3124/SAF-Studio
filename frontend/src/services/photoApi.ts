import type { EntityId, PhotosListResponse, PhotoUploadResponse } from '@/types/api'
import { api } from './apiClient'
import { endpoints } from './endpoints'

/**
 * Uploads a customer photograph via POST /api/v1/photos/upload.
 * Stored in Cloudflare R2 with EXIF auto-rotation and WebP generation.
 *
 * @param file Binary photograph (JPEG, PNG, or WebP).
 * @param signal Optional AbortSignal.
 * @returns Uploaded photograph metadata and signed URLs.
 */
export async function uploadPhoto(file: File, signal?: AbortSignal): Promise<PhotoUploadResponse> {
  return api.upload<PhotoUploadResponse>(
    endpoints.photos.upload,
    { file },
    { signal },
  )
}

/**
 * Lists the authenticated user's photographs via GET /api/v1/photos.
 *
 * @param page Page number starting at 1.
 * @param pageSize Number of items per page.
 * @param signal Optional AbortSignal.
 * @returns Paginated list of photographs.
 */
export async function listPhotos(
  page = 1,
  pageSize = 50,
  signal?: AbortSignal,
): Promise<PhotosListResponse> {
  return api.get<PhotosListResponse>(endpoints.photos.list, {
    query: { page, page_size: pageSize },
    signal,
  })
}

/**
 * Deletes an owned photograph via DELETE /api/v1/photos/{id}.
 *
 * @param photoId Photo identifier.
 * @param signal Optional AbortSignal.
 */
export async function deletePhoto(photoId: EntityId, signal?: AbortSignal): Promise<void> {
  return api.delete(endpoints.photos.delete(photoId), { signal })
}

