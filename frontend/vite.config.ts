/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { imagetools } from 'vite-imagetools'
import { assetsInlineLimit } from './src/config/build.ts'
import { buildContentSecurityPolicy } from './src/config/csp.ts'
import { resolveBuildApiBaseUrl } from './src/config/deploy.ts'

/**
 * Production Content-Security-Policy, injected as a <meta> tag at build time only (the dev server
 * needs inline scripts for HMR). The policy itself lives in src/config/csp.ts (unit-tested).
 */
function contentSecurityPolicy(apiBaseUrl: string): Plugin {
  const csp = buildContentSecurityPolicy(apiBaseUrl)

  return {
    name: 'saf:csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files for the config itself. Empty prefix = also read non-VITE_ vars, which stay
  // server-side (only VITE_* vars that client code references reach the bundle).
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:8000'
  // Fails the build on Cloudflare Pages if the API URL is relative (see src/config/deploy.ts).
  const apiBaseUrl = resolveBuildApiBaseUrl(env.VITE_API_BASE_URL, env.CF_PAGES === '1')

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Resizes / re-encodes images at build time from query params
      // (e.g. `hero.webp?w=480;960&format=webp&as=srcset`). Source files are never modified.
      // Image imports live only in the src/assets/*.ts manifests (docs/ASSETS.md).
      imagetools(),
      contentSecurityPolicy(apiBaseUrl),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Stable vendor chunks: library code rarely changes, so browsers keep it cached across
          // deploys while app chunks (which change often) are re-downloaded on their own.
          advancedChunks: {
            groups: [
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor-router', test: /node_modules[\\/](react-router|react-router-dom)[\\/]/ },
              { name: 'vendor-ui', test: /node_modules[\\/](clsx|tailwind-merge|lucide-react)[\\/]/ },
            ],
          },
        },
      },
      // Never inline fonts as data: URIs: the production CSP (`font-src 'self'`) blocks them.
      assetsInlineLimit,
    },
    server: {
      port: 5173,
      // Forward backend paths to FastAPI so the browser never hits CORS locally.
      // /static serves catalogue/template thumbnails referenced by relative URLs in API responses.
      // /q serves short-link redirects for shared WhatsApp quote reports.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/static': { target: apiTarget, changeOrigin: true },
        '/q': { target: apiTarget, changeOrigin: true },
      },
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
      restoreMocks: true,
      unstubGlobals: true,
    },
  }
})
