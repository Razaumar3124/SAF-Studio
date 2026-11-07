/** Contract §8 — Designs & Versions Management. */
import type {
  BoundingBox,
  EntityId,
  HexColor,
  ISODateTime,
  MattingInches,
} from './common'
import type { GlassType } from './pricing'
import type { TemplateCategory } from './templates'

export type WallTexture = 'plaster_smooth' | (string & {})

export interface DesignWall {
  width_inches: number
  height_inches: number
  /** Paint Shade swatch. */
  color_hex: HexColor
  texture: WallTexture
  display_unit?: 'in' | 'cm' | 'mm' | 'ft'
  has_sofa?: boolean
}

export type DesignStatus = 'draft' | 'saved' | 'ordered' | (string & {})

/** `custom` = hand-arranged; otherwise the template category it came from. */
export type LayoutType = 'custom' | TemplateCategory | 'grid' | 'salon' | 'centre' | 'row' | 'triptych'

/* ------------------------------ §8.1 Create -------------------------------- */

/** POST /designs */
export interface CreateDesignRequest {
  title: string
  description?: string | null
  wall?: DesignWall
}

export interface DesignOut {
  id: EntityId
  user_id: EntityId
  title: string
  description: string | null
  wall: DesignWall
  current_version_id: EntityId | null
  current_version_number?: number | null
  status: DesignStatus
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface UpdateDesignRequest {
  title?: string | null
  description?: string | null
  status?: DesignStatus | null
  wall?: DesignWall | null
}

/* --------------------------- §8.2 Save version ----------------------------- */

export interface DesignMatting extends MattingInches {
  /** Mount Colour swatch. */
  color_hex?: HexColor
  enabled?: boolean
}

export interface DesignItemInput {
  item_id: string
  frame_id: string
  photo_id?: string | null
  sample_id?: string | null
  position_x_inches: number
  position_y_inches: number
  photo_width_inches: number
  photo_height_inches: number
  total_width_inches?: number | null
  total_height_inches?: number | null
  orientation?: 'portrait' | 'landscape' | 'square' | string
  finish_id?: string | null
  size_id?: string | null
  matting: DesignMatting
  glass_type?: GlassType | string
}

/** POST /designs/{id}/versions */
export interface SaveDesignVersionRequest {
  layout_type?: LayoutType | string
  template_id?: string | null
  items: DesignItemInput[]
  layout_metadata?: Record<string, unknown> | null
  preview?: Record<string, unknown> | null
}

export interface DesignVersionSummaryResponse {
  version_id: EntityId
  design_id: EntityId
  version_number: number
  layout_type: string
  items_count: number
  bounding_box: BoundingBox
  created_at: ISODateTime
}

/* ----------------------------- §8.3 Detail --------------------------------- */

export interface DesignItemOutput extends DesignItemInput {
  photo_missing?: boolean
  total_width_inches: number
  total_height_inches: number
}

export interface DesignVersionOutput {
  id: EntityId
  design_id: EntityId
  version_number: number
  layout_type: string
  template_id?: string | null
  items_count: number
  bounding_box: BoundingBox
  items: DesignItemOutput[]
  layout_metadata?: Record<string, unknown> | null
  preview?: Record<string, unknown> | null
  created_at: ISODateTime
}

export interface DesignDetailOut {
  id: EntityId
  user_id: EntityId
  title: string
  description: string | null
  status: DesignStatus
  wall: DesignWall
  current_version_id: EntityId | null
  current_version: DesignVersionOutput | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

/* ----------------------------- §8.4 Listing -------------------------------- */

export interface DesignListItemOut {
  id: EntityId
  user_id: EntityId
  title: string
  description: string | null
  status: DesignStatus
  wall: DesignWall
  current_version_id: EntityId | null
  current_version_number: number | null
  items_count: number
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface DesignListResponse {
  items: DesignListItemOut[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
