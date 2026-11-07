import { describe, expect, it, vi, beforeEach } from 'vitest'
import { api } from './apiClient'
import {
  generateLayout,
  redesignLayout,
  regenerateLayout,
  validateLayout,
} from './geometryApi'
import { endpoints } from './endpoints'
import type {
  GenerateLayoutRequest,
  RedesignLayoutRequest,
  RegenerateLayoutRequest,
  ValidateLayoutRequest,
} from '@/types/api'

describe('geometryApi service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('generateLayout posts payload to geometry generate endpoint', async () => {
    const req: GenerateLayoutRequest = {
      wall: { width_inches: 120, height_inches: 96, has_sofa: true },
      frames: [
        {
          item_id: 'f1',
          photo_width_inches: 12,
          photo_height_inches: 16,
          matting: { enabled: true, top_inches: 2, bottom_inches: 2, left_inches: 2, right_inches: 2 },
          frame_profile_width_inches: 1,
          orientation: 'portrait',
        },
      ],
      layout_style: 'grid',
      spacing_inches: 3,
      engine_mode: 'smart_llm',
    }

    const mockRes = {
      layout_type: 'grid' as const,
      variant: 0,
      seed: 42,
      bounding_box: { x: 10, y: 10, width: 100, height: 70 },
      wall_coverage_percentage: 45.5,
      fits: true,
      engine_used: 'smart_llm' as const,
      ai_rationale: 'Balanced 3x3 layout with consistent rhythm',
      items: [],
    }

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue(mockRes)

    const result = await generateLayout(req)

    expect(postSpy).toHaveBeenCalledWith(endpoints.geometry.generateLayout, req, { signal: undefined })
    expect(result).toEqual(mockRes)
  })

  it('regenerateLayout posts payload to regenerate endpoint', async () => {
    const req: RegenerateLayoutRequest = {
      wall: { width_inches: 120, height_inches: 96 },
      frames: [],
      layout_style: 'salon',
      current_seed: 42,
      current_variant: 0,
      spacing_inches: 3,
    }

    const mockRes = {
      layout_type: 'salon' as const,
      variant: 1,
      seed: 1024,
      bounding_box: { x: 10, y: 10, width: 90, height: 60 },
      wall_coverage_percentage: 42.0,
      fits: true,
      engine_used: 'geometric' as const,
      items: [],
    }

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue(mockRes)

    const result = await regenerateLayout(req)

    expect(postSpy).toHaveBeenCalledWith(endpoints.geometry.regenerateLayout, req, { signal: undefined })
    expect(result).toEqual(mockRes)
  })

  it('redesignLayout posts payload to redesign endpoint', async () => {
    const req: RedesignLayoutRequest = {
      wall: { width_inches: 120, height_inches: 96 },
      frames: [],
      current_layout_style: 'grid',
      spacing_inches: 3,
      engine_mode: 'smart_llm',
    }

    const mockRes = {
      layout_type: 'salon' as const,
      variant: 0,
      seed: 2048,
      bounding_box: { x: 12, y: 12, width: 85, height: 65 },
      wall_coverage_percentage: 40.0,
      fits: true,
      engine_used: 'smart_llm' as const,
      ai_rationale: 'Shifted from rigid grid to an organic salon gallery wall',
      items: [],
    }

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue(mockRes)

    const result = await redesignLayout(req)

    expect(postSpy).toHaveBeenCalledWith(endpoints.geometry.redesignLayout, req, { signal: undefined })
    expect(result).toEqual(mockRes)
  })

  it('validateLayout posts layout frames to validate endpoint', async () => {
    const req: ValidateLayoutRequest = {
      wall: { width_inches: 120, height_inches: 96, safe_margin_inches: 6 },
      frames: [
        {
          item_id: 'f1',
          x_inches: 10,
          y_inches: 10,
          photo_width_inches: 12,
          photo_height_inches: 16,
          matting: { top_inches: 2, bottom_inches: 2, left_inches: 2, right_inches: 2 },
          frame_profile_width_inches: 1,
        },
      ],
    }

    const mockRes = {
      is_valid: true,
      bounding_box: { x: 10, y: 10, width: 14, height: 18 },
      wall_coverage_percentage: 2.18,
      errors: [],
      warnings: [],
      calculated_items: [],
    }

    const postSpy = vi.spyOn(api, 'post').mockResolvedValue(mockRes)

    const result = await validateLayout(req)

    expect(postSpy).toHaveBeenCalledWith(endpoints.geometry.validateLayout, req, { signal: undefined })
    expect(result).toEqual(mockRes)
  })
})
