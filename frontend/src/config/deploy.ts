/**
 * Build-time API base URL policy. Pure so it can be unit-tested.
 *
 * In development the default `/api/v1` is served by the Vite proxy. On Cloudflare Pages there is no
 * such proxy: a relative path would call the Pages host, not the Render API. So a Pages build must
 * be given the absolute https:// API URL, and fails loudly here instead of shipping a broken app.
 */
export const DEFAULT_API_BASE_URL = '/api/v1'

export function resolveBuildApiBaseUrl(raw: string | undefined, cloudflarePagesBuild: boolean): string {
  const value = (raw ?? DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_API_BASE_URL
  if (cloudflarePagesBuild && !/^https:\/\//i.test(value)) {
    throw new Error(
      'VITE_API_BASE_URL must be the absolute https:// URL of the API (for example ' +
        'https://<your-render-service>.onrender.com/api/v1) when building on Cloudflare Pages.',
    )
  }
  return value
}
