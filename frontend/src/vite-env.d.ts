/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base incl. version prefix. Relative (`/api/v1`, uses dev proxy) or absolute (`https://api.example.com/api/v1`). */
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/* ---------- Google Identity Services (GIS) typings ---------- */

interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
  clientId?: string
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  prompt_parent_id?: string
}

interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number | string
  locale?: string
}

interface GooglePromptNotification {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
  getDismissedReason: () => string
}

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: GoogleIdConfiguration) => void
        renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void
        prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void
        cancel: () => void
      }
    }
  }
}

/* ---------- vite-imagetools query imports (see src/assets/index.ts) ---------- */

/** `?…&as=srcset` → a ready-to-use srcset string ("a.webp 480w, b.webp 960w"). */
declare module '*as=srcset' {
  const srcset: string
  export default srcset
}

/** `?w=…&format=webp` (single output) → URL of the generated file. */
declare module '*format=webp' {
  const src: string
  export default src
}
