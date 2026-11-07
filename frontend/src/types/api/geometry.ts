/** Contract §6 — Geometry Engine & Layout Validation. All values in inches, top-left origin. */
import type { BoundingBox, MattingInches } from './common'

/* ----------------------------- §6.1 Validate ------------------------------- */

export interface GeometryFrameInput {
  item_id: string
  x_inches: number
  y_inches: number
  photo_width_inches: number
  photo_height_inches: number
  matting: MattingInches
  frame_profile_width_inches: number
}

export interface ValidateLayoutRequest {
  wall: {
    width_inches: number
    height_inches: number
    safe_margin_inches: number
  }
  frames: GeometryFrameInput[]
}

export interface LayoutIssue {
  code: string
  message: string
}

export interface CalculatedLayoutItem {
  item_id: string
  outer_x_inches: number
  outer_y_inches: number
  outer_width_inches: number
  outer_height_inches: number
}

export interface ValidateLayoutResponse {
  is_valid: boolean
  bounding_box: BoundingBox
  wall_coverage_percentage: number
  errors: LayoutIssue[]
  warnings: LayoutIssue[]
  calculated_items: CalculatedLayoutItem[]
}

/* ------------------------- §6.2 Generate & Solvers -------------------------- */

export type LayoutStyleType = 'grid' | 'salon' | 'centre' | 'row'

export interface WallGeometryInput {
  width_inches: number
  height_inches: number
  margin_inches?: number
  has_sofa?: boolean
  eye_level_height_inches?: number
}

export interface MattingGeometryInput {
  enabled: boolean
  top_inches: number
  bottom_inches: number
  left_inches: number
  right_inches: number
}

export interface FrameItemGeometryInput {
  item_id: string
  photo_id?: string | null
  photo_width_inches: number
  photo_height_inches: number
  matting: MattingGeometryInput
  frame_profile_width_inches: number
  orientation: 'portrait' | 'landscape' | 'square'
}

export interface PlacedItemOutput {
  item_id: string
  photo_id?: string | null
  outer_x_inches: number
  outer_y_inches: number
  outer_width_inches: number
  outer_height_inches: number
  photo_x_inches: number
  photo_y_inches: number
  photo_width_inches: number
  photo_height_inches: number
}

export interface GenerateLayoutRequest {
  wall: WallGeometryInput
  frames: FrameItemGeometryInput[]
  layout_style?: LayoutStyleType | null
  spacing_inches?: number
  engine_mode?: 'smart_llm' | 'geometric'
  seed?: number | null
  variant?: number
}

export interface GenerateLayoutResponse {
  layout_type: LayoutStyleType
  variant: number
  seed: number
  bounding_box: BoundingBox
  wall_coverage_percentage: number
  fits: boolean
  engine_used: 'smart_llm' | 'geometric' | 'fallback_geometric'
  ai_rationale?: string | null
  warnings?: LayoutIssue[]
  items: PlacedItemOutput[]
}

export interface RegenerateLayoutRequest {
  wall: WallGeometryInput
  frames: FrameItemGeometryInput[]
  layout_style: LayoutStyleType
  current_seed: number
  current_variant?: number
  spacing_inches?: number
}

export interface RegenerateLayoutResponse {
  layout_type: LayoutStyleType
  variant: number
  seed: number
  bounding_box: BoundingBox
  wall_coverage_percentage: number
  fits: boolean
  engine_used: 'geometric'
  items: PlacedItemOutput[]
}

export interface RedesignLayoutRequest {
  wall: WallGeometryInput
  frames: FrameItemGeometryInput[]
  current_layout_style: LayoutStyleType
  spacing_inches?: number
  engine_mode?: 'smart_llm' | 'geometric'
}

export interface RedesignLayoutResponse {
  layout_type: LayoutStyleType
  variant: number
  seed: number
  bounding_box: BoundingBox
  wall_coverage_percentage: number
  fits: boolean
  engine_used: 'smart_llm' | 'geometric' | 'fallback_geometric'
  ai_rationale?: string | null
  items: PlacedItemOutput[]
}
