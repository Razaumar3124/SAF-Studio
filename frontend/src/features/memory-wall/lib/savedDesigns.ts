import { isApiError } from '@/services/apiClient'
import { tokenStorage } from '@/services/tokenStorage'
import * as designApi from '@/services/designApi'
import {
  backendDesignToState,
  stateToBackendDesign,
} from './designMapper'
import {
  createInitialState,
  plannerReducer,
  sanitizePlannerState,
  type PlannerState,
} from './plannerState'
import { findTemplate } from './templates'

export interface SavedDesign {
  id: string
  title: string
  /** ISO-8601 */
  savedAt: string
  state: PlannerState
  /** True when session-only unpersisted blob uploads were dropped while saving. */
  droppedUploads: boolean
}

const STORAGE_KEY = 'saf.mock.savedDesigns.v1'
const MAX_DESIGNS = 50
const listeners = new Set<() => void>()
let cache: SavedDesign[] | null = null
let isSyncing = false

function seed(): SavedDesign[] {
  const fromTemplate = (
    id: string,
    templateId: string,
    title: string,
    savedAt: string,
    patch: (s: PlannerState) => PlannerState = (s) => s,
  ): SavedDesign => {
    const template = findTemplate(templateId)
    let state = createInitialState()
    if (template) state = plannerReducer(state, { type: 'template/apply', template })
    return { id, title, savedAt, state: patch({ ...state, title }), droppedUploads: false }
  }
  return [
    fromTemplate('demo-living', 'balanced-grid', 'Living Room Gallery Wall', '2026-11-02T18:30:00.000Z'),
    fromTemplate('demo-hallway', 'panorama-row', 'Hallway Memories', '2026-10-28T09:12:00.000Z', (s) => ({
      ...s,
      wall: { ...s.wall, widthIn: 168, heightIn: 102, paintId: 'cloud-grey' },
    })),
    fromTemplate('demo-bedroom', 'creative-salon', 'Bedroom Salon', '2026-10-19T20:45:00.000Z', (s) => ({
      ...s,
      wall: { ...s.wall, paintId: 'peach-blush' },
    })),
  ]
}

function parseSavedDesign(value: unknown): SavedDesign | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as { [K in keyof SavedDesign]?: unknown }
  if (typeof v.id !== 'string' || !v.id || typeof v.savedAt !== 'string') return null
  if (Number.isNaN(Date.parse(v.savedAt))) return null
  const state = sanitizePlannerState(v.state)
  if (!state) return null
  const title = typeof v.title === 'string' ? v.title.trim().slice(0, 80) : ''
  return {
    id: v.id.slice(0, 64),
    title: title || state.title,
    savedAt: v.savedAt,
    state,
    droppedUploads: v.droppedUploads === true,
  }
}

function parseAll(raw: string | null): SavedDesign[] {
  const parsed: unknown = raw ? JSON.parse(raw) : null
  if (!Array.isArray(parsed)) return seed()
  const seen = new Set<string>()
  return parsed
    .map(parseSavedDesign)
    .filter((d): d is SavedDesign => d !== null && !seen.has(d.id) && !!seen.add(d.id))
    .slice(0, MAX_DESIGNS)
}

function read(): SavedDesign[] {
  if (cache) return cache
  try {
    cache = parseAll(localStorage.getItem(STORAGE_KEY))
  } catch {
    cache = seed()
  }
  return cache
}

function write(next: SavedDesign[]) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked / quota exceeded
  }
  listeners.forEach((l) => l())
}

/** Ephemeral blob URLs without a backend photoId cannot be restored across sessions. */
function stripUploads(state: PlannerState): { state: PlannerState; dropped: boolean } {
  let dropped = false
  const frames = state.frames.map((f) => {
    if (f.photo?.kind !== 'upload') return f
    if (f.photo.photoId) return f // Persistent Cloudflare R2 / MongoDB photo
    dropped = true
    return { ...f, photo: null }
  })
  return { state: structuredClone({ ...state, frames }), dropped }
}

export const savedDesignsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return
      cache = null
      listener()
    }
    window.addEventListener('storage', onStorage)

    // Trigger background sync if user has an active session
    if (tokenStorage.hasSession() && !isSyncing) {
      void savedDesignsStore.syncRemote()
    }

    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  },

  getSnapshot(): readonly SavedDesign[] {
    return read()
  },

  /**
   * Saves locally first, then syncs to the account in the background. `onRemoteError` is called
   * with the server's message when the server rejects the sync (e.g. storage full, too many
   * saves); the local copy is kept either way.
   */
  save(state: PlannerState, title: string, onRemoteError?: (message: string) => void): SavedDesign {
    const { state: clean, dropped } = stripUploads(state)
    const name = title.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Untitled wall'
    const tempId = `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

    const design: SavedDesign = {
      id: tempId,
      title: name,
      savedAt: new Date().toISOString(),
      state: { ...clean, title: name },
      droppedUploads: dropped,
    }

    // Write optimistically to memory/localStorage
    write([design, ...read()].slice(0, MAX_DESIGNS))

    // Asynchronously synchronize with FastAPI + MongoDB if authenticated
    if (tokenStorage.hasSession()) {
      const { createReq, versionReq } = stateToBackendDesign(clean)
      createReq.title = name

      void (async () => {
        try {
          const created = await designApi.createDesign(createReq)
          await designApi.createDesignVersion(created.id, versionReq)

          // Replace tempId with actual MongoDB ObjectId
          const current = read()
          const index = current.findIndex((d) => d.id === tempId)
          if (index !== -1 && current[index]) {
            const updated: SavedDesign = {
              ...current[index],
              id: String(created.id),
              savedAt: created.created_at,
            }
            const next = [...current]
            next[index] = updated
            write(next)
          }
        } catch (err) {
          // Keep local design if remote sync fails; report server-side rejections
          if (isApiError(err) && !err.isNetworkError) onRemoteError?.(err.message)
        }
      })()
    }

    return design
  },

  remove(id: string) {
    write(read().filter((d) => d.id !== id))

    if (tokenStorage.hasSession() && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
      void designApi.deleteDesign(id).catch(() => {})
    }
  },

  async loadDesignDetail(design: SavedDesign): Promise<PlannerState> {
    if (
      tokenStorage.hasSession() &&
      design.id.length === 24 &&
      /^[0-9a-fA-F]{24}$/.test(design.id)
    ) {
      try {
        const detail = await designApi.getDesign(design.id)
        if (detail) {
          const fullState = backendDesignToState(detail)
          return fullState
        }
      } catch {
        // Fallback to local cached snapshot
      }
    }
    return design.state
  },

  async syncRemote(): Promise<void> {
    if (!tokenStorage.hasSession() || isSyncing) return
    isSyncing = true

    try {
      const res = await designApi.listDesigns({ pageSize: 50 })
      if (res?.items && Array.isArray(res.items)) {
        const remoteDesigns: SavedDesign[] = []

        for (const item of res.items) {
          // If we already have the full state cached for this ID, keep it
          const existing = read().find((d) => d.id === String(item.id))
          if (existing) {
            remoteDesigns.push(existing)
          } else {
            // Build placeholder design card until opened
            let state = createInitialState()
            state = {
              ...state,
              title: item.title,
              wall: {
                ...state.wall,
                widthIn: item.wall.width_inches,
                heightIn: item.wall.height_inches,
              },
            }
            remoteDesigns.push({
              id: String(item.id),
              title: item.title,
              savedAt: item.updated_at,
              state,
              droppedUploads: false,
            })
          }
        }

        if (remoteDesigns.length > 0) {
          write(remoteDesigns)
        }
      }
    } catch {
      // Offline or network error
    } finally {
      isSyncing = false
    }
  },
}
