import { describe, expect, it, vi, beforeEach } from 'vitest'
import { api } from './apiClient'
import { deletePhoto, listPhotos, uploadPhoto } from './photoApi'
import { endpoints } from './endpoints'

describe('photoApi service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uploadPhoto sends multipart file to upload endpoint', async () => {
    const mockFile = new File(['test image data'], 'family.jpg', { type: 'image/jpeg' })
    const mockResponse = {
      id: 'photo_123',
      filename: 'family.jpg',
      content_type: 'image/jpeg',
      byte_size: 1024,
      width_px: 1200,
      height_px: 1600,
      aspect_ratio: 0.75,
      preview_url: '/api/v1/photos/photo_123/preview',
      thumbnail_url: '/api/v1/photos/photo_123/thumbnail',
      created_at: '2026-11-08T00:00:00Z',
    }

    const uploadSpy = vi.spyOn(api, 'upload').mockResolvedValue(mockResponse)

    const result = await uploadPhoto(mockFile)

    expect(uploadSpy).toHaveBeenCalledWith(endpoints.photos.upload, { file: mockFile }, { signal: undefined })
    expect(result).toEqual(mockResponse)
  })

  it('listPhotos fetches photos with pagination and sorting', async () => {
    const mockList = {
      items: [
        {
          id: 'photo_1',
          filename: 'one.jpg',
          content_type: 'image/jpeg',
          byte_size: 2048,
          width_px: 800,
          height_px: 600,
          aspect_ratio: 1.333,
          created_at: '2026-11-08T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    }

    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockList)

    const result = await listPhotos(1, 20)

    expect(getSpy).toHaveBeenCalledWith(endpoints.photos.list, {
      query: { page: 1, page_size: 20 },
      signal: undefined,
    })
    expect(result).toEqual(mockList)
  })

  it('deletePhoto calls delete endpoint with photo ID', async () => {
    const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue(undefined)

    await deletePhoto('photo_999')

    expect(deleteSpy).toHaveBeenCalledWith(endpoints.photos.delete('photo_999'), { signal: undefined })
  })
})
