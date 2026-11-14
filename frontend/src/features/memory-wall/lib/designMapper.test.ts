import { describe, expect, it } from 'vitest'
import {
  backendDesignToState,
  fromBackendLayoutType,
  stateToBackendDesign,
  toBackendLayoutType,
} from './designMapper'
import { createInitialState } from './plannerState'
import type { DesignDetailOut } from '@/types/api'

describe('designMapper', () => {
  it('converts LayoutStyleId to and from backend LayoutType', () => {
    expect(toBackendLayoutType('grid')).toBe('grid')
    expect(toBackendLayoutType('salon')).toBe('salon')
    expect(toBackendLayoutType('centre')).toBe('custom')
    expect(toBackendLayoutType('row')).toBe('custom')

    expect(fromBackendLayoutType('grid')).toBe('grid')
    expect(fromBackendLayoutType('salon')).toBe('salon')
    expect(fromBackendLayoutType('mosaic')).toBe('salon')
    expect(fromBackendLayoutType('organic')).toBe('salon')
    expect(fromBackendLayoutType('triptych')).toBe('row')
    expect(fromBackendLayoutType('custom')).toBe('grid')
  })

  it('stateToBackendDesign maps PlannerState to CreateDesignRequest and SaveDesignVersionRequest', () => {
    const state = createInitialState()
    state.title = 'My Living Room Wall'
    state.frames[0] = {
      ...state.frames[0]!,
      photo: {
        kind: 'upload',
        photoId: 'photo_abc',
        url: 'http://example.com/p.jpg',
        thumbnailUrl: 'http://example.com/t.jpg',
        name: 'test.jpg',
        widthPx: 1200,
        heightPx: 1600,
      },
    }

    const { createReq, versionReq } = stateToBackendDesign(state)

    expect(createReq.title).toBe('My Living Room Wall')
    expect(createReq.wall?.width_inches).toBe(144)
    expect(createReq.wall?.height_inches).toBe(108)
    expect(createReq.wall?.color_hex).toBe('#EFDECA') // Warm Cream

    expect(versionReq.layout_type).toBe('grid')
    expect(versionReq.items).toHaveLength(9)
    expect(versionReq.items[0]?.photo_id).toBe('photo_abc')
    expect(versionReq.items[0]?.photo_width_inches).toBe(12)
    expect(versionReq.items[0]?.photo_height_inches).toBe(16)
    expect(versionReq.items[0]?.matting.enabled).toBe(true)
  })

  it('backendDesignToState restores PlannerState from DesignDetailOut', () => {
    const detail: DesignDetailOut = {
      id: '507f1f77bcf86cd799439011',
      user_id: '507f1f77bcf86cd799439012',
      title: 'Restored Design',
      description: null,
      wall: {
        width_inches: 120,
        height_inches: 96,
        color_hex: '#EFDECA',
        texture: 'Warm Cream',
        display_unit: 'in',
        has_sofa: true,
      },
      current_version_id: 'v1',
      status: 'saved',
      created_at: '2026-11-08T00:00:00Z',
      updated_at: '2026-11-08T00:00:00Z',
      current_version: {
        id: 'v1',
        design_id: '507f1f77bcf86cd799439011',
        version_number: 1,
        layout_type: 'grid',
        template_id: 'balanced-grid',
        items_count: 1,
        bounding_box: {
          min_x: 0,
          min_y: 0,
          max_x: 100,
          max_y: 80,
          width_inches: 100,
          height_inches: 80,
        },
        items: [
          {
            item_id: 'f1',
            frame_id: 'natural-oak',
            photo_id: '507f1f77bcf86cd799439099',
            position_x_inches: 10,
            position_y_inches: 10,
            photo_width_inches: 8,
            photo_height_inches: 10,
            total_width_inches: 14,
            total_height_inches: 16,
            orientation: 'portrait',
            finish_id: 'natural-oak',
            size_id: '8x10',
            matting: {
              enabled: true,
              top_inches: 2,
              bottom_inches: 2,
              left_inches: 2,
              right_inches: 2,
              color_hex: '#F4F3F3',
            },
          },
        ],
        layout_metadata: {
          gapIn: 3,
          seed: 42,
          variant: 1,
        },
        preview: {
          sofa: true,
          indexBadges: true,
          guides: true,
        },
        created_at: '2026-11-08T00:00:00Z',
      },
    }

    const state = backendDesignToState(detail)

    expect(state.title).toBe('Restored Design')
    expect(state.wall.widthIn).toBe(120)
    expect(state.wall.heightIn).toBe(96)
    expect(state.wall.paintId).toBe('warm-cream')
    expect(state.layout.style).toBe('grid')
    expect(state.layout.seed).toBe(42)
    expect(state.layout.variant).toBe(1)
    expect(state.frames).toHaveLength(1)
    expect(state.frames[0]?.sizeId).toBe('8x10')
    expect(state.frames[0]?.finishId).toBe('natural-oak')
    const photo = state.frames[0]?.photo
    expect(photo?.kind).toBe('upload')
    expect(photo?.kind === 'upload' ? photo.photoId : undefined).toBe('507f1f77bcf86cd799439099')
  })
})
