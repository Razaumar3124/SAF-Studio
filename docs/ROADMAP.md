# Frontend Roadmap: SAF Studio

The phases follow Moonlight's order so the two codebases can be compared phase by phase. Item-level
status lives in [PORTING_PARITY.md](PORTING_PARITY.md).

## Phase 0: Setup & documentation ✅ (2026-11-06)

- [x] Analysed `reference-designs/` (login, register, memory wall). Colours sampled pixel by pixel
- [x] Analysed the Moonlight frontend: architecture, logic layers, every page and behaviour
- [x] `frontend/` scaffolded with Moonlight's exact toolchain (lockfile carried over, versions verified)
- [x] SAF design tokens (`styles/theme.css`), Plus Jakarta Sans self-hosted, base styles, variants
- [x] UI-independent layers copied verbatim: `config`, `lib`, `services`, `types/api`, `hooks`, `test`
      (+ their 36 tests)
- [x] App shell: identical router / error boundary / 404. SAF `PageLoader`, `PlaceholderPage`,
      `Button`, `TextLink`. Placeholder pages on every route
- [x] `src/assets/` folder tree created (assets to be added manually)
- [x] Docs: DESIGN_SYSTEM, ARCHITECTURE (mapped to Moonlight), PORTING_PARITY, ASSETS, RESPONSIVE,
      ROADMAP. API_CONTRACT / API_ALIGNMENT / SECURITY inherited
- [x] `npm run check` green; production build OK

## Phase 1: Assets & shared UI ✅ (2026-11-06)

- [x] Assets verified against ASSETS.md: 11 of 15 delivered. Google "G" added, logo mark + favicon
      derived, one file renamed. Missing: sofa cut-out (🔴 Phase 4), touch icon/OG (⚪)
- [x] `brand.ts`, `auth.ts`, `memoryWall.ts` manifests with Moonlight's export shapes (+ SAF `backdrop`)
- [x] All `components/ui`, `components/feedback`, `components/brand/Logo` ported (PORTING_PARITY §D)
- [x] SAF-only `BrandBar`, `CaptionStack`
- [x] `ToastProvider` back in `App.tsx`. `Toaster.test.tsx` passes unchanged
- [x] Decisions R1–R5 recorded (PORTING_PARITY)
- [x] Fix: Vite inlined a < 4 KB font subset as `data:`, which the prod CSP blocked → `assetsInlineLimit`

## Phase 2: Login ✅ (2026-11-06)

- [x] `features/auth/lib` + `hooks` (+ tests) copied verbatim; `LoginForm`, `GoogleButton`,
      `GoogleSignIn`, `AuthSwitchPrompt`, `RegisterForm` (+ test) byte-identical
- [x] Auth shell re-skinned: `AuthLayout` (backdrop mode + image-free mode), `AuthHero` (full-page
      sticky backdrop), `AuthDecorations`, `AuthHeader` (+ eyebrow), `AuthForm`; SAF-only `AuthTagline`,
      `lib/backdropLayout.ts` (+ test)
- [x] `LoginPage`, `ForgotPasswordPage` with SAF copy
- [x] Behaviour checklist §H "Login": 10/10 verified in Chromium on the production build
- [x] Responsive pass at 16 viewports (320 → 2560, incl. ultra-wide and landscape phone): no overflow,
      no console errors, laptops fit without scrolling
- [x] `npm run check` green: 156 tests, lint 0, typecheck 0, format; build OK

## Audit after Phase 2 ✅ (2026-11-06)

- [x] Shared-logic fixes (must be mirrored in Moonlight, see the sync log): malformed API error bodies
      crashed forms or threw in the error path; cross-tab sign-out was ignored by the cached session
- [x] SAF fixes: NaN-safe backdrop geometry; CTA gradient / Alert error / Switch off-state contrast
      (new `danger-700` token); hard-coded colour in the tagline motif
- [x] New guards: `contrast.test.ts` (WCAG ratios computed from `theme.css`), `build.test.ts`
      (no `data:` fonts), `AuthLayout.test.tsx` (form survives breakpoint changes), malformed-body and
      cross-tab tests: 156 → 208 tests
- [x] Clean: XSS / dynamic code / secrets / links / `any` / suppressions / console sweeps, `npm audit` 0,
      prod artefact (CSP, no source maps, no env leakage), 95-page responsive re-check
- [x] Server-side validation requirements listed in PORTING_PARITY.md for backend integration

## Phase 3: Register ✅ (2026-11-06)

- [x] `RegisterPage` on the shared shell (`authAssets.register.backdrop`, card right, `compact`), SAF copy
- [x] `RegisterForm` (Full Name, R1), `useRegisterForm`, `registerValidation` byte-identical. Moonlight's
      `RegisterForm.test.tsx` and `registerValidation.test.ts` pass unchanged
- [x] Register backdrop measured (`artEdge`, window decor edge, y = 60%, `maxAspect` 1.8). Fixed: the
      default 1.9:1 cap clipped the baked steps at 1920×1080
- [x] Shared shell extended, not forked: `useBackdropFits` (image-free fallback when the card can't clear
      the art: Register at 4:3), `on-backdrop:` / `compact-short:` variants, `AuthTagline` steps,
      card-relative compact title
- [x] Behaviour checklist §H "Register": all verified (Chromium, prod build); login re-verified (22/22)
- [x] Responsive: 17 register viewports + 95-page audit (all auth routes); fits ≥ 1440×900
- [x] `npm run check` green: 249 tests (208 → 249), lint 0, typecheck 0, format; build OK

## Phase 4: Memory Wall Planner ✅ (2026-11-06)

- [x] `lib/geometry/*`, `plannerState`, `templates`, `constants`, `hooks/*` copied **byte-identical**; Moonlight's
      `geometry.test.ts` (1,536-layout sweep) and `plannerState.test.ts` pass unchanged. Brand-only edits in
      `exportImage` / `savedDesigns` (G7/G9). `ROOM_PHOTO` kept (it is the sofa model the geometry uses)
- [x] Every planner component and dialog re-skinned; page state/handlers + dialog wiring diff-identical to Moonlight.
      SAF-only: hero + `StepStrip`, layout tiles (`SegmentedControl variant="tiles"` + `LayoutStyleIcon`), inspiration
      cards, `FrameGapsPanel` split
- [x] Final decisions P1–P5 recorded (Number of Frames kept, one-shot Apply to all, no colour wheel / mat unit /
      price, Moonlight colour lists, Moonlight behaviour otherwise); future features FF1–FF4 logged
- [x] Sofa: to-scale vector fallback (A9 not delivered)
- [x] Fix (sync log, REQUIRED in Moonlight): `SwatchPicker` colour groups had no accessible name
- [x] `MemoryWallPage.test.tsx`: 17 integration tests (recalculation, 0 / negative / garbage / extreme input,
      bounds, extreme aspect, rapid changes, P1–P4, sofa line). Browser: 33/33 planner checks, 115-page audit
- [x] `npm run check` green: 308 tests (253 → 308), lint 0, typecheck 0, format; build OK
- [x] Remaining §H planner checks: all verified in the audit below

## Audit after Phase 4 ✅ (2026-11-06)

- [x] Fixed: blank side margins on wide windows (planner was capped at 100rem → fluid; BrandBar full-bleed)
- [x] Fixed: blank strips beside the aspect-locked wall → `CanvasStage` room stage (no extra download)
- [x] Fixed: "Warm Cream" overlapped the paint swatches (SwatchPicker aside back in the legend's flow;
      Wall Configuration container-driven in 3 steps). Sync-log instruction for Moonlight corrected
- [x] Fixed: forked Request-a-Quote button → shared `Button`
- [x] Docs reconciled with the code; server-side validation list += design titles
- [x] Verified: security sweeps + `npm audit` 0; dispatch/handler/ARIA parity with Moonlight; listener cleanup;
      rotation; new collision detector (110 loads, 0); all 51 §H checks (incl. error boundary, delayed loader)
- [x] `npm run check` green: 312 tests (308 → 312), lint 0, typecheck 0, format; build OK

## Phase 5: Live API wiring

Same as Moonlight's Phase 5, ideally developed once and mirrored: `services/<domain>.ts`, auth
provider + protected routes, React Query, and live endpoints as API_ALIGNMENT items resolve. Revisit
D7 (price) and D9 (initials).
