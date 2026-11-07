import { PAINT_SHADES } from '@/features/memory-wall/constants'
import type { Scene } from '@/features/memory-wall/lib/geometry/scene'
import type { PlannerState } from '@/features/memory-wall/lib/plannerState'
import type { QuotePrepareResponse } from '@/types/api'
import { api } from './apiClient'
import { endpoints } from './endpoints'

/**
 * Transforms current client planner state and calculated scene geometry
 * into the payload expected by POST /api/v1/quotes/prepare.
 */
export function serializeDesignForQuote(state: PlannerState, scene?: Scene) {
  const paint = PAINT_SHADES.find((p) => p.id === state.wall.paintId)

  return {
    title: state.title?.trim() || 'Memory Wall Design',
    wall: {
      widthIn: state.wall.widthIn,
      heightIn: state.wall.heightIn,
      paintId: state.wall.paintId,
      colorHex: paint?.hex ?? '#F0EBE4',
      texture: paint?.label ?? undefined,
      displayUnit: state.displayUnit,
      hasSofa: state.preview.sofa,
    },
    layout: {
      style: state.layout.style,
      gapIn: state.layout.gapIn,
    },
    frames: state.frames.map((frame, index) => {
      const sceneFrame = scene?.frames[index]
      return {
        id: frame.id,
        sizeId: frame.sizeId,
        orientation: frame.orientation,
        finishId: frame.finishId,
        mount: {
          enabled: frame.mount.enabled,
          colourId: frame.mount.colourId,
          marginIn: frame.mount.marginIn,
        },
        photo: frame.photo
          ? {
              kind: frame.photo.kind,
              sampleId: frame.photo.kind === 'sample' ? frame.photo.sampleId : undefined,
              name: frame.photo.kind === 'upload' ? frame.photo.name : undefined,
              url: frame.photo.kind === 'upload' ? frame.photo.url : undefined,
            }
          : undefined,
        x: sceneFrame?.outer.x,
        y: sceneFrame?.outer.y,
      }
    }),
  }
}

/**
 * Prepares a quote snapshot on the backend, generating a unique quote reference,
 * R2-hosted preview image, and WhatsApp Click-to-Chat URL.
 */
export async function prepareQuote(
  previewBlob: Blob,
  state: PlannerState,
  scene?: Scene,
): Promise<QuotePrepareResponse> {
  const designData = serializeDesignForQuote(state, scene)
  const file = new File([previewBlob], 'wall-preview.png', { type: 'image/png' })

  return api.upload<QuotePrepareResponse>(endpoints.quotes.prepare, {
    file,
    design_data: JSON.stringify(designData),
  })
}
