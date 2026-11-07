import type { EntityId } from '@/types/api'

/**
 * Every backend path from docs/API_CONTRACT.md, relative to the API base (`/api/v1`).
 * Never write an endpoint string anywhere else.
 */
const id = (value: EntityId) => encodeURIComponent(String(value))

export const endpoints = {
  auth: {
    register: '/auth/register', // POST  · public
    login: '/auth/login', // POST  · public
    me: '/auth/me', // GET   · bearer
    forgotPassword: '/auth/forgot-password', // POST · public
    verifyOtp: '/auth/forgot-password/verify', // POST · public
    resetPassword: '/auth/forgot-password/reset', // POST · public
  },
  catalog: {
    frameMaterials: '/frame-materials', // GET · public · ?category&available_only
    frames: '/frames', // GET · public · ?material_id&color&min_width&max_width
  },
  photos: {
    list: '/photos', // GET  · bearer
    upload: '/photos/upload', // POST · bearer · multipart `file`
    thumbnail: (photoId: EntityId) => `/photos/${id(photoId)}/thumbnail`,
    preview: (photoId: EntityId) => `/photos/${id(photoId)}/preview`,
  },
  templates: {
    list: '/templates', // GET · public · ?category&min_frames&max_frames
  },
  geometry: {
    validateLayout: '/geometry/validate-layout', // POST · optional auth
    generateLayout: '/geometry/generate-layout', // POST · optional auth
  },
  pricing: {
    calculate: '/pricing/calculate', // POST · optional auth
  },
  designs: {
    create: '/designs', // POST · bearer
    detail: (designId: EntityId) => `/designs/${id(designId)}`, // GET · bearer
    versions: (designId: EntityId) => `/designs/${id(designId)}/versions`, // POST · bearer
  },
  quotes: {
    list: '/quotes', // GET  · bearer
    create: '/quotes', // POST · bearer
    prepare: '/quotes/prepare', // POST · bearer · multipart `file` + `design_data`
    detail: (quoteId: EntityId) => `/quotes/${id(quoteId)}`, // GET · bearer
    share: (token: string) => `/quotes/share/${encodeURIComponent(token)}`, // GET · public
  },
} as const
