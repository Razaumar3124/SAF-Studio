import { describe, expect, it, vi, beforeEach } from 'vitest'
import { api } from './apiClient'
import {
  createDesign,
  createDesignVersion,
  deleteDesign,
  getDesign,
  listDesigns,
  updateDesign,
} from './designApi'
import { endpoints } from './endpoints'
import type {
  CreateDesignRequest,
  DesignDetailOut,
  DesignListResponse,
  SaveDesignVersionRequest,
  UpdateDesignRequest,
} from '@/types/api'

describe('designApi service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('createDesign posts design data to endpoint', async () => {
    const req: CreateDesignRequest = {
      title: 'Dining Room Gallery',
      wall: {
        width_inches: 144,
        height_inches: 108,
        color_hex: '#EFDECA',
        texture: 'Warm Cream',
        display_unit: 'ft',
        has_sofa: true,
      },
    }

    const mockRes = {
      id: 'design_abc123',
      user_id: 'user_xyz',
      title: 'Dining Room Gallery',
      description: null,
      status: 'draft' as const,
      wall: req.wall!,
      current_version_id: 'v1',
      created_at: '2026-11-08T00:00:00Z',
      updated_at: '2026-11-08T00:00:00Z',
    }

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue(mockRes)

    const result = await createDesign(req)

    expect(postSpy).toHaveBeenCalledWith(endpoints.designs.create, req, { signal: undefined })
    expect(result).toEqual(mockRes)
  })

  it('listDesigns fetches paginated designs', async () => {
    const mockList: DesignListResponse = {
      items: [
        {
          id: 'design_1',
          user_id: 'user_1',
          title: 'Design One',
          description: null,
          status: 'saved',
          wall: { width_inches: 120, height_inches: 96, color_hex: '#F0EBE4', texture: 'plaster_smooth' },
          current_version_id: 'v1',
          current_version_number: 1,
          items_count: 1,
          created_at: '2026-11-08T00:00:00Z',
          updated_at: '2026-11-08T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    }

    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockList)

    const result = await listDesigns({ page: 1, pageSize: 20 })

    expect(getSpy).toHaveBeenCalledWith(endpoints.designs.list, {
      query: {
        page: 1,
        page_size: 20,
        status: undefined,
        search: undefined,
        sort: 'updated_at:desc',
      },
      signal: undefined,
    })
    expect(result).toEqual(mockList)
  })

  it('getDesign fetches single design by ID', async () => {
    const mockDetail: DesignDetailOut = {
      id: 'design_1',
      user_id: 'user_1',
      title: 'Design One',
      description: null,
      status: 'saved',
      wall: { width_inches: 120, height_inches: 96, color_hex: '#F0EBE4', texture: 'plaster_smooth' },
      current_version_id: 'v1',
      created_at: '2026-11-08T00:00:00Z',
      updated_at: '2026-11-08T00:00:00Z',
      current_version: {
        id: 'v1',
        design_id: 'design_1',
        version_number: 1,
        layout_type: 'grid',
        template_id: null,
        items_count: 0,
        bounding_box: { min_x: 0, min_y: 0, max_x: 100, max_y: 80, width_inches: 100, height_inches: 80 },
        items: [],
        created_at: '2026-11-08T00:00:00Z',
      },
    }

    const getSpy = vi.spyOn(api, 'get').mockResolvedValue(mockDetail)

    const result = await getDesign('design_1')

    expect(getSpy).toHaveBeenCalledWith(endpoints.designs.detail('design_1'), { signal: undefined })
    expect(result).toEqual(mockDetail)
  })

  it('updateDesign patches design', async () => {
    const req: UpdateDesignRequest = { title: 'Renamed Wall' }
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ id: 'design_1', title: 'Renamed Wall' } as any)

    await updateDesign('design_1', req)

    expect(patchSpy).toHaveBeenCalledWith(endpoints.designs.update('design_1'), req, { signal: undefined })
  })

  it('deleteDesign calls delete endpoint', async () => {
    const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue(undefined)

    await deleteDesign('design_1')

    expect(deleteSpy).toHaveBeenCalledWith(endpoints.designs.delete('design_1'), { signal: undefined })
  })

  it('createDesignVersion posts version data', async () => {
    const versionReq: SaveDesignVersionRequest = {
      layout_type: 'salon',
      items: [],
      layout_metadata: { gapIn: 3 },
    }

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ version_id: 'v2', version_number: 2 } as any)

    await createDesignVersion('design_1', versionReq)

    expect(postSpy).toHaveBeenCalledWith(endpoints.designs.versions('design_1'), versionReq, { signal: undefined })
  })
})
