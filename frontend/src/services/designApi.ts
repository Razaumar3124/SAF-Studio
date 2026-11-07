import type {
  CreateDesignRequest,
  DesignDetailOut,
  DesignListResponse,
  DesignOut,
  DesignVersionSummaryResponse,
  EntityId,
  SaveDesignVersionRequest,
  UpdateDesignRequest,
} from '@/types/api'
import { api } from './apiClient'
import { endpoints } from './endpoints'

export interface ListDesignsParams {
  page?: number
  pageSize?: number
  status?: string
  search?: string
  sort?: string
}

/**
 * Creates a new gallery wall project via POST /api/v1/designs.
 */
export async function createDesign(
  request: CreateDesignRequest,
  signal?: AbortSignal,
): Promise<DesignOut> {
  return api.post<DesignOut>(endpoints.designs.create, request, { signal })
}

/**
 * Lists the authenticated user's saved designs via GET /api/v1/designs.
 */
export async function listDesigns(
  params?: ListDesignsParams,
  signal?: AbortSignal,
): Promise<DesignListResponse> {
  return api.get<DesignListResponse>(endpoints.designs.list, {
    query: {
      page: params?.page ?? 1,
      page_size: params?.pageSize ?? 50,
      status: params?.status,
      search: params?.search,
      sort: params?.sort ?? 'updated_at:desc',
    },
    signal,
  })
}

/**
 * Retrieves full design details and layout items via GET /api/v1/designs/{id}.
 */
export async function getDesign(
  designId: EntityId,
  signal?: AbortSignal,
): Promise<DesignDetailOut> {
  return api.get<DesignDetailOut>(endpoints.designs.detail(designId), { signal })
}

/**
 * Updates an existing design's metadata via PATCH /api/v1/designs/{id}.
 */
export async function updateDesign(
  designId: EntityId,
  request: UpdateDesignRequest,
  signal?: AbortSignal,
): Promise<DesignOut> {
  return api.patch<DesignOut>(endpoints.designs.update(designId), request, { signal })
}

/**
 * Deletes a saved design via DELETE /api/v1/designs/{id}.
 */
export async function deleteDesign(
  designId: EntityId,
  signal?: AbortSignal,
): Promise<void> {
  return api.delete(endpoints.designs.delete(designId), { signal })
}

/**
 * Creates an immutable version snapshot via POST /api/v1/designs/{id}/versions.
 */
export async function createDesignVersion(
  designId: EntityId,
  request: SaveDesignVersionRequest,
  signal?: AbortSignal,
): Promise<DesignVersionSummaryResponse> {
  return api.post<DesignVersionSummaryResponse>(
    endpoints.designs.versions(designId),
    request,
    { signal },
  )
}

