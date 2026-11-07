import { resolveApiUrl } from '@/services/apiClient'
import type {
  CreateDesignRequest,
  DesignDetailOut,
  DesignItemInput,
  SaveDesignVersionRequest,
} from '@/types/api'
import {
  FRAME_SIZES,
  LAYOUT_STYLES,
  MOUNT_COLOURS,
  PAINT_SHADES,
  WOOD_FINISHES,
  type LayoutStyleId,
  type Orientation,
} from '../constants'
import { buildScene, frameGeometry } from './geometry/scene'
import type { FrameConfig, PlannerState } from './plannerState'

export function toBackendLayoutType(style: LayoutStyleId): string {
  switch (style) {
    case 'grid':
      return 'grid'
    case 'salon':
      return 'salon'
    case 'centre':
      return 'custom'
    case 'row':
      return 'custom'
    default:
      return 'custom'
  }
}

export function fromBackendLayoutType(layoutType: string): LayoutStyleId {
  switch (layoutType) {
    case 'grid':
      return 'grid'
    case 'salon':
    case 'mosaic':
    case 'organic':
      return 'salon'
    case 'triptych':
      return 'row'
    default:
      return 'grid'
  }
}

/**
 * Maps frontend PlannerState into backend CreateDesignRequest and SaveDesignVersionRequest.
 */
export function stateToBackendDesign(state: PlannerState): {
  createReq: CreateDesignRequest
  versionReq: SaveDesignVersionRequest
} {
  const paint = PAINT_SHADES.find((p) => p.id === state.wall.paintId)
  const scene = buildScene(state)

  const createReq: CreateDesignRequest = {
    title: state.title.trim() || 'My Memory Wall',
    description: null,
    wall: {
      width_inches: state.wall.widthIn,
      height_inches: state.wall.heightIn,
      color_hex: (paint?.hex || '#F0EBE4') as `#${string}`,
      texture: paint?.label || 'plaster_smooth',
      display_unit: state.displayUnit === 'm' ? 'cm' : state.displayUnit,
      has_sofa: state.preview.sofa,
    },
  }

  const items: DesignItemInput[] = state.frames.map((frame, index) => {
    const geo = frameGeometry(frame)
    const sceneFrame = scene.frames[index]
    const mountColor = MOUNT_COLOURS.find((m) => m.id === frame.mount.colourId)

    return {
      item_id: frame.id,
      frame_id: frame.finishId || 'natural-oak',
      photo_id: frame.photo?.kind === 'upload' && frame.photo.photoId ? frame.photo.photoId : null,
      sample_id: frame.photo?.kind === 'sample' ? frame.photo.sampleId : null,
      position_x_inches: sceneFrame?.outer.x ?? 0,
      position_y_inches: sceneFrame?.outer.y ?? 0,
      photo_width_inches: geo.opening.w,
      photo_height_inches: geo.opening.h,
      total_width_inches: geo.outer.w,
      total_height_inches: geo.outer.h,
      orientation: frame.orientation,
      finish_id: frame.finishId,
      size_id: frame.sizeId,
      matting: {
        enabled: frame.mount.enabled,
        top_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        bottom_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        left_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        right_inches: frame.mount.enabled ? frame.mount.marginIn : 0,
        color_hex: (mountColor?.hex || '#F4F3F3') as `#${string}`,
      },
      glass_type: 'standard',
    }
  })

  const versionReq: SaveDesignVersionRequest = {
    layout_type: state.layout.style,
    template_id: state.templateId,
    items,
    layout_metadata: {
      gapIn: state.layout.gapIn,
      gapUnit: state.layout.gapUnit,
      seed: state.layout.seed,
      variant: state.layout.variant,
    },
    preview: {
      sofa: state.preview.sofa,
      indexBadges: state.preview.indexBadges,
      guides: state.preview.guides,
    },
  }

  return { createReq, versionReq }
}

/**
 * Maps backend DesignDetailOut (from MongoDB) back into full client PlannerState.
 */
export function backendDesignToState(detail: DesignDetailOut): PlannerState {
  // Match wall paint by hex code or fallback
  const paint =
    PAINT_SHADES.find((p) => p.hex.toLowerCase() === detail.wall.color_hex.toLowerCase()) ??
    PAINT_SHADES[0]

  const version = detail.current_version
  const layoutStyle =
    (LAYOUT_STYLES.find((s) => s.id === version?.layout_type)?.id as LayoutStyleId) ?? 'grid'

  const metadata = (version?.layout_metadata as Record<string, unknown> | null) ?? {}
  const gapIn = typeof metadata.gapIn === 'number' ? metadata.gapIn : 3
  const seed = typeof metadata.seed === 'number' ? metadata.seed : 0
  const variant = typeof metadata.variant === 'number' ? metadata.variant : 0

  const previewMeta = (version?.preview as Record<string, unknown> | null) ?? {}

  const frames: FrameConfig[] = (version?.items ?? []).map((item, index) => {
    // Validate sizeId
    const sizeId = FRAME_SIZES.find((s) => s.id === item.size_id)?.id ?? '12x16'
    // Validate finishId
    const finishId = WOOD_FINISHES.find((f) => f.id === item.finish_id)?.id ?? 'natural-oak'
    // Validate orientation
    const orientation: Orientation =
      item.orientation === 'landscape' || item.orientation === 'portrait'
        ? item.orientation
        : 'portrait'

    // Mount
    const mountEnabled = item.matting?.enabled ?? true
    const mountColor =
      MOUNT_COLOURS.find((m) => m.hex.toLowerCase() === item.matting?.color_hex?.toLowerCase()) ??
      MOUNT_COLOURS[0]
    const mountMargin = item.matting?.top_inches ?? 2

    // Photo
    let photo: FrameConfig['photo'] = null
    if (item.photo_id && !item.photo_missing) {
      photo = {
        kind: 'upload',
        photoId: String(item.photo_id),
        url: resolveApiUrl(`/photos/${item.photo_id}/preview`) || `/photos/${item.photo_id}/preview`,
        thumbnailUrl:
          resolveApiUrl(`/photos/${item.photo_id}/thumbnail`) || `/photos/${item.photo_id}/thumbnail`,
        name: `Photo ${index + 1}`,
        widthPx: item.photo_width_inches * 100,
        heightPx: item.photo_height_inches * 100,
      }
    } else if (item.sample_id) {
      photo = {
        kind: 'sample',
        sampleId: item.sample_id,
      }
    }

    return {
      id: item.item_id || `frame-${index + 1}`,
      sizeId,
      orientation,
      finishId,
      mount: {
        enabled: mountEnabled,
        colourId: mountColor?.id ?? MOUNT_COLOURS[0]!.id,
        marginIn: mountMargin,
      },
      photo,
    }
  })

  return {
    title: detail.title,
    templateId: version?.template_id ?? null,
    wall: {
      widthIn: detail.wall.width_inches,
      heightIn: detail.wall.height_inches,
      paintId: paint?.id ?? PAINT_SHADES[0]!.id,
    },
    displayUnit: detail.wall.display_unit === 'mm' ? 'cm' : (detail.wall.display_unit ?? 'in'),
    layout: {
      style: layoutStyle,
      gapIn,
      gapUnit: 'in',
      seed,
      variant,
    },
    frames: frames.length > 0 ? frames : Array.from({ length: 9 }, (_, i) => ({
      id: `f-${i}`,
      sizeId: '12x16',
      orientation: 'portrait',
      finishId: 'natural-oak',
      mount: { enabled: true, colourId: 'museum-white', marginIn: 2 },
      photo: null,
    })),
    selectedIndex: 0,
    fillWithSamples: false,
    preview: {
      sofa: typeof previewMeta.sofa === 'boolean' ? previewMeta.sofa : (detail.wall.has_sofa ?? true),
      indexBadges: typeof previewMeta.indexBadges === 'boolean' ? previewMeta.indexBadges : true,
      guides: typeof previewMeta.guides === 'boolean' ? previewMeta.guides : true,
    },
  }
}
