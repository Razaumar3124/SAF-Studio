export const APP_NAME = 'Sagar Arts & Frames'

/** Document title for a page: "Sign in · Sagar Arts & Frames". Every page sets one. */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${APP_NAME}` : APP_NAME
}
