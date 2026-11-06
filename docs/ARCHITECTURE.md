# Frontend Architecture: SAF Studio, mapped to Moonlight

SAF Studio is a **second client of the same product** as Moonlight Studio. Logic, state, data flow,
inputs, routes and API usage are identical. Only the presentation layer differs.

- **Reference implementation:** `Moonlight Studio Project/frontend` (called _Moonlight_ below)
- **Moonlight's own architecture doc:** `Moonlight Studio Project/docs/ARCHITECTURE.md`. Its
  conventions (component rules, forms via `useForm`, planner pipeline, performance rules) apply
  here unchanged. This file records only the SAF-specific mapping and porting workflow.

## Stack (identical to Moonlight)

| Concern     | Choice                                              | Version (locked)        |
| ----------- | --------------------------------------------------- | ----------------------- |
| Build       | Vite                                                | 8.3.6                   |
| UI          | React + TypeScript (strict, `noUncheckedIndexedAccess`) | 19.3.1 / 7.0.2       |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite` (`@theme` tokens) | 4.3.4             |
| Routing     | React Router (lazy routes)                          | 7.18.5                  |
| Class utils | `clsx` + `tailwind-merge` → `cn()`                  | 2.1.1 / 3.7.0           |
| Icons       | `lucide-react`                                      | 1.69.0                  |
| Images      | `vite-imagetools` (build-time WebP + `srcset`)      | 12.0.1                  |
| Lint/format | oxlint (+ react, jsx-a11y, import, vitest) + Prettier (Tailwind sort) | 1.91.0 / 3.9.10 |
| Tests       | Vitest + React Testing Library + jsdom              | 5.1.0 / 16.3.3 / 29.1.1 |
| Fonts       | `@fontsource-variable/plus-jakarta-sans` (self-hosted) | 5.3.0                |

The only dependency change is the font packages: Moonlight's DM Sans + Playfair Display were
replaced by Plus Jakarta Sans. `package-lock.json` was carried over, so every other package
resolves to the exact version Moonlight uses (verified with `npm ls`). The config files are copies
of Moonlight's: `tsconfig*.json`, `vite.config.ts` (CSP plugin renamed `saf:csp`), `.oxlintrc.json`,
`.prettierrc.json`, `.prettierignore`, `.gitignore`, `.env.example`, `.vscode/extensions.json`.

## Repository layout

```
SAF Studio Project/
├── frontend/            React + TS + Tailwind app
├── backend/             FastAPI service (teammate; same backend contract as Moonlight)
├── docs/                This documentation
└── reference-designs/   SAF mockups: login.png, register.png, memory-wall-design.png
```

## Folder-by-folder mapping

Legend: **≡ Copy**: copied verbatim, must stay byte-identical to Moonlight except for brand strings
· **◐ Re-skin**: same file, props, handlers and behaviour, with new classes/markup from the SAF
designs · **✚ SAF-only**: new presentational piece with no Moonlight counterpart (behaviour still
comes from Moonlight code).

```
frontend/src/
├── app/
│   ├── App.tsx                ≡  ToastProvider + RouterProvider
│   ├── router.tsx             ≡  identical routes + lazy loading + error boundary
│   ├── RouteErrorPage.tsx     ≡  chunk-error detection, reload, dev-only logging
│   ├── NotFoundPage.tsx       ≡
│   └── providers/             (empty, as in Moonlight) AuthProvider etc. in Phase 5
├── assets/                    Manifests + files. See ASSETS.md
│   ├── types.ts               ≡  + SAF-only AuthBackdropAsset
│   ├── brand.ts auth.ts memoryWall.ts   ◐ same exports/shape, SAF files and alt text
│   │                             (auth exposes `<screen>.backdrop`: SAF's art is full-page)
│   ├── icons/  images/{login,register,memory-wall/{frames,layouts}}   (delivered manually)
├── components/
│   ├── ui/                    ◐  same names + props as Moonlight, SAF visuals
│   ├── brand/                 ◐  Logo (SAF lockup). EstablishedTag has no SAF equivalent → not ported
│   │                          ✚  BrandBar, CaptionStack (see DESIGN_SYSTEM.md)
│   ├── feedback/              ◐  Alert, Toaster (+ toastContext ≡), Spinner ≡
│   └── layout/                ◐  PageLoader, PlaceholderPage
├── config/                    ≡  app.ts (APP_NAME changed), env.ts, media.ts, routes.ts
├── features/
│   ├── auth/
│   │   ├── lib/               ≡  validation, identifier, limits, authErrors, mockAuth (+ tests)
│   │   │                      ✚  backdropLayout (+ test): card placement beside baked-in art
│   │   ├── hooks/             ≡  useLoginForm, useRegisterForm
│   │   │                      ✚  useBackdropFits (backdrop vs image-free layout)
│   │   ├── components/        ≡  LoginForm, RegisterForm (+ test), GoogleButton, GoogleSignIn, AuthSwitchPrompt
│   │   │                      ◐  AuthLayout, AuthHero (full-page backdrop), AuthHeader (+ eyebrow), AuthForm
│   │   │                      ◐  AuthDecorations → SAF arcs/captions instead of waves/leaves
│   │   │                      ✚  AuthTagline (live tagline on image-free layouts)
│   │   └── pages/             ◐  LoginPage, ForgotPasswordPage. RegisterPage = placeholder (Phase 3)
│   ├── memory-wall/
│   │   ├── lib/               ≡  geometry/*, plannerState, savedDesigns, templates, exportImage (+ tests)
│   │   ├── hooks/             ≡  usePlanner, usePhotoUpload, useSavedDesigns
│   │   ├── constants.ts       ≡  verbatim, incl. Moonlight's swatch lists (PORTING_PARITY R2)
│   │   ├── components/        ◐  PlannerHeader, ConfigPanels, FramePanels, CanvasPanel, WallCanvas,
│   │   │                         WallSvg, DimensionInput, StepCard, ActionBar, dialogs/*
│   │   │                      ✚  CanvasStage (room stage), LayoutStyleIcon; StepStrip (in PlannerHeader);
│   │   │                         layout tiles = SegmentedControl variant="tiles"; FrameGapsPanel
│   │   └── pages/             ◐  MemoryWallPage: same handlers/state wiring, SAF grid layout
│   └── quotes/                (empty, as in Moonlight)
├── hooks/                     ≡  useForm, useMediaQuery (+ tests)
├── lib/                       ≡  cn, units, money (+ tests)
├── services/                  ≡  apiClient, endpoints, tokenStorage (storage key `saf.auth`) (+ tests)
├── styles/theme.css           ✚  SAF tokens (DESIGN_SYSTEM.md). Same token NAMES where roles match
├── types/api/                 ≡  mirror of API_CONTRACT.md
├── test/fakeStorage.ts        ≡
├── index.css                  ◐  same variants/base layer, SAF surface tokens
├── main.tsx                   ◐  font import only
└── vite-env.d.ts              ≡
```

### Why the line falls where it does

Moonlight's architecture already separates logic from presentation cleanly. `lib/`, `services/`,
`types/`, `hooks/`, `config/` and every `features/*/lib` and `features/*/hooks` contain no
styling and import nothing from `components/` or `features/*/components` (verified by grep). These layers
are therefore **copied, not rewritten**. Their unit tests come with them and act as the parity
proof. Everything under `components/` and `features/*/components|pages` is presentation and gets
re-skinned.

### Dependency rules (unchanged)

```
app ──► features ──► components, hooks, lib, services, config, assets, types
                     services ──► config, types
                     components ──► lib, assets, types   (never features, never services)
```

Features don't import each other. Only `services/` calls `fetch`. Only the `assets/*.ts` manifests
import image files. API types stay snake_case. Use the `@/` alias. The `import/no-cycle` lint rule enforces
part of this.

## Porting workflow (per file)

1. **Copy the Moonlight file to the same path.** Keep the filename, exports, props interface,
   hooks, handlers, ARIA attributes, `data-*` hooks and test ids.
2. **≡ files:** stop here. Only brand strings may change (`APP_NAME`, storage keys, copy).
3. **◐ files:** rewrite the JSX structure and `className`s from the SAF mockup using the token map
   in DESIGN_SYSTEM.md. Don't change state, effects, event handlers, validation or the props contract.
   If the SAF layout needs a new prop (e.g. `AuthLayout heroSide`), make it additive and optional.
4. **Copy the matching Moonlight tests** (`*.test.ts(x)`). Component tests query by label and role,
   so they must pass **unchanged** against the SAF markup. A failing Moonlight test signals a
   parity break.
5. Run `npm run check` and the per-screen responsive checklist (RESPONSIVE.md).
6. Tick the item in [PORTING_PARITY.md](PORTING_PARITY.md).

**Diff-ability:** because paths and names match, `diff -r` between the two `src/` trees shows
exactly the presentation delta. ≡ files should show no diff. Mark SAF-only files with a header
comment `/** SAF-only: … */`.

**Shared-logic fixes:** a bug fix in a ≡ file must land in both repos. Note it in
PORTING_PARITY.md's sync log.

## Unchanged from Moonlight (see its ARCHITECTURE.md for detail)

- **Pages** are `lazy()`-loaded in `app/router.tsx`. Every route sits under one error boundary.
- **Forms** use `hooks/useForm` (fields, initial values, `validateField`, `onSubmit(values, signal)`,
  `mapSubmitError`). Auth input limits come from `features/auth/lib/limits.ts`.
- **Planner pipeline:** `PlannerState → plannerReducer → buildScene (layouts → placement →
  validation) → Scene → WallSvg` (one renderer for canvas, fullscreen, thumbnails and PNG export).
  Inches internally. `(seed, variant)` is deterministic.
- **Backend integration:** `/api/v1` base (`VITE_API_BASE_URL`), Vite proxy for `/api` and `/static`, JWT
  Bearer through `apiClient`, `ApiError` envelope, `resolveApiUrl()`, money via `formatMoney()`.
  Live wiring is Phase 5 in both projects. Contract: [API_CONTRACT.md](API_CONTRACT.md); open items:
  [API_ALIGNMENT.md](API_ALIGNMENT.md).
- **Quality gate:** `npm run check` (typecheck + lint + tests + format check) before every commit.
  Every page sets `<title>{pageTitle('…')}</title>`.
- **Security:** production CSP meta, no third-party runtime requests, sanitised stored designs
  ([SECURITY.md](SECURITY.md)).
