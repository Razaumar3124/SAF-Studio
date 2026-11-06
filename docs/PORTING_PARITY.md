# Porting Parity Checklist: Moonlight → SAF Studio

Every Moonlight frontend file, page and behaviour that SAF Studio must reproduce, with its status.
Paths are relative to `frontend/src/` in each project. Workflow and legend for _Type_ are in
[ARCHITECTURE.md](ARCHITECTURE.md#porting-workflow-per-file).

**Type:** ≡ copy verbatim · ◐ re-skin (same logic, SAF visuals) · ✚ SAF-only presentation
**Status:** ✅ done · 🟡 partial · ⬜ not started · ⛔ blocked (asset or decision) · ➖ not applicable

Update the status in the same PR that ports the item. A ◐ item is ✅ only when the copied Moonlight
tests pass unchanged and the behaviour column has been checked in the browser.

## Progress summary

| Area                         | Items | ✅ | 🟡 | ⬜ | ⛔ | ➖ |
| ---------------------------- | ----- | -- | -- | -- | -- | -- |
| A. Tooling & config          | 10    | 10 |    |    |    |    |
| B. Shared non-UI layers      | 17    | 17 |    |    |    |    |
| C. App shell                 | 7     | 7  |    |    |    |    |
| D. Shared UI components      | 22    | 21 |    |    |    | 1  |
| E. Asset manifests           | 4     | 4  |    |    |    |    |
| F. Auth feature              | 28    | 28 |    |    |    |    |
| G. Memory Wall Planner       | 36    | 35 |    |    |    | 1  |
| H. Behaviour parity (manual) | 51    | 51 |    |    |    |    |

_Last updated: 2026-11-06 (audit after Phase 4)._

---

## Resolved decisions (2026-11-06, product owner)

These override the "Recommendation" column of the deltas table below and apply from now on.

| #  | Decision | Applied to |
| -- | -------- | ---------- |
| R1 | **Register keeps Full Name**, implemented exactly as Moonlight's code (backend requires `full_name`). The mockup is overruled. | D1. `RegisterForm.tsx` copied verbatim; Moonlight's `RegisterForm.test.tsx` passes unchanged |
| R2 | **Colour lists = Moonlight's exact lists** (wood finishes, paint shades, mount colours). They are plain data in `constants.ts`, swapped in without touching logic. | D14, D15 → no wood texture assets needed; `SwatchPicker textured` keeps Moonlight's radial shading |
| R3 | **Mobile & tablet views are ours to design** in SAF's language: polished, fully responsive, reusable components, documented in RESPONSIVE.md. | D18 |
| R4 | **Frontend only.** No backend integration yet; `services/`, `types/api/` and mock auth stay untouched so Phase 5 is a drop-in. | All phases |
| R5 | **Catch-all:** any other mockup-vs-Moonlight conflict defaults to **Moonlight's behaviour**. | D2–D9, D12, D13, D22, D23 |

### Planner decisions: FINAL (2026-11-06, product owner, Phase 4)

| #  | Decision | Applied |
| -- | -------- | ------- |
| P1 | **Number of Frames stays**, exactly as in Moonlight, although the mockup has no such control | `LayoutPanel` stepper (1–16, `frames/setCount`); integration test drives it to both bounds |
| P2 | **"Apply to all frames" is Moonlight's one-time action**, not the mockup's checkbox | Button dispatching `frames/applyToAll`; test asserts no checkbox / no `aria-pressed`, and later edits affect one frame |
| P3 | **Not added:** paint colour-wheel, mat-margin unit dropdown, price display in the action bar (none exist in Moonlight) | Logged below as future features; tests assert they're absent |
| P4 | **Colour lists = Moonlight's exact lists** (7 paint shades, 8 wood finishes, 4 mount colours) | `constants.ts` byte-identical; test counts the swatches |
| P5 | **Any other mockup-vs-Moonlight conflict → Moonlight's behaviour** | D8 (Download inside Preview Fullscreen), D9 (profile icon, not initials), D13 (Moonlight eye-level label), D12/D22 (fit badge, live summary kept) |

### Future features (from the SAF mockup, NOT in Moonlight: not built)

| ID | Feature (mockup) | Why it needs more than UI | Needs |
| -- | ---------------- | ------------------------- | ----- |
| FF1 | Paint **colour wheel** (custom wall colour) | Reducer accepts only known `PAINT_SHADES` ids; `sanitizePlannerState` maps unknown ids to defaults; the designs API stores `color_hex` | Reducer + sanitiser support for custom hex (both clients) |
| FF2 | **Mat margin unit dropdown** ("inches") | Mat is inches-only in state (`marginIn`); no unit field | New state field + conversion (like `gapUnit`) |
| FF3 | **Estimated price** ("₹ 18,500") in the action bar | Prices come from `/pricing` (Phase 5); the client never computes money (`formatMoney` only) | Live pricing API wiring |
| FF4 | **Download Design** directly in the action bar | Moonlight moved it into Preview Fullscreen (in-dialog status, audit fix) | Product decision only (logic exists: `downloadWallPng`) |

---

## A. Tooling & config

| #  | Item                                        | Type | Status | Notes                                                       |
| -- | ------------------------------------------- | ---- | ------ | ----------------------------------------------------------- |
| A1 | `package.json` scripts + deps               | ◐    | ✅     | Name `saf-studio-frontend`. Fonts swapped to Plus Jakarta Sans |
| A2 | `package-lock.json` (exact versions)        | ≡    | ✅     | `npm ls` matches Moonlight package-for-package              |
| A3 | `tsconfig.json` / `.app` / `.node`          | ≡    | ✅     |                                                             |
| A4 | `vite.config.ts` (alias, proxy, CSP, chunks, imagetools, vitest) | ≡ | ✅ | CSP plugin renamed `saf:csp`. **+ `assetsInlineLimit` never inlines fonts** (CSP bug, see sync log) |
| A5 | `.oxlintrc.json`                            | ≡    | ✅     |                                                             |
| A6 | `.prettierrc.json`, `.prettierignore`       | ≡    | ✅     |                                                             |
| A7 | `.gitignore`, `.env.example`, `.vscode/extensions.json` | ≡ | ✅ |                                                          |
| A8 | `index.html` (meta, CSP-safe, noscript)     | ◐    | ✅     | SAF title, description, `theme-color #0f7c82`               |
| A9 | `public/favicon.svg`                        | ◐    | ✅     | Now **derived from the real logo** (monogram on a white tile). Renders cleanly at 16px |
| A10| `npm run check` gate green                  | —    | ✅     | 312 tests (audit after Phase 4), lint 0, typecheck 0, format. Prod build OK |

## B. Shared non-UI layers (copied verbatim)

| #   | Moonlight file                              | Type | Status | Notes                                  |
| --- | ------------------------------------------- | ---- | ------ | -------------------------------------- |
| B1  | `config/app.ts`                             | ≡    | ✅     | `APP_NAME = 'Sagar Arts & Frames'`     |
| B2  | `config/env.ts`                             | ≡    | ✅     |                                        |
| B3  | `config/media.ts`                           | ≡    | ✅     | Keep in sync with `hero-fits` in index.css |
| B4  | `config/routes.ts`                          | ≡    | ✅     | Same paths                             |
| B5  | `lib/cn.ts`                                 | ≡    | ✅     |                                        |
| B6  | `lib/units.ts` (+ test)                     | ≡    | ✅     |                                        |
| B7  | `lib/money.ts` (+ test)                     | ≡    | ✅     |                                        |
| B8  | `hooks/useForm.ts` (+ test)                 | ≡    | ✅     |                                        |
| B9  | `hooks/useMediaQuery.ts`                    | ≡    | ✅     |                                        |
| B10 | `services/apiClient.ts` (+ test)            | ≡    | ✅     | Untouched (R4)                         |
| B11 | `services/endpoints.ts`                     | ≡    | ✅     | Untouched (R4)                         |
| B12 | `services/tokenStorage.ts` (+ test)         | ≡    | ✅     | Storage key `saf.auth` (was `moonlight.auth`) |
| B13 | `types/api/*` (10 files)                    | ≡    | ✅     | Untouched (R4)                         |
| B14 | `test/fakeStorage.ts`                       | ≡    | ✅     |                                        |
| B15 | `vite-env.d.ts`                             | ≡    | ✅     |                                        |
| B16 | `assets/types.ts`                           | ≡    | ✅     | + SAF-only `AuthBackdropAsset` (additive; Moonlight types unchanged) |
| B17 | Folder skeleton (+ `.gitkeep`s)             | ≡    | ✅     | Same tree as Moonlight                 |

## C. App shell

| #  | Moonlight file                    | Type | Status | Notes                                                               |
| -- | --------------------------------- | ---- | ------ | ------------------------------------------------------------------- |
| C1 | `app/router.tsx`                  | ≡    | ✅     | Byte-identical                                                      |
| C2 | `app/RouteErrorPage.tsx`          | ≡    | ✅     |                                                                     |
| C3 | `app/NotFoundPage.tsx`            | ≡    | ✅     |                                                                     |
| C4 | `components/layout/PageLoader.tsx`| ◐    | ✅     |                                                                     |
| C5 | `components/layout/PlaceholderPage.tsx` | ◐ | ✅   | BrandBar + gold rule + display title (replaces `EstablishedTag`)    |
| C6 | `app/App.tsx`                     | ◐    | ✅     | `<ToastProvider>` restored, as in Moonlight                         |
| C7 | `index.css`, `main.tsx`, `styles/theme.css` | ◐ | ✅ | `hero-fits` re-verified on the SAF backdrops; `--bar-h`, backdrop fade masks and fluid `--auth-*` tokens added; `short` replaced by the tokens |

## D. Shared UI components

All keep Moonlight's props, state, handlers and ARIA. Only classes/markup changed.

| #   | Moonlight file                         | Type | Status | Notes                                                       |
| --- | -------------------------------------- | ---- | ------ | ----------------------------------------------------------- |
| D1  | `components/ui/Button.tsx`             | ◐    | ✅     | + optional `rightIcon` (SAF "Sign In →")                    |
| D2  | `components/ui/TextLink.tsx`           | ◐    | ✅ **FINAL (P1)**:     |                                                             |
| D3  | `components/feedback/Spinner.tsx`      | ≡    | ✅ **FINAL (P2)**:     |                                                             |
| D4  | `components/ui/TextField.tsx`          | ◐    | ✅ **FINAL (P3, FF2)**:     | White field, `ink-400` boundary (3.2:1), 48 → 52px, forced-colors outline kept |
| D5  | `components/ui/PasswordField.tsx`      | ◐    | ✅     | Lock-keyhole icon. Toggle icon follows the mockup (open eye while hidden); `aria-pressed` semantics unchanged |
| D6  | `components/ui/PhoneField.tsx`         | ◐    | ✅ **FINAL (P3, FF1)**:     | Phone icon + fixed `+91`, no chevron (D23 → Moonlight)      |
| D7  | `components/ui/Divider.tsx`            | ◐    | ✅ **FINAL (P3, FF3)**:     | Hairline + teal "OR"                                        |
| D8  | `components/ui/IconButton.tsx`         | ◐    | ✅     | Square SAF corners                                          |
| D9  | `components/ui/SegmentedControl.tsx`   | ◐    | ✅     | Joined white track, solid teal active pill; radio semantics unchanged |
| D10 | `components/ui/Switch.tsx`             | ◐    | ✅     |                                                             |
| D11 | `components/ui/NumberStepper.tsx`      | ◐    | ✅     | `aria-disabled` focus retention at bounds kept              |
| D12 | `components/ui/Select.tsx`             | ◐    | ✅     |                                                             |
| D13 | `components/ui/SwatchPicker.tsx`       | ◐    | ✅     | `textured` radial shading kept (R2: no texture assets)      |
| D14 | `components/ui/Badge.tsx`              | ◐    | ✅ **FINAL (P4)**:     | Tones remapped. The "● Frame #1 Selected" dot is composed in the planner (Phase 4) |
| D15 | `components/ui/Dialog.tsx`             | ◐    | ✅ **FINAL (P4)**:     | Backdrop drag-release guard, scroll lock, `data-autofocus` kept |
| D16 | `components/feedback/Alert.tsx`        | ◐    | ✅     | Error tone uses `danger-*` (Moonlight used its brand crimson) |
| D17 | `components/feedback/toastContext.ts`  | ≡    | ✅     | Byte-identical                                              |
| D18 | `components/feedback/Toaster.tsx` (+ test) | ◐ | ✅    | Navy toast, teal action. Moonlight test passes unchanged    |
| D19 | `components/brand/Logo.tsx`            | ◐    | ✅     | + optional `variant` (`full` / `mark`) and `alt`            |
| D20 | `components/brand/EstablishedTag.tsx`  | —    | ➖     | No SAF equivalent                                           |
| D21 | `BrandBar` (logo bar ± avatar menu)    | ✚    | ✅     | Mark + hairline + live wordmark; `actions` slot for the planner's ProfileMenu; full-bleed everywhere (Phase 4 audit removed the `contained` cap) |
| D22 | `CaptionStack` (vertical captions)     | ✚    | ✅     | Decorative, `aria-hidden`                                   |

## E. Asset manifests (see [ASSETS.md](ASSETS.md))

| #  | Moonlight file          | Type | Status | Notes                                               |
| -- | ----------------------- | ---- | ------ | --------------------------------------------------- |
| E1 | `src/assets/` folders   | —    | ✅     | Delivered as `images/memory-wall/` (kebab-case), kept |
| E2 | `assets/brand.ts`       | ◐    | ✅     | `logo`, `logoMark` (derived), `iconAssets.google`   |
| E3 | `assets/auth.ts`        | ◐    | ✅     | Both backdrops verified. Register measured in Phase 3: `artEdge` 990/1672, `captionEdge` 1570/1672 (window decor), `objectPosition` y 60%, `maxAspect` 1.8 (its baked steps sit 2.5% above the bottom edge) |
| E4 | `assets/memoryWall.ts`  | ◐    | ✅     | Same exports as Moonlight + `headerBackground`. 15 samples as `frame-01…15`. Unused until Phase 4; `ROOM_PHOTO` scale and sofa (A9) still open |

## F. Auth feature

| #   | Moonlight file                                   | Type | Status | Notes                                         |
| --- | ------------------------------------------------ | ---- | ------ | --------------------------------------------- |
| F1  | `features/auth/lib/limits.ts`                    | ≡    | ✅     |                                               |
| F2  | `lib/identifier.ts` (+ test)                     | ≡    | ✅     |                                               |
| F3  | `lib/loginValidation.ts` (+ test)                | ≡    | ✅     |                                               |
| F4  | `lib/registerValidation.ts` (+ test)             | ≡    | ✅     |                                               |
| F5  | `lib/authErrors.ts`                              | ≡    | ✅     | No brand strings                              |
| F6  | `lib/mockAuth.ts`                                | ≡    | ✅     | Untouched (R4)                                |
| F7  | `hooks/useLoginForm.ts`                          | ≡    | ✅     |                                               |
| F8  | `hooks/useRegisterForm.ts`                       | ≡    | ✅     |                                               |
| F9  | `components/AuthLayout.tsx`                      | ◐    | ✅     | Same props (`hero`, `variant`, `compact`). `hero` is an `AuthBackdropAsset`; card side from the asset. Backdrop mode = `hero-fits` **and** the card fits beside the art (`useBackdropFits`); `data-backdrop` / `data-compact` drive the `on-backdrop:` / `compact-short:` variants |
| F10 | `components/AuthHero.tsx`                        | ◐    | ✅     | Full-page sticky backdrop (mounted only in backdrop mode): sharp text-safe box + **edge fill** (CSS gradients of the image's measured edge colours, aligned to the rendered image) so wide windows have no blank margins |
| F11 | `components/AuthDecorations.tsx`                 | ◐    | ✅     | Image-free layouts: arcs, sage block, caption stacks (≥ 52rem / lg) |
| F12 | `components/AuthHeader.tsx`                      | ◐    | ✅     | + `eyebrow`. Logo moved to BrandBar. `align`/`titleTone`/`compact` kept |
| F13 | `components/AuthForm.tsx`                        | ◐    | ✅     | SAF default `primary-gradient` CTA with `→`   |
| F14 | `components/LoginForm.tsx`                       | ≡    | ✅     | Byte-identical                                |
| F15 | `components/RegisterForm.tsx` (+ test)           | ≡    | ✅     | Byte-identical, Full Name first (R1). Moonlight's `RegisterForm.test.tsx` + `registerValidation.test.ts` pass unchanged |
| F16 | `components/GoogleButton.tsx`                    | ≡    | ✅     | Byte-identical                                |
| F17 | `components/GoogleSignIn.tsx`                    | ≡    | ✅     | Byte-identical                                |
| F18 | `components/AuthSwitchPrompt.tsx`                | ≡    | ✅     | Doc comment only                              |
| F19 | `pages/LoginPage.tsx`                            | ◐    | ✅     | Verified at 16 viewports (see H)              |
| F20 | `pages/RegisterPage.tsx`                         | ◐    | ✅     | Same structure/props as Moonlight (`compact` shell, `RegisterForm`, switch prompt). Header left-aligned navy + eyebrow per the SAF mockup. Verified at 17 viewports |
| F21 | `pages/ForgotPasswordPage.tsx`                   | ◐    | ✅     | Login shell, SAF copy                         |
| F22 | Login copy → SAF copy                            | ◐    | ✅     |                                               |
| F23 | Register copy → SAF copy                         | ◐    | ✅     | "JOIN THE SAF STUDIO" / "Create Your Account." / "Start creating beautifully framed memories with Sagar Arts & Frames." / "Already have an account? Sign in" |
| F24 | Login eyebrow + hero tagline                     | ✚    | ✅     | Tagline is baked into the backdrop on desktop (in `alt`); live text only on image-free layouts |
| F25 | Register hero tagline + 01/02/03 steps           | ✚    | ✅     | Baked into the backdrop (and its `alt`); live text + `<ol>` steps via `AuthTagline` on image-free layouts |
| F26 | `components/AuthTagline.tsx`                     | ✚    | ✅     | Live tagline + mini-gallery motif for phones/tablets |
| F27 | `lib/backdropLayout.ts` (+ test)                 | ✚    | ✅     | Card placement beside baked-in art at any aspect ratio (12-viewport test) |
| F28 | `hooks/useBackdropFits.ts`                       | ✚    | ✅     | Falls back to the image-free layout when the card can't fit beside the art (Register at 4:3 / 1180×820). Resize-driven, listener cleaned up (tests) |

## G. Memory Wall Planner

| #   | Moonlight file                                        | Type | Status | Notes                                              |
| --- | ----------------------------------------------------- | ---- | ------ | -------------------------------------------------- |
| G1 | `features/memory-wall/lib/geometry/rect.ts` | ≡ | ✅ | Byte-identical |
| G2 | `lib/geometry/random.ts` | ≡ | ✅ | Byte-identical |
| G3 | `lib/geometry/layouts.ts` | ≡ | ✅ | Byte-identical |
| G4 | `lib/geometry/scene.ts` | ≡ | ✅ | Byte-identical |
| G5 | `lib/geometry/geometry.test.ts` | ≡ | ✅ | Byte-identical; passes unchanged (incl. the 1,536-layout invariant sweep) |
| G6 | `lib/plannerState.ts` (+ test) | ≡ | ✅ | Byte-identical (reducer clamps NaN / out-of-range input); test passes unchanged |
| G7 | `lib/savedDesigns.ts` (+ test) | ≡ | ✅ | Brand-only edit: `STORAGE_KEY` → `saf.mock.savedDesigns.v1` (test key updated to match) |
| G8 | `lib/templates.ts` | ≡ | ✅ | Byte-identical |
| G9 | `lib/exportImage.ts` | ≡ | ✅ | Brand-only edits: `-saf.png` file suffix, PNG caption `· ${APP_NAME}`, label/caption ink colours → SAF navy |
| G10 | `constants.ts` | ≡ | ✅ | Byte-identical, incl. Moonlight swatch lists (P4) and the `ROOM_PHOTO` sofa model (the vector sofa is drawn from it) |
| G11 | `hooks/usePlanner.ts`, `usePhotoUpload.ts`, `useSavedDesigns.ts` | ≡ | ✅ | Byte-identical |
| G12 | `pages/MemoryWallPage.tsx` | ◐ | ✅ | State/handler block and dialog wiring diff-identical to Moonlight (verified); SAF 12-column grid; integration test `MemoryWallPage.test.tsx` |
| G13 | `components/PlannerHeader.tsx` (+ ProfileMenu) | ◐ | ✅ | Shared BrandBar (`actions` = Moonlight ProfileMenu, logic unchanged; avatar icon, D9) + hero "Curate Your Perfect Wall." over `headerBackground` |
| G14 | `components/StepCard.tsx` | ◐ | ✅ | Same props + disclosure; unnumbered icon disc (D10; the step number is kept for screen readers) |
| G15 | `components/ConfigPanels.tsx` → `WallConfigPanel` | ◐ | ✅ | Same controls/actions; one-row layout via container query when the card is wide |
| G16 | `ConfigPanels.tsx` → `LayoutPanel` | ◐ | ✅ | "Layout Selection": style tiles (`SegmentedControl variant="tiles"`) + **Number of Frames** (P1). Gap controls moved to `FrameGapsPanel` (same actions) |
| G17 | `ConfigPanels.tsx` → `AiAssistantPanel` | ◐ | ✅ | "Need a little inspiration?" + room-photo cards (same presets/templates) |
| G18 | `components/DimensionInput.tsx` | ◐ | ✅ | Logic unchanged (rejects ≤ 0 / non-numeric, clamps, unit-aware error) |
| G19 | `components/FramePanels.tsx` → `FrameSelectionPanel` | ◐ | ✅ | "● Frame #N Selected" pill (D11); **Apply to all frames = one-shot button** (P2); dashed drop zone |
| G20 | `FramePanels.tsx` → `PreviewSettingsPanel` | ◐ | ✅ | 3 switches, collapsible as in Moonlight |
| G21 | `components/CanvasPanel.tsx` | ◐ | ✅ | Toolbar row (Save/Reset · Regenerate/Redesign/Generate; the "Option n of 3" carousel was removed at the client's request); 2-col grid on phones; fit badge + summary under the canvas |
| G22 | `components/WallCanvas.tsx` | ◐ | ✅ | Logic unchanged; SAF chips/colours |
| G23 | `components/WallSvg.tsx` | ◐ | ✅ | Frame rendering ≡. SAF room photo multiplied over the paint colour; **84″ sofa drawn as a to-scale vector at `scene.sofaTopY`** (the SAF photo has no sofa, A9). Hex colours → SAF (export-safe attributes) |
| G24 | `components/ActionBar.tsx` | ◐ | ✅ | Moonlight actions; no price (P3/FF3); Download stays in Preview Fullscreen (D8/FF4) |
| G25 | `dialogs/FullscreenPreviewDialog.tsx` | ◐ | ✅ | Navy gallery stage, teal download pill (gradient ≥ 4.5:1) |
| G26 | `dialogs/TemplatesDialog.tsx` | ◐ | ✅ | Token re-skin |
| G27 | `dialogs/SavedDesignsDialog.tsx` | ◐ | ✅ | Token re-skin |
| G28 | `dialogs/SaveDesignDialog.tsx` | ◐ | ✅ | Token re-skin |
| G29 | `StepStrip` (01 Wall Setup … 04 Preview & Quote) | ✚ | ✅ | `PlannerHeader` StepStrip: `<ol>`, scrolls sideways on phones |
| G30 | Layout tiles | ✚ | ✅ | `SegmentedControl variant="tiles"` + `LayoutStyleIcon` (drawn in code, A13); radio semantics unchanged |
| G31 | Inspiration cards | ✚ | ✅ | Inline in `AiAssistantPanel` (button with `aria-pressed`, as in Moonlight) |
| G32 | Fit badge + scene warnings list | ◐ | ✅ | Kept (D12); integration test hits "Check fit" on a 40 × 4 ft wall |
| G33 | Live arrangement summary (`aria-live`) | ◐ | ✅ | Kept (D22) |
| G34 | Responsive: 3-col → 2-col → stacked + fixed mobile bar | ◐ | ✅ | xl 12-col mockup grid → md 2-col → phones stacked, canvas first, collapsible panels, fixed bottom bar |
| G35 | `features/quotes/*` | — | ➖ | Empty in Moonlight too. Nothing to port |
| G36 | Planner copy → SAF copy | ◐ | ✅ | "Curate Your Perfect Wall." / "Design, personalise and preview your own gallery wall." (document title stays "Memory Wall Planner") |

---

## H. Behaviour parity (verified in Chromium against the production build)

Verified 2026-11-06 with a scripted headless-Chromium run on `vite preview` (prod build, CSP on).
"(unit)" means it is covered by a Moonlight test running unchanged in SAF.

### Routing & shell
- [x] `/` redirects to `/login`. Unknown path shows the 404 page. `/forgot-password` and `/memory-wall` load lazily
- [x] Route error boundary: friendly page, "Reload page", chunk-load errors say "Update available" (audit: blocked lazy chunk → "Update available" + Reload, no technical details shown)
- [x] Delayed page loader (no spinner flash on cached loads) (audit: cold load with a slow chunk → loader opacity 0 at 80 ms, 1 at 780 ms; in-app navigations keep the current page during the transition, as Moonlight's router)
- [x] Every page sets `<title>… · Sagar Arts & Frames</title>`

### Login
- [x] Single "Mobile No. or Email" field: email → `{ email }`, Indian mobile → `{ phone }` in E.164 (unit + browser)
- [x] Validation on blur and submit, live re-validation after the first error, first invalid field focused
- [x] Autofill-safe state; one submission at a time; abort on unmount (unit: `useForm.test.tsx`)
- [x] Password show/hide toggle (`aria-pressed`, constant `aria-label`)
- [x] "Forgot Password?" → `/forgot-password` (placeholder page + "Back to sign in")
- [x] Submit shows "Signing in…" spinner, then the mock success navigates to `/memory-wall`
- [x] API error mapping: generic credential error, 429 / 5xx copy, field-level errors (unit)
- [x] "Continue with Google" shows the inline "coming soon" notice
- [x] "Create an account" → `/register`
- [x] `maxLength` caps from `AUTH_LIMITS` (254 / 128)

Also verified for Login: no horizontal scroll and no console errors/warnings at 320×568, 320×640,
375×812, 414×896, 768×1024, 844×390, 1024×768, 1024×1366, 1180×820, 1280×720, 1366×768, 1440×900,
1536×864, 1920×1080, 2560×1440 and 2560×1080. Laptops ≥ 1280×720 fit without scrolling, and the hero
image is never requested on image-free layouts. Keyboard order: identifier → password → show password →
Forgot Password? → Sign In → Google → Create an account.

### Register
- [x] Fields in order: Full Name (R1), Email, Mobile (+91 fixed), Password + policy hint (`aria-describedby`); autocomplete `name/email/tel-national/new-password`; caps 100/254/20/128
- [x] Unicode names allowed (Devanagari verified); strict email pattern (`a@b..co` rejected); Indian mobile normalisation; password policy (letter + digit); first invalid field focused; live re-validation
- [x] 409 duplicate maps to the right field (unit: `registerValidation.test.ts`); submit "Creating account…" → `/memory-wall` (browser)
- [x] Google notice; "Sign in" → `/login`; keyboard order Full Name → Email → Mobile → Password → Show password → Create Account → Google → Sign in
- [x] `RegisterForm.test.tsx` and `registerValidation.test.ts` pass unchanged

Also verified for Register (prod build, Chromium): no horizontal scroll, clipping or console errors at
320×568 → 2560×1440 (17 viewports + 200% zoom). **Backdrop** from 1280×720 up, **image-free** below and at 4:3
(1024×768) and 1180×820, where the card can't fit beside the art. Fits without scrolling at 1440×900 and up;
scrolls 75–151px on 720–800px-tall laptops (backdrop stays sticky), as in Moonlight.

### Planner: state & controls
- [x] Default wall 12 × 9 ft, Warm Cream, Grid, 3 in gap, 9 frames 12×16 portrait (Moonlight defaults, R2) (integration + browser)
- [x] Wall width/height input in the selected unit, clamped 36–480 in / 48–240 in, error text in the current unit (integration: 0 / −5 / `abc` rejected, 1000 ft and 0.1 ft clamped with message)
- [x] Paint shade swatch changes the wall colour (integration)
- [x] Measurement unit ft / in / cm / m changes inputs and canvas labels only (no relayout) (audit: 12 ft → 365.8 cm in inputs, guide "366 cm (Wall Width)", arrangement unchanged)
- [x] Layout style Grid / Salon / Centre / Row (clears the active template) (integration + browser)
- [x] Frame gap stepper 0–12 in (0.5 step) or cm (1 step); gap unit in / cm (audit: +0.5 in, in → cm conversion, clamps at 12 in / 0, + / − `aria-disabled` at bounds)
- [x] Number of frames 1–16 (D2); new frames copy the last frame's style (integration: driven past both bounds)
- [x] Inspiration presets apply a template with an Undo toast; the active preset is highlighted (audit: click applies, `aria-pressed`, toast with Undo)
- [x] Frame chips select a frame (radio group, scroll sideways on phones); clicking a frame on the canvas selects it (browser: keyboard Enter on a canvas frame)
- [x] Apply to all frames copies size/orientation/finish/mount (D3, one-shot) (integration, P2)
- [x] Upload / Replace photo: MIME + ≤ 25 MB + min resolution checks, DPI quality hint, orientation suggestion (browser: 3000×2400 PNG → DPI hint → "Switch frame to landscape")
- [x] Remove photo; uploads survive panel collapse and Undo; late uploads land on the right frame (by id) (audit: Remove → empty slot + "No photo yet"; upload-by-id + page-level hook are ≡ Moonlight)
- [x] Fill empty frames with samples (audit: on → sample in the empty frame, off → empty slot again)
- [x] Frame size select, Portrait / Landscape, wood finish, mount on/off, mount colour, mat 0–6 in (0.5 step) (audit: size, orientation, finish, mount on/off, mount colour, mat +0.5)
- [x] Mount colour + mat disabled when the mount is off (audit)
- [x] Preview toggles: reference sofa, index badges, dimension guides (audit: badges 11 → 0, guides removed, sofa by unit test)
- [x] Changing size/orientation clears the template highlight (audit: preset `aria-pressed` true → false after a size change)

### Planner: canvas & actions
- [x] Canvas drawn to scale with eye level 60″, side margins, sofa clearance; guides + labels follow unit (visual; sofa line = `sofaTopY`, unit test)
- [x] Fit badge + warnings (too wide, too tall, overlap, low coverage) (integration: extreme 40 × 4 ft wall → "Check fit")
- [x] ~~Variant carousel ‹ ● ○ ○ › ("Option n of 3")~~ removed at the client's request (canvas and fullscreen preview)
- [x] Regenerate = same style, new seed. Redesign = next style + new seed (browser)
- [x] Generate Layout: ~450ms beat, scores every style × variant, applies the best, toast (success/info) with Undo; double-click safe; edits during the beat respected (browser: busy state, double-click → one toast, Undo restores)
- [x] Save Design dialog (title, uploads-not-saved warning) → toast with "View" (browser: name field focused, Enter saves, toast)
- [x] Reset → toast with Undo (browser)
- [x] Preview Fullscreen: view toggles, Download PNG with in-dialog status (browser)
- [x] Download works with uploaded photos in the production build (CSP-safe export) (browser, prod CSP: `living-room-gallery-wall-saf.png`)
- [x] All Templates: filter by layout, live previews on the user's wall, fit badge, "In use", apply + Undo (audit: filter 10 → 3, live previews = list size, "Fits your wall" badges, apply + toast)
- [x] My Saved Templates: search, open (Undo toast), delete with confirm/keep and focus management, empty state, save current, cross-tab sync, cap 50, sanitised on load (audit: search, delete with Keep / Delete confirm, open → "Opened …" toast with Undo)
- [x] Request a Quote → "opens soon" toast with "Save design" action (browser)
- [x] Profile menu: Esc / outside click / arrow keys; "My Saved Templates"; "Sign out" clears tokens → `/login` (browser: Esc closes; Sign out → /login)
- [x] Toasts pause on hover/focus; Undo toasts last 8s (unit: `Toaster.test.tsx` ✅; planner use ⬜)
- [x] Phones: canvas first, collapsible panels, fixed bottom bar with Request a Quote; no horizontal scroll at 320px (browser 390×844 + 95-page audit)

---

## Design deltas & decisions

Places where the SAF mockups differ from Moonlight's _behaviour_. **Outcome** reflects R1–R5.

| ID  | Area      | SAF mockup shows                                                     | Moonlight behaviour                                  | Outcome                                                                                                 |
| --- | --------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| D1  | Register  | Email, Mobile, Password only                                         | **Full Name** first (backend requires `full_name`)   | ✅ **R1: keep Full Name**, Moonlight's code verbatim                                                    |
| D2  | Planner   | No "Number of Frames" control                                        | Stepper 1–16 (`frames/setCount`)                     | ✅ R5: keep the stepper (placed in the Layout Selection card)                                           |
| D3  | Planner   | "Apply to all frames" **checkbox**                                   | One-shot **action** (`frames/applyToAll`)            | ✅ R5: one-shot action, rendered as a button where the checkbox sits                                    |
| D4  | Planner   | Mat Margin has a unit dropdown ("inches")                            | Inches only                                          | ✅ R5: inches only, static "in" label                                                                   |
| D5  | Planner   | Frame Gaps unit is a dropdown                                        | in / cm segmented                                    | Same state (`layout/setGapUnit`), may render as `Select`. Presentation only                             |
| D6  | Planner   | Colour-wheel swatch (custom colour)                                  | Fixed swatch list                                    | ✅ R2/R5: no wheel; Moonlight's paint list                                                              |
| D7  | Planner   | "Estimated Price ₹ 18,500" in the action bar                         | No price shown                                       | ✅ R4/R5: no price display                                                                              |
| D8  | Planner   | "Download Design" directly in the action bar                         | Download lives inside Preview Fullscreen             | ✅ R5: Moonlight flow. Download stays in Preview Fullscreen                                             |
| D9  | Planner   | Avatar with initials "AS" + chevron                                  | Profile pill with icon; "Preview account"            | ✅ R5: Moonlight's menu and icon, SAF styling                                                           |
| D10 | Planner   | Steps 01–04 as a hero strip; panels unnumbered                       | Numbered StepCards ①–④                               | Presentation only. StepCard keeps collapsible behaviour on phones                                       |
| D11 | Planner   | "● Frame #1 Selected" pill                                           | "Selected Frame #1" heading                          | Copy/visual change only                                                                                 |
| D12 | Planner   | No "New"/"Interactive" badges, no fit badge                          | Decorative badges + functional fit badge/warnings    | ✅ R5: keep fit badge + warnings; decorative badges may follow the mockup                               |
| D13 | Planner   | Eye level label "57 - 60 in (Eye Level)"                             | Moonlight's eye-level label, 60″ rule                | ✅ R5: Moonlight's label + geometry                                                                     |
| D14 | Planner   | 6 wood finishes as **texture** tiles                                 | 8 finishes, flat hex, `textured` swatch mode         | ✅ **R2: Moonlight's 8 finishes**; textured radial shading                                              |
| D15 | Planner   | 5 paint shades; 7 mount colours                                      | 7 paint shades; 4 mount colours                      | ✅ **R2: Moonlight's lists**                                                                            |
| D16 | Auth      | Login card left / art right; register art left / card right; brand bar | Hero left / form right; logo in form              | ✅ Card side comes from the backdrop asset (`cardSide`); BrandBar above                                 |
| D17 | Auth      | Taglines look like live text                                         | Taglines baked into hero images (W2)                 | ✅ Delivered art **has baked text**. Moonlight's W2 approach: text in `alt`, never overlaid; live text only where the image isn't shown |
| D18 | All       | **No mobile mockups**                                                | Moonlight had mobile views for auth                  | ✅ **R3**: our design, documented in RESPONSIVE.md                                                      |
| D19 | Auth      | Brand copy                                                           | Moonlight copy                                       | SAF mockup copy (F22–F25, G36). Error/notice copy stays the same, with the brand name swapped           |
| D20 | Planner   | "Need a little inspiration?" heading                                 | "AI Layout Assistant"                                | Copy change only; same presets and templates                                                            |
| D21 | Planner   | Dialogs not designed                                                 | Built                                                | Port with SAF card language (`Dialog` already re-skinned)                                               |
| D22 | Planner   | No "Generated Layout" title or arrangement summary                   | Title + `aria-live` summary                          | ✅ R5: keep                                                                                             |
| D23 | Register  | `+91 ▾`, which suggests a country picker                             | Fixed `+91` (Q15)                                    | ✅ R5: fixed +91, no chevron (`PhoneField`)                                                             |
| D24 | Auth      | No mobile mockups (R3)                                               | Tagline / hero copy shown on phones                  | ✅ **Product owner (2026-11-06)**: phones show the **card only** (no tagline), centred, no scroll; all auth sizes fluid. Register also hides its tagline + steps on image-free screens shorter than 1088px. Presentation only, no logic change |

## Server-side validation required at backend integration

Client-side checks are UX only. All of the rules below are copied verbatim from Moonlight (identical
in both clients) and **must also be enforced by FastAPI** when the live API is wired (ROADMAP Phase 5,
"Phase 6" in the audit brief). Cross-referenced to API_ALIGNMENT.md.

| Input | Client rule (both clients) | Server must | Ref |
| ----- | -------------------------- | ----------- | --- |
| Login identifier | Email (strict pattern, local part ≤ 64, ASCII) **or** Indian mobile → E.164; ≤ 254 chars | Same formats and limits; accept `{ email }` or `{ phone }` | M1, Q15, Q20 |
| Password | Login: required, ≤ 128. Register: 8–128, ≥ 1 letter + 1 digit (assumed policy) | Enforce the real policy and the 128 cap; hash; never echo | Q18, Q19 |
| Full name | 2–100 chars, Unicode letters/marks, space `.'’-`, starts with a letter | Same; trim and collapse spaces | M2, Q19 |
| Email (register) | Strict pattern, ≤ 254 | Validate (e.g. Pydantic `EmailStr`); unique, so 409 with `details[].field` | Q19, Q20 |
| Mobile (register) | Indian mobile, normalised to E.164, ≤ 20 raw chars | Validate E.164; unique, so 409 | Q15, Q19 |
| Auth endpoints | Generic "details don't match" on 401/403; 429 copy | Same 401 for unknown account / wrong password; **rate-limit** login + register (429) | Q17 |
| Error bodies | Client now **sanitises** malformed bodies (audit) | Always return the contract envelope; `issue` plain text, no stack traces/internals | Q11, Q18 |
| Planner designs (Phase 4) | `sanitizePlannerState`: known ids, wall 36–480″ × 48–240″, gap 0–12″, mat 0–6″, 1–16 frames, ≤ 50 saved | Same bounds on `POST/PUT /designs`; photo refs = owned photo ids, never free URLs | Q22 |
| Design title (Save design, rename) | Trimmed, whitespace collapsed, ≤ 80 chars (`design/rename`, `sanitizePlannerState`); rendered as text only | Same normalisation and cap on `POST/PUT /designs`; never render as HTML | Q22 |
| Photo uploads (Phase 4) | MIME image/*, ≤ 25 MB, min resolution | Re-check MIME by content sniffing, size, dimensions; strip metadata | Q14 |

## Audit 2026-11-06 (after Phase 2)

Full-codebase audit covering security, bugs, parity and quality. Every finding was fixed with a
regression test, except where noted as no-fix.

| # | Area | Finding | Fix | Regression test |
| - | ---- | ------- | --- | --------------- |
| 1 | Bug (shared) | `apiClient`: a FastAPI `detail[]` item without `loc` threw a **TypeError** inside the error path, so the form showed a generic error instead of the server's | `toApiError` validates every item | `services/apiClient.malformed.test.ts` |
| 2 | Bug (shared) | `apiClient`: non-string `details[].issue` (object/array) reached React as a child, which **crashes the form**. A non-array `details` was kept as-is. A non-string `code`/`message` was kept as-is | `sanitizeDetails()` keeps only `{ field: string, issue: string }`; code/message coerced | same |
| 3 | Bug (shared) | `ApiError.fieldErrors` used `in`, so a field named `constructor`/`toString` was silently dropped | `Object.hasOwn` | same |
| 4 | Security (shared) | `tokenStorage` cached the session in memory: after **sign-out in another tab**, this tab kept sending the old Bearer token until reload | `storage` event listener invalidates the cache | `services/tokenStorage.crossTab.test.ts` |
| 5 | Bug (SAF) | `backdropLayout`: zero/NaN image size or NaN fractions emitted `NaN`/`Infinity` into CSS (card loses its position, covers the art); captions past the art weren't rejected | `normalize()` clamps and falls back | `backdropLayout.test.ts` (+10 cases) |
| 6 | A11y (SAF) | Gradient CTA started at `brand-500`: white label **3.9:1** (fails AA). The mockup's own gradient is 4.0:1 | Gradient `brand-600 → brand-700` (≥ 5:1) | `styles/contrast.test.ts` |
| 7 | A11y (SAF) | Alert error text `danger-600` on `danger-50` = **4.49:1** | New token `danger-700` (6.1:1) | same |
| 8 | A11y (SAF) | Switch off-state boundary `ink-300` ≈ **1.9:1** (WCAG 1.4.11 needs 3:1) | `ink-400` border (3.2:1) | same |
| 9 | Quality (SAF) | Font-inlining CSP fix had no regression guard | Extracted to `config/build.ts` | `config/build.test.ts` |
| 10 | Quality (SAF) | Hard-coded `fill="white"` in the tagline motif | `var(--color-surface)` | (lint-level) |
| — | Guard | Crossing `hero-fits` mid-typing must not remount the form; backdrop mounted only under `hero-fits`; no duplicate tagline; media listener cleaned up | Already correct | `AuthLayout.test.tsx` |

Verified clean (no change needed): no `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function`;
no `target="_blank"`, no `http://` links (only SVG namespaces); no secrets in code or docs;
`npm audit` 0 vulnerabilities (no dependency changes); no `any`, `@ts-ignore` or lint suppressions; no
`console.log` (the only console call is a dev-only `console.error` in `RouteErrorPage`, as in
Moonlight). Tokens only ever travel in the `Authorization` header (never URLs, logs or messages). The
prod build ships the CSP, no `data:` fonts, no source maps and no env names. SVG assets contain no
scripts, handlers or external refs. The source PNGs carry C2PA/IPTC "AI-generated" provenance metadata,
which `sharp` strips: none of it ships in the built WebP files.

Responsive re-check: 5 routes × 19 viewports (RESPONSIVE.md list + 200% zoom) = 95 prod page loads, with no
overflow, clipping, off-screen controls or console errors. The only flag is the "Create an account" /
"Back to sign in" links under 24px tall, which are **inline in a sentence** (WCAG 2.5.8 inline exception) and
byte-identical to Moonlight.

## Fix 2026-11-06: Register/Login blank side margins on wide windows (user report)

| Item | Detail |
| ---- | ------ |
| Symptom | Maximised 1080p browser (≈ 1903×917, or 1522×733 CSS px at 125% Windows scaling): wide blank margins left and right of the register backdrop; a horizontal scrollbar was also reported |
| Cause | The backdrop box is capped at `maxAspect` × height (1.8 for register) so baked text is never cropped; windows wider than that (≈ 2.26:1 here) showed the plain mist page beside it. Our sweeps used device presets with headless Chromium's hidden scrollbars, so they missed both the window shape and scrollbar behaviour |
| Fix | `AuthHero` ambient layer (same image, no extra download, blurred, full width); per-asset `edgeFade` so the sharp image blends gradually without fading baked text; `overflow-x: clip` on the auth shell. Text-safety cap unchanged |
| Horizontal scroll | **Not reproducible** before the fix (prod and dev builds, 956 live-resize sizes at 100% / 125% scaling with classic scrollbars, all `scrollWidth == clientWidth`). Now structurally impossible on auth pages (`overflow-x: clip`) |
| Tests | `AuthLayout.test.tsx` (ambient image shares src/srcset/sizes, is `aria-hidden`, a single announced image; shell uses `overflow-x-clip` not `hidden`), `backdropLayout.test.ts` (fade vars, defaults and clamping). Browser: 115-page audit **with classic scrollbars** incl. 1903×917 / 1903×937 / 1522×733 / 1680×1050, 0 overflow; register 25/25 and login 23/23 behaviour checks |
| Shared logic | None (SAF presentation only), so no Moonlight sync needed |

## Fix 2026-11-06: Register scrolls; same fixes as Login (user report)

| Item | Detail |
| ---- | ------ |
| Symptom | Register (5 fields + password hint) scrolled on laptops (16–142px at 589–768px tall), on 375×667 / 320×568 phones and on 1024×768 / 768×1024 (tagline + steps under the card) |
| Fix | Register-only token section (`[data-auth][data-compact]`, declared last; RESPONSIVE.md "Register"): every size linear in viewport height from a compact set at 600px tall (36px controls, 13px text, 3–7px gaps) to the mockup at 1080px. Old Register token block removed; laptop blocks now target Login / Forgot password only. `AuthLayout` (compact only): card centred at every width, tagline only on ≥ 1088px-tall image-free screens. `AuthHeader` (compact only): eyebrow dropped ≤ 640px tall. `TextField`: label line-height, hint and error size are tokens whose defaults are the old `leading-5` / `text-sm` |
| Result | 0px scroll at 1920×1080, 1440×900, 1366×768, 1280×720, 1280×600, 1263×589 @1.5, 1366×657 @1.25, 1024×768, 768×1024, 375×667, 320×568 and more. Exception: landscape phones. Login and Forgot password card heights identical before/after at every measured size |
| Not changed | Colours, fonts, fields, validation, submit, password toggle, routing and links (26/26 register behaviour checks incl. validation, focus, toggle, submit → /memory-wall, "Sign in" → /login). Login page |
| Tests | `authTokens.test.ts` ("Register no-scroll tokens": declared last, Login/laptop blocks don't target Register, anchor values at 600px / 1080px, ≈ 42px at 768px, monotonic in height, floors, 16px input text, TextField defaults = old sizes); `AuthLayout.test.tsx` (Register: tagline only on tall screens, centred zone, eyebrow hidden ≤ 640px; Login layout unchanged). Browser: 110-page sweep 0 issues, login 23/23 |
| Shared logic | None (presentation only) |

## Fix 2026-11-06: auth card oversized on laptops (user report)

| Item | Detail |
| ---- | ------ |
| Symptom | At 1366×768 and 1920×1080 with 125–150 % scaling the card's type, fields and buttons took too much space next to the hero art |
| Fix | Laptop-only token layer (RESPONSIVE.md, "Laptops"): ≥ 1024px wide and (≤ 1536px wide or ≤ 800px tall). Title 26–36px, labels / subtitle 13–14px, fields and buttons 44px (40px at 589px tall), input text 15px (mouse screens only), icons 18px, card padding 28px and `max-width` 26rem, gaps 6–14px. `TextField`, `PasswordField`, `AuthForm`, `AuthLayout` read new tokens whose defaults equal the old fixed sizes |
| Not changed | Everything < 1024px (measured: login card height identical at 320×568 → 768×1024) and screens wider than 1536px and taller than 800px. Eyebrow stays 12px |
| Tests | `authTokens.test.ts` (laptop block: every query starts with `min-width: 64rem`, 42–46px fields, 28px padding, 416px card, gaps ≤ 14px, 40px at 589px tall, defaults unchanged elsewhere, 15px input text only for `pointer: fine`). Browser: 110-page sweep 0 issues, login behaviour 23/23 |
| Shared logic | None (presentation only) |

## Fix 2026-11-06: oversized auth controls; Login scrolls on phones (user report)

| Item | Detail |
| ---- | ------ |
| Symptom | Fonts, fields and buttons on the auth card felt too big and didn't shrink with the window; on phones Login scrolled because the tagline section sat under the card |
| Cause | Sizes were fixed per breakpoint (`text-[3.25rem]`, `h-12 sm:h-13`, `px-10 py-10`…) with three height-based overrides (`short`, `compact-short`, `tight`), so most windows got either the full desktop size or a step; phones showed card + tagline (~800px) |
| Fix | **Fluid tokens** on `<main data-auth>` (`--auth-*`, `--field-h`, `--field-label-gap`; RESPONSIVE.md "Fluid sizing"): clamp(MIN, min(width term, height term), MAX), exactly the mockup at 1440×900. The `short` / `compact-short` / `tight` variants are removed. Phones: tagline hidden below `md` and on ≤ 640px-tall screens, card centred vertically; eyebrow dropped on ≤ 576px-tall screens. Register uses the same tokens with its own maxima (`data-compact`) |
| Result | Login: no scroll from 320×568 to 2560×1440 (incl. 1263×589 @1.5); landscape phones still scroll (card alone needs ≥ 441px of 334px). Register: now fits 360–412px phones and 1440×900+; laptop scroll down to 20–44px (was 106–151px) |
| Tests | New `features/auth/lib/authTokens.test.ts` (parses the real CSS: mockup values at 1440×900 / 1920×1080 / 2560×1440, monotonic shrink in width and height, 40px / 28px / 15px floors, compact values at 1263×589); `AuthLayout.test.tsx` (token wiring on zone / card / field / CTA / title, no fixed density classes left, tagline hidden on phones, card centred). Browser: 110-page collision / overflow sweep 0; login 23/23 and register behaviour checks (expectation updated: phone = card only) |
| Shared logic | None. `AuthForm`'s `compact` prop is kept for API parity but no longer read (density comes from `data-compact`) |

## Fix 2026-11-06: Login scrolls on short viewports; backdrop margins look broken (user report)

> The `tight` variant from this fix was superseded the same day by fluid sizing (entry above).

| Item | Detail |
| ---- | ------ |
| Symptom | Edge at 150 % Windows scaling (≈ 1263×589 CSS px): the Login page scrolled, and the blurred side fill showed a visible seam and a smeared plant |
| Cause (scroll) | Densest step was `short` (≤ 880px): the card needed ~634px but only 525px sat under the bar (scroll 81–138px at 600–657px tall) |
| Cause (background) | The text-safe box (≤ 1.9:1) can't `cover` a 2.4:1 region without cropping baked text; the blurred copy of the image behind it didn't match the sharp edge |
| Fix | New `tight` variant (landscape ≤ 700px): slimmer bar, padding, type, 40px controls (see RESPONSIVE.md). `AuthHero`'s blurred copy replaced by an **edge fill**: per-asset `edgeFill` colour stops as CSS gradients, aligned via new `--ih` / `--img-top` vars, plus side vignettes. One image decode instead of two |
| Result | Login and Forgot password: 0px scroll at 1263×589 @1.5, 1280×600, 1280×700, 1280×720, 1366×657 @1.25, 1366×768, 1440×900, 1920×1080, 2560×1080. Register still scrolls on ≤ 768px-tall screens (documented, Moonlight behaviour) |
| Tests | `AuthLayout.test.tsx` (one hero image, no blur, fill aligned to `--ih` / `--img-top`; `tight` classes wired on zone, card, title, field and CTA), `backdropLayout.test.ts` (`--ih` / `--img-top`, `objectPositionY` parsing incl. keywords, clamping and garbage). Browser: 110-page collision/overflow sweep 0 issues; login behaviour 23/23 |
| Shared logic | None (SAF presentation only). `TextField` / `AuthForm` gained `tight:` classes only |

## Audit 2026-11-06 (after Phase 4: whole codebase, Memory Wall focus)

| # | Area | Finding | Fix | Regression test |
| - | ---- | ------- | --- | --------------- |
| 1 | Bug (layout) | **Blank side margins on wide windows (planner):** content capped at 100rem, so a maximised 1080p window had 144px of empty page each side (473px at 2560). Same class of bug as the register report | Planner page and BrandBar are fluid (no centred cap; `lg:px-12` gutters). The BrandBar `contained` option became dead and was removed | `MemoryWallPage.test.tsx` (no `max-w` on page / bar); browser: side margin 0 at 1280 → 2560 |
| 2 | Bug (layout) | **Blank strips inside the canvas panel:** the aspect-locked wall left 128–207px of empty white each side | `CanvasStage`: the wall sits on the room photo (same URL as the SVG's, no extra download), tinted by the paint colour, blurred. Canvas may grow to `min(62vh, 52rem)` | Test: stage present, same image URL, re-tints on paint change; browser: strips ≤ 15px (panel padding) |
| 3 | Bug (layout) | **"Warm Cream" overlapped the paint swatches** at ~1900px: Phase 4's `SwatchPicker` a11y fix positioned the selected-name aside absolutely, and the Wall Configuration one-row layout squeezed it into a narrow column | Aside back in normal flow **inside the legend** (`aria-hidden`, so the group name stays "Paint Shade"); Wall Configuration is container-driven in 3 steps (stacked / 2 rows from 36rem / 1 row from 56rem) | `SwatchPicker.test.tsx`; browser collision detector (110 loads, 0 collisions; detector self-tested on a synthetic overlap) |
| 4 | Implementation | `ActionBar`'s `QuoteButton` re-implemented the shared Button's gradient (fork inherited from Moonlight) | Uses `Button variant="primary-gradient"` (same label, handler, phone sizing) | Test: both quote buttons are shared Buttons and show Moonlight's toast |
| 5 | Docs | RESPONSIVE / DESIGN_SYSTEM / ARCHITECTURE described `contained`, 100rem caps, `LayoutTile` / `InspirationCard` files and scrolling chips that don't exist | Docs now match the code (fluid page, stage, container steps, wrapping chips) | n/a |
| 6 | Implementation | 13 planner behaviours had never been exercised | All 13 verified in the browser (see §H) | browser suite |

Verified clean (no change needed): XSS / `eval` / `new Function` / console / `any` / suppressions / secrets
sweeps; tokens only in the `Authorization` header (never URLs, logs or messages); `npm audit` 0 (no
dependency changes); every planner action type dispatched by the SAF UI = Moonlight's set; per-component
handler / ARIA / hook signatures match (differences only where raw buttons became the shared `Button`);
every listener / timer / object URL has a cleanup (no ResizeObservers or scroll handlers exist); rotation
portrait ↔ landscape keeps the arrangement and expands panels that stop being collapsible; decisions R1 +
P1–P5 enforced by tests; no placeholder pages or assets remain (remaining "TEMPORARY" / "TODO(Phase 5)"
markers are Moonlight's ≡ backend hooks, R4). Exactly one banner landmark per page in Chromium (a jsdom
test quirk reports more).

## Sync log (shared-logic changes)

Record any change to a ≡ file here and in the other repo.

| Date       | File | Change | Mirrored in Moonlight? |
| ---------- | ---- | ------ | ---------------------- |
| 2026-11-06 | `services/apiClient.ts` (+ new `apiClient.malformed.test.ts`) | **Bug fix (audit #1–3):** sanitise error bodies (`sanitizeDetails`, guarded FastAPI `detail[]`, string-only code/message) and use `Object.hasOwn` in `fieldErrors`. The same bug exists in Moonlight | ⚠️ **REQUIRED**: copy `apiClient.ts` and the test file verbatim |
| 2026-11-06 | `services/tokenStorage.ts` (+ new `tokenStorage.crossTab.test.ts`) | **Security fix (audit #4):** invalidate the cached session on `storage` events for the auth key (or `key === null`). The same bug exists in Moonlight | ⚠️ **REQUIRED**: copy the listener block and the test (key `moonlight.auth`) |
| 2026-11-06 | `components/ui/SwatchPicker.tsx` (+ new `SwatchPicker.test.tsx`) | **A11y bug fix (Phase 4):** the `<legend>` was wrapped in a `<div>`, so it wasn't the fieldset's first child and the colour radio groups ("Paint Shade", "Wood Moulding & Finish", "Mount Colour") had **no accessible name**. The legend is now the first child; the selected-name aside is absolutely positioned (same look). **The same markup exists in Moonlight** | ⚠️ **REQUIRED**: make Moonlight's `<legend>` the fieldset's first child and put the selected-name aside **inside** it as an `aria-hidden` span in normal flow (`legend: flex w-full justify-between`). Do NOT position the aside absolutely: that overlapped the swatches (SAF audit after Phase 4). Port `SwatchPicker.test.tsx` |
| 2026-11-06 | `features/memory-wall/lib/exportImage.ts`, `lib/savedDesigns.ts` (+ test) | Brand-only: export file suffix `-saf.png`, PNG caption `· ${APP_NAME}`, label/caption colours SAF navy; storage key `saf.mock.savedDesigns.v1` | N/A (intentional) |
| 2026-11-06 | `features/memory-wall/components/ActionBar.tsx` | `QuoteButton` now uses the shared `Button` (`primary-gradient`) instead of a hand-rolled gradient button. Presentation-only, same behaviour | Recommended (the same fork exists in Moonlight) |
| 2026-11-06 | — (audit after Phase 4: logic) | **No logic changes.** All audit fixes are SAF presentation (fluid page, `CanvasStage`, Wall Configuration layout steps, SwatchPicker aside placement) | N/A |
| 2026-11-06 | — (Phase 4 planner logic) | **No geometry/reducer changes.** `lib/geometry/*`, `plannerState`, `templates`, `constants`, `hooks/*` and Moonlight's `geometry.test.ts` / `plannerState.test.ts` are byte-identical (verified with `cmp`); the page's state/handler block and dialog wiring are diff-identical. No logic bug found | N/A |
| 2026-11-06 | — (Phase 3 Register) | **No shared-logic changes.** Register logic (`RegisterForm`, `useRegisterForm`, `registerValidation`, `identifier`, `authErrors`, `limits`, `mockAuth`, `useForm`) and both Moonlight register test files are byte-identical; no logic bug found. All Phase 3 changes are SAF presentation (`backdropLayout`, `useBackdropFits`, `AuthLayout`, `AuthTagline`, CSS variants) | N/A |
| 2026-11-06 | `vite.config.ts` + new `src/config/build.ts` (+ test) | Refactor: font-inlining policy moved into a tested module (behaviour unchanged since the Phase 2 entry) | Recommended (with the Phase 2 entry) |
| 2026-11-06 | `services/tokenStorage.ts` (+ tests) | Storage key `moonlight.auth` → `saf.auth` (brand-only) | N/A (intentional) |
| 2026-11-06 | `config/app.ts` | `APP_NAME` → "Sagar Arts & Frames" (brand-only) | N/A (intentional) |
| 2026-11-06 | `vite.config.ts` | `build.assetsInlineLimit` never inlines fonts. Vite inlines files < 4 KB as `data:` URIs, and the prod CSP (`font-src 'self'`) then **blocks** them. Plus Jakarta Sans ships a sub-4 KB subset | Not needed today (DM Sans subsets are all > 4 KB). **Recommended** as harmless hardening |
| 2026-11-06 | `assets/types.ts` | + `AuthBackdropAsset` (additive) | N/A (SAF-only type) |
| 2026-11-06 | `features/auth/components/AuthSwitchPrompt.tsx` | Doc-comment brand string only | N/A |
