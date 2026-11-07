import type {
  GenerateLayoutRequest,
  GenerateLayoutResponse,
  RedesignLayoutRequest,
  RedesignLayoutResponse,
  RegenerateLayoutRequest,
  RegenerateLayoutResponse,
  ValidateLayoutRequest,
  ValidateLayoutResponse,
} from '@/types/api'
import { api } from './apiClient'
import { endpoints } from './endpoints'

/**
 * Validates wall bounds and checks collisions via POST /api/v1/geometry/validate-layout.
 */
export async function validateLayout(
  request: ValidateLayoutRequest,
  signal?: AbortSignal,
): Promise<ValidateLayoutResponse> {
  return api.post<ValidateLayoutResponse>(endpoints.geometry.validateLayout, request, { signal })
}

/**
 * Generates an optimal gallery wall layout via POST /api/v1/geometry/generate-layout.
 * Utilizes the hybrid Groq LLM + deterministic Python geometry engine.
 */
export async function generateLayout(
  request: GenerateLayoutRequest,
  signal?: AbortSignal,
): Promise<GenerateLayoutResponse> {
  return api.post<GenerateLayoutResponse>(endpoints.geometry.generateLayout, request, { signal })
}

/**
 * Regenerates the current layout with an alternative variation seed via POST /api/v1/geometry/regenerate.
 * Guaranteed 0 AI token consumption (pure geometric solver).
 */
export async function regenerateLayout(
  request: RegenerateLayoutRequest,
  signal?: AbortSignal,
): Promise<RegenerateLayoutResponse> {
  return api.post<RegenerateLayoutResponse>(endpoints.geometry.regenerateLayout, request, { signal })
}

/**
 * Redesigns the current layout with a new archetype or creative direction via POST /api/v1/geometry/redesign.
 */
export async function redesignLayout(
  request: RedesignLayoutRequest,
  signal?: AbortSignal,
): Promise<RedesignLayoutResponse> {
  return api.post<RedesignLayoutResponse>(endpoints.geometry.redesignLayout, request, { signal })
}

