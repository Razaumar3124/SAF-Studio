# Responsive Behaviour

Mobile-first, same breakpoints and global rules as Moonlight. The SAF mockups are **desktop only**
(≈1536–1586px wide). Phone and tablet layouts are **ours to design** (PORTING_PARITY R3) in SAF's
language, as documented below.

| Prefix | Min width | Typical device                    |
| ------ | --------- | --------------------------------- |
| (none) | 0         | Phones (design floor: 320px)      |
| `sm`   | 640px     | Large phones                      |
| `md`   | 768px     | Tablets portrait                  |
| `lg`   | 1024px    | Tablets landscape / small laptops |
| `xl`   | 1280px    | Laptops                           |
| `2xl`  | 1536px    | Desktops (mockup size)            |
| `3xl`  | 1792px    | Wide desktops (custom token)      |

Custom variants (in `index.css`; **declaration order matters**, later wins):

| Variant       | Applies when                                                                        | Origin    |
| ------------- | ----------------------------------------------------------------------------------- | --------- |
| `hero-fits`   | ≥ lg **and** landscape ≥ 4:3 (`config/media.ts` mirrors it for JS)                  | Moonlight |
| `on-backdrop` | inside `<main data-backdrop>`: auth backdrop mode (hero-fits **and** the card fits) | SAF       |

Auth pages don't use density variants (Moonlight's `short` and SAF's former `compact-short` / `tight` were
removed): every auth size is a **fluid token** (see "Fluid sizing" below).

**Global rules:** no horizontal scroll at 320px; gutters `px-4` → `sm:px-6` → `lg:px-8`; `min-h-dvh`
instead of `h-screen`; controls 40–52px tall; nothing interactive under 24×24px.

## Brand bar (all screens): `components/brand/BrandBar.tsx`

Sticky white bar (90% opacity, blurred) with a bottom hairline. Its height is the CSS variable
**`--bar-h`** (index.css), which layouts use to size the rest of the viewport:

| Viewport               | `--bar-h`  | Lockup                                                                 |
| ---------------------- | ---------- | ---------------------------------------------------------------------- |
| < 640px                | 3.75rem    | Mark `h-7` · hairline · "SAGAR ARTS & FRAMES". Tagline line from 400px |
| ≥ 640px                | 4.25rem    | Mark `h-9` + wordmark + "CUSTOM ART. TIMELESS FRAMES."                 |
| ≥ 1024px               | 4.75rem    | Mark `h-10`. Mockup proportions (≈75px bar)                            |
| Landscape ≤ 880px tall | 3.5 / 4rem | Smaller, to leave room for the form                                    |
| Landscape ≤ 700px tall | 3.5rem     | Slimmest bar                                                           |

The bar is full-bleed on every page (gutters `px-4` → `sm:px-6` → `lg:px-12`), logo pinned to the left edge
as in the mockups; no centred max-width, so wide windows never get blank edges. The `actions` slot holds the
planner's profile menu.

## Login & Register: `features/auth/components/AuthLayout.tsx`

Two modes. Backdrop mode needs `hero-fits` (as in Moonlight) **and** room for the card beside the
art: `useBackdropFits` evaluates the backdrop geometry for the current viewport (on resize). The
backdrop `<img>` is **not mounted** otherwise, so phones and tablets never download it. `<main
data-backdrop>` drives the `on-backdrop:` variant, so CSS and the JS decision can't disagree. Typed values
and focus survive a switch mid-typing (test: `AuthLayout.test.tsx`).

### Image-free mode: phones, portrait tablets, near-square windows

```
┌ brand bar ───────────────────────┐
│   ◜ mist arcs (decorative)        │
│  ┌ white card (shadow-float) ───┐ │
│  │ EYEBROW                      │ │
│  │ Welcome Back.                │ │
│  │ subtitle · form · OR · Google│ │
│  │ switch prompt                │ │
│  └──────────────────────────────┘ │
│  ── gold rule                     │  ← md+ only (tablets, near-square windows): live tagline
│  Your space. Your art. Your story.│     (AuthTagline) + mini-gallery motif. Hidden on phones
│  subtitle               ▢▣ sage ◞ │     and on screens ≤ 640px tall: there the card is alone
└──────────────────────────────────┘     and centred vertically, so the page doesn't scroll
```

| Viewport                                          | Details                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320–767px (phones)                                | **Card only**, centred vertically under the bar; no tagline. Card fills the gutter (`px-4`, `sm:px-6`); all sizes from the fluid tokens (title 28px, fields / CTA / Google 40px, subtitle 15px at 360–412px wide). The eyebrow is dropped on ≤ 576px-tall screens. **Login and Forgot password never scroll** (320×568 → 412×915)                                                                                                                  |
| 768–1023px                                        | Card `max-w-[32rem]`, top offset `md:pt-20`, tagline below. Fluid sizes (≈ 37px title, 45px fields at 768×1024). Caption stack "ART / FRAMES / PRINTS / WALL DECOR" appears from **52rem (832px)**, where it clears the card. Portrait iPads (768×1024) don't show it, 844×390 landscape phones do                                                                                                                                                 |
| ≥ 1024px, portrait / near-square (e.g. 1024×1366) | Same composition. The second caption stack ("/ 01 DESIGN · PERSONALISE…") appears at the bottom corner from `lg`                                                                                                                                                                                                                                                                                                                                   |
| Register                                          | Decor mirrored (arcs and captions on the right, sage block bottom-left). Card `max-w-[32rem]`; title `min(9.5cqi, --auth-title)` (one line from 320px). Tagline (md+) left-aligned and followed by the baked **01 PERSONALISE · 02 VISUALISE · 03 CREATE** steps as an `<ol>` (tracking tightens below 400px so "PERSONALISE" fits at 320px). Also used on landscape screens where the register card can't fit beside the art (1024×768, 1180×820) |

### Backdrop mode: `hero-fits` (≥ 1024px wide and landscape ≥ 4:3)

The delivered backdrops are full-page images with the art, tagline and side captions **baked in**
(ASSETS.md A4/A6). The page reproduces the mockup: the brand bar on top, the backdrop filling the rest,
and the card in the image's empty side. The text stays in the image (and in `alt`), never duplicated.

**Backdrop geometry** ([`lib/backdropLayout.ts`](../frontend/src/features/auth/lib/backdropLayout.ts),
unit-tested at 12 viewports). Pure CSS custom properties on `<main>` (a size container), so it tracks
resizes with no JS:

1. Region height `H = 100dvh − --bar-h`. The backdrop box is `min(100cqw, maxAspect × H)` wide and
   **centred**. `maxAspect` defaults to 1.9; Register uses **1.8** because its baked steps sit only ~2.5%
   above the image's bottom edge (1.9 clipped them at 1920×1080). Wider windows (e.g. a maximised 1080p
   browser, ≈ 1903×917, region ≈ 2.26:1) keep the text uncropped, and the side margins are filled by the
   **edge fill**: each half of the region continues the image's own outermost 24px column as a vertical
   CSS gradient (16 colour stops per side measured with sharp, `edgeFill` in the manifest), sized and
   offset exactly like the rendered image (`--ih`, `--img-top` from `backdropStyle`) so wall, floor and
   light bands meet the image row-for-row, then softened toward the page colour by side vignettes as wide
   as the margins. No second image decode, no blur, no seam. (It replaced a blurred full-width copy of
   the image, which read as a seam and a smear at 150 % scaling.)
   The box edges fade into the fill. Widths (`--fade-card` / `--fade-art`) grow with the side
   margin, up to 10rem / 6rem, but never past each asset's `edgeFade` safe edge (fraction of the image
   width before any baked text: login 2.5% / 1.2%, register 6% / 8%). With no margin they're 3rem / 0.75rem
   or less, the original look.
2. Inside the box the image is `object-cover`, **anchored to the art side** (`objectPosition` from
   the manifest), so only the empty card side is ever cropped.
3. The card zone runs from the far edge (gutter, or past the baked side captions) to the art edge minus
   2rem, and never past the viewport gutter. The card is 36% of the rendered image width (the mockup
   ratio), clamped to **22–34rem** and centred in the zone. If the zone is too narrow, it stays clear of the
   art and may cover decorative captions/edges. If even a 22rem card can't clear the art, `fits` is false
   and the image-free layout is used.
4. ≈ 4:3 screens (`max-aspect-ratio: 10/7`): the baked captions on the card side would be cut
   mid-word, so the fade widens to hide them completely.
5. The backdrop is `sticky`, so if a long form scrolls (Register on short laptops) the art stays put.

Measured results (login, production build):

| Viewport                      | Card (x, width)                            | Fits without scroll |
| ----------------------------- | ------------------------------------------ | ------------------- |
| 1024×768                      | 52 → 456 (404px), captions faded           | ✅                  |
| 1180×820                      | 136 → 571                                  | ✅                  |
| 1263×589 (1920×1080 at 150 %) | card 358px wide, 511px tall in 533px       | ✅                  |
| 1280×600                      | card 518 / 544px                           | ✅                  |
| 1280×720                      | card 449px wide                            | ✅                  |
| 1366×768                      | card 482px wide                            | ✅                  |
| 1440×900                      | 197 → 715 (mockup: 212 → 729)              | ✅                  |
| 1920×1080                     | 339 → 883 (34rem cap)                      | ✅                  |
| 2560×1080                     | 659 → 1203, box centred with faded margins | ✅                  |

Measured results (register, production build). Card on the right; image anchored left, y = 60%:

| Viewport           | Mode                                  | Card (x)                                  | Scroll                                                        |
| ------------------ | ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| 1024×768, 1180×820 | image-free (card can't clear the art) | centred                                   | page scrolls (tagline + steps below)                          |
| 1263×589, 1280×600 | backdrop                              | right side                                | 139–148px (5 fields + hint can't fit ~540px at 40px controls) |
| 1280×720           | backdrop                              | right side                                | 44px (was 151px)                                              |
| 1366×768           | backdrop                              | right side                                | 20px (was 106px)                                              |
| 1440×900           | backdrop                              | 899 → 1351                                | ✅ none                                                       |
| 1536×864           | backdrop                              | 933 → 1376                                | ✅ none                                                       |
| 1920×1080          | backdrop                              | 1172 → 1716, box 1.8:1 with faded margins | ✅ none, steps fully visible                                  |
| 2560×1440          | backdrop                              | 1664 → 2208                               | ✅ none                                                       |

### Fluid sizing (all auth pages)

No fixed per-breakpoint sizes: `<main data-auth>` defines `--auth-*` tokens in `index.css`, and every
font, field, button, padding and gap on Login / Register / Forgot password reads them (TextField reads
`--field-h` / `--field-label-gap`, which default to 48 / 52px elsewhere). Each token is

```
clamp(MIN, min(WIDTH TERM, HEIGHT TERM), MAX)
WIDTH TERM : linear, MIN at 360px wide → MAX at 1440px wide
HEIGHT TERM: linear through two anchors (Login: compact at 589px tall → mockup at 900px;
             Register: 1440×900-fitting values at 900px → full mockup at 1080px)
```

so everything shrinks together with whichever dimension is tighter. Spacing falls faster than controls
because labels and the 40px minimum controls can't shrink.

| Token                                                          | Login MIN → MAX                      | Register MAX    |
| -------------------------------------------------------------- | ------------------------------------ | --------------- |
| `--auth-title`                                                 | 28 → 52px (also ≤ 12cqi of the card) | 44px (≤ 9.5cqi) |
| `--auth-subtitle` / `--auth-prompt`                            | 15 → 18 / 14 → 16px                  | same            |
| `--field-h` = `--auth-cta-h` / `--auth-alt-h` (Google)         | 40 → 52 / 40 → 48px                  | same            |
| `--auth-cta-text` / `--field-label-gap`                        | 15 → 17 / 6 → 8px                    | same            |
| `--auth-card-px` / `--auth-card-py`                            | 20 → 40 / 14 → 40px                  | same            |
| `--auth-zone-py` / `--auth-stack-gap`                          | 8 → 32 / 12 → 32px                   | 32 / 24px       |
| `--auth-header-gap` / `--auth-section-gap` / `--auth-form-gap` | 6 → 12 / 12 → 24 / 12 → 20px         | 8 / 20 / 16px   |

Input text stays 16px (iOS zooms on smaller). At **1440×900 and above Login is exactly the mockup**
(52px title and fields, 40px card padding). Register reaches its full values at 1080px tall. Locked by
`features/auth/lib/authTokens.test.ts`, which evaluates the real formulas at known viewports.

#### Register: no scroll at any size from ~500px of content height

Register has its own token section (`index.css`, "REGISTER"), declared after the Login and laptop
blocks and scoped to `[data-auth][data-compact]`, so Login and Forgot password are unaffected. Every
size is linear in the viewport **height** between two anchors, clamped at both ends:

| Token                                        | ≤ 600px tall (compact)    | 1366×768                 | ≥ 1080px tall (mockup) |
| -------------------------------------------- | ------------------------- | ------------------------ | ---------------------- |
| Title                                        | 24px (≥ 22, and ≤ 9.5cqi) | 31px                     | 44px                   |
| Subtitle / labels / hint / "Already have…"   | 13 / 13 / 12 / 13px       | ≈ 15 / 13 / 13 / 14px    | 18 / 14 / 14 / 16px    |
| Fields, Create Account                       | 36px (34 below 600)       | 42px                     | 52px                   |
| Google                                       | 36px                      | 40px                     | 48px                   |
| Card padding (vertical)                      | 10px                      | ≈ 21px                   | 40px                   |
| Gaps: label / header / form / section / page | 3 / 3 / 7 / 6 / 6px       | ≈ 5 / 5 / 10 / 10 / 13px | 8 / 8 / 16 / 20 / 24px |

Label lines are 16px tall (Login keeps 20px), input text stays 16px (15px on mouse laptops, like Login),
the card is capped at 26rem on laptops, and the decorative eyebrow is dropped on ≤ 640px-tall screens.
The card is centred vertically at every width (no `md:pt-20`), and the live tagline + 01–03 steps show
only on tall image-free screens (≥ 768px wide and ≥ 1088px tall, e.g. 1024×1366); elsewhere it's the
card alone (phones, 1024×768, 1180×820, 768×1024).

Measured (production build, card height / space under the bar, all **0px scroll**): 1920×1080 844 / 1004,
1600×900, 1536×864, 1440×900 734 / 824, 1366×768 644 / 704, 1280×720 611 / 656, 1366×657 @1.25 567 / 601,
1280×600 508 / 544, 1263×589 @1.5 505 / 533, 1024×768, 1180×820, 768×1024, 1024×1366, 412×915, 390×844,
375×667 574 / 607, 360×740, 320×568 501 / 508. **Exception:** landscape phones (844×390: 334px under the
bar; five fields + hint + two buttons need ≥ 461px even at the floors, so the card scrolls). Validation
messages add a line under each invalid field, so a short screen may scroll while errors are shown.

The backdrop is the same as Login's: the text-safe box (≤ 1.8:1, so the baked tagline and steps are never
cropped) plus the edge-colour fill, so the image runs edge to edge at every size.

#### Laptops (≥ 1024px wide and (≤ 1536px wide or ≤ 800px tall))

> **Touch laptops only since the scaled-desktop pass.** With a mouse or trackpad, the "Scaled desktop"
> layer below overrides this section and Register's. The tables and measurements here still describe
> touch screens ≥ 1024px (e.g. iPad Pro landscape, touch laptops), which keep a 16px root.

A second, laptop-only layer overrides the same tokens for Login and Forgot password (`index.css`, "LAPTOPS AND SMALL DESKTOPS"; Register has its own section above). Every
media query in it starts with `(min-width: 64rem)`, so phones and tablets (< 1024px) are untouched
(`authTokens.test.ts` guards this and that the new tokens default to the old sizes outside it). A
1920×1080 screen at 125 % / 150 % scaling lands here (1536×864 / 1280×720 CSS px).

| Element                          | Laptop                                                                              | Notes                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Title                            | 26 → 36px (`clamp(1.625rem, min(2.4vw, 3.2dvh + 9px), 2.25rem)`)                    | 52px on larger, taller screens                                     |
| Eyebrow                          | 12px (unchanged, not raised to 13px)                                                | already below the 13–14px range                                    |
| Labels / subtitle / "New to…"    | 13 / 14 / 13px                                                                      |                                                                    |
| Fields, Sign In, Google          | 44px, 40px at 589px tall (`--field-h`)                                              |                                                                    |
| Input text / icons / eye toggle  | 15 / 18 / 36px (`--field-text`, `--field-icon`, `--field-toggle`)                   | input text stays 16px on touch screens, because iOS zooms on focus |
| Button text / arrow / Google "G" | 15 / 18 / 18px                                                                      |                                                                    |
| Card                             | padding 28px (16 → 28px vertically), `max-width` 26rem (416px), centred in its zone |                                                                    |
| Gaps                             | 6px (label, header), 12px (fields, sections), 12 → 14px (page)                      |                                                                    |

Measured (production build): Login card 489–513px tall in 533–800px of space, no scroll at 1024×768,
1263×589 @1.5, 1280×600, 1280×720, 1366×768, 1440×900 and 1536×864 (it was 566–712px). Register fits at
1440×900 and 1536×864 and scrolls 16px at 1366×768, 48px at 1280×720 and 133–142px at 589–600px tall.
Above 1536px wide and taller than 800px (1600×900, 1920×1080) the earlier mockup sizes apply.

Measured (production build, 0 = no scroll): Login 0 at 320×568, 360×740, 375×667, 390×844, 412×915,
768×1024, 1024×768, 1263×589 @1.5, 1280×600, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440.
Forgot password 0 everywhere including 844×390. Exceptions: **landscape phones** (844×390: 334px under
the bar; the login card needs ≥ 441px at legible sizes, so it scrolls with the card alone), and
**Register** on screens under ~740px tall (phones 375×667 70px, 320×568 161px; laptops above), with the
backdrop sticky as in Moonlight. Register fits 360×740, 390×844, 412×915, 1440×900 and up.

#### Scaled desktop (≥ 1024px wide, mouse / trackpad): the SAF compact reference

The SAF reference for Login and Register is the page at **80 % browser zoom** on a 1280-wide window
(a 1920×1080 display at 150 %, ≈ 1273×590 CSS px of page): the same design rendered at a 1592×738
viewport, then shown 0.8× smaller. It can't be reached with the fluid tokens above, which are already
at their floors (40px controls, 13–15px text, 22rem card) at that size, and whose px / `dvh` terms don't
scale with the root. So `index.css` "SCALED DESKTOP AUTH" (declared last, `@media (min-width: 64rem)
and (pointer: fine)`) does what the planner does ("Planner density"):

- **Root font** `--auth-root: clamp(13px, min(0.7026vw + 4px, 1.5vh + 4px), 20px)` (the planner's
  formula), applied as `:root:has([data-auth]) { font-size: var(--auth-root) }`. 13px at 1280 (and at
  ≤ 600px tall), 13.6px at 1366, 14.1px at 1440×900, 17.5px at 1920×1080, 20px cap at 2560×1440.
  Everything in rem follows: brand bar, card, fields, buttons, gaps and the backdrop card geometry
  (`clamp(22rem, …, 34rem)`, gutters). Width-bound and height-bound, so large screens grow evenly
  rather than taller.
- **Tokens are fixed rem**: the values the fluid formulas give at 1592×738, divided by 16 (Login: title
  2.0375rem, fields / buttons 2.75rem, card ≤ 26rem; Register: title 1.86rem, fields 2.5375rem, Google
  2.466rem). No px / viewport terms, so the root alone scales them (`authTokens.test.ts` enforces this).
- **Text floors**: `max(…rem, 12px)` for subtitle, labels, input text, button text and the prompt;
  11px for hints, the eyebrow and "OR" (`--text-xs` ≥ 11px, `--text-sm` ≥ 12px inside `[data-auth]`).
- **Register eyebrow** ("JOIN THE SAF STUDIO") stays visible on ≤ 640px-tall screens here: the hide
  rule in `AuthHeader` now applies only below `lg` or without a fine pointer.
- **Fit check**: `--auth-root` is a registered `<length>` (`@property`), so `useBackdropFits` reads it as
  resolved px (even before `<main data-auth>` mounts) and passes it to `resolveBackdrop` as `rootPx`;
  the JS model uses the same rem as the CSS (it was hard-coded to 16px).
- Not affected: phones and tablets (< 1024px), touch screens ≥ 1024px (16px root, 16px input text so iOS
  never zooms; the laptop / Register layers above), the planner (its own root rule).

Measured (production build, headless Chromium, mouse):

| Viewport          | Root   | Bar  | Login card / title / fields | Register card / title / fields / Google | Scroll |
| ----------------- | ------ | ---- | --------------------------- | --------------------------------------- | ------ |
| 1273×590 (ref.)   | 13px   | 46px | 338×431 / 26.5 / 36px       | 294×520 / 23.8 / 33 / 32px              | none   |
| 1280×600          | 13px   | 46px | 338×431 / 26.5 / 36px       | 301×520 / 24.2 / 33 / 32px              | none   |
| 1280×720          | 13px   | 52px | 338×431 / 26.5 / 36px       | 338×505 / 24.2 / 33 / 32px              | none   |
| 1366×768          | 13.6px | 54px | 354×430 / 27.7 / 37px       | 354×521 / 25.3 / 35 / 34px              | none   |
| 1920×1080         | 17.5px | 83px | 455×547 / 35.6 / 48px       | 455×662 / 32.5 / 44 / 43px              | none   |
| 2560×1440         | 20px   | 95px | 520×626 / 40.8 / 55px       | 520×756 / 37.2 / 51 / 49px              | none   |

Reference targets at 1273×590 (the NEW screenshots): Login card 333×400, title 26, fields 35px;
Register card 292×498, title 23.7, fields 33px. Differences come from the text floors (Login's
subtitle wraps to two lines; labels 12 instead of 10.4px) and the brand bar's short-screen rule
(3.5rem = 46px at ≤ 700px tall, 51px in the reference). No horizontal overflow at any size; 1024×768
(mouse) also scales (Register keeps its image-free layout there).

Background scaling: the image never uses plain `cover` across the window, because the tagline and
captions are baked in and `cover` would crop them at wide aspects (login's text spans ~12–90% of its
height). Instead the box is text-safe and the edge fill extends it. A text-free version of each hero
(ASSETS W2) would allow true full-bleed `cover`.

Verified (Login, Forgot password and Register) with no horizontal overflow, clipping or console errors
at 320×568, 320×640, 375×667, 375×812, 414×896, 768×1024, 844×390, 1024×768, 1024×1366, 1180×820,
1280×720, 1280×800, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1080, 2560×1440 and at 200% zoom (720×450,
960×540).

## Memory Wall Planner (built, Phase 4)

The mockup is a desktop dashboard (≈1536px). As built (`pages/MemoryWallPage.tsx`):

```
┌ BrandBar (full-bleed) ────────────────────────────────────────── avatar ▾ ┐
│ "Curate Your Perfect Wall." + subtitle   │ 01 Wall Setup · 02 · 03 · 04     │  ← hero over header-background
├ Wall Configuration (5) ───────┬ Layout Selection (4) ───┬ Frame Gaps (right) ┤
├ Canvas panel (9): Save · Reset │ ‹ Option n of 3 › │ Regenerate · Redesign · Generate ┬ Frame & Photo ┤
│   wall (aspect = W × H), guides, badges, vector sofa; fit badge + live summary  │ Selection     │
├ Need a little inspiration? (6) ───────────────┬ Preview Settings (3) ────────────┤ (right, 2 rows)│
└──────── action bar: Preview Fullscreen · All Templates · My Saved Templates │ Request a Quote → ┘
```

| Viewport                              | Layout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `< md` (phones)                       | Single column, **canvas first** (DOM order = Moonlight's). Hero: title + step strip that scrolls sideways (snap). Canvas toolbar becomes a **2-column grid** (Save/Reset · Regenerate/Redesign · full-width Generate). Panels are **collapsible** (Moonlight: `collapsible` below 48rem). Fixed bottom bar: Preview / Templates / Saved + **Request a Quote** (labels shrink below 360px). BrandBar: mark h-6, tighter wordmark, chevron hidden below 400px, tagline line from 440px, so "SAGAR ARTS & FRAMES" never truncates at 320px                                                                                                                                                                       |
| `md–lg`                               | 2-column grid: canvas full width, Wall Configuration full width (container-driven: stacked < 36rem, dimensions │ unit with swatches below from 36rem, one row from 56rem), Layout Selection │ Frame Gaps, Inspiration full width, Frame & Photo │ Preview Settings. Toolbar on one row. Desktop action bar (3 actions + full-width quote)                                                                                                                                                                                                                                                                                                                                                        |
| `lg` → 1255px                         | As `md–lg` (stacked)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `desk+` (≥ 1256px, custom breakpoint) | Desktop grid as in the mockup (see diagram): nine fluid columns + a right column `minmax(22rem, 3fr)` (≈ 3 columns, never under 22rem so the frame panel's title and photo row wrap as in the reference). Rows `auto auto 1fr`: when the frame panel (rows 2–3) is taller than canvas + row 3, the spare height goes below row 3, never between the canvas and row 3; row-3 cards hug their content. Hero on one row (title left, steps right, `py-4`). Toolbar on a single row (it wraps rather than overflows as a fallback). Sizes follow the planner density root font (below). Was `xl` (1280px) until the 720p pass: a 1280px window with a classic scrollbar is ≈ 1263px wide and fell back to the stacked layout |
| `2xl+`                                | Same grid, **fluid** (no centred max-width, unlike Moonlight's 100rem cap), `lg:px-12` gutters, so wide windows (1903 → 2560px) have no blank side margins (Phase 4 audit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Planner density (720p pass)

Targets: **1280×720** first (in practice often **1280×≈600**: a 1920×1080 screen at 150 % scaling minus the browser
toolbars), then 1366×768, 1920×1080, 2560×1440.

**Visual reference:** the SAF reference screenshots show the 16px design in a **≈ 1707px-wide** viewport (measured from the
fixed-rem action bar: 1088px × 1.125 on screen vs × 1.5 in the 1280px screenshots). So at 1280px the same layout must render
at ≈ 0.75–0.8 of its 16px size to look like the reference. The components themselves are not oversized; the viewport is
narrower in CSS pixels.

- **Planner root font (`index.css`, `:root:has([data-planner])`).** Every planner size is rem-based (text, icons, controls,
  spacing, brand bar, `--bar-h`), so one value scales the whole page in proportion. Set on `:root`, so dialogs and toasts
  follow; other pages never match the selector.

  | Viewport                                                                                  | Rule                                                           | Root                                                                                                                        |
  | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
  | `desk+` with a mouse/trackpad (`pointer: fine`)                                           | `clamp(13px, min(0.7026vw + 4px, 1.5vh + 4px), 20px)`          | 13px at 1280×600 / 1280×720, 13.6px at 1366×768, **16px at 1707×800 (= reference)**, 17.5px at 1920×1080, 20px at 2560×1440 |
  | Everything else: < 1256px, and touch screens (`pointer: coarse`, e.g. iPad Pro landscape) | `clamp(16px, min(0.3571vw + 10.857px, 0.5556vh + 12px), 20px)` | 16px (grows only above 1440×720)                                                                                            |

  Width term: linear, 13px at 1280 → 16px at 1707. Height term: 13px at 600px tall → 16px at 800px, so short or ultrawide
  screens don't grow taller. Media and breakpoints are unaffected (media-query rem = initial 16px).

- **Text floors (planner, `desk` + fine pointer only):** `--text-xs: max(0.75rem, 11px)`, `--text-sm: max(0.875rem, 12px)`.
  Touch screens keep the 16px root, so input text stays at its normal size and iOS never zooms.
- **Planner sizing exception to the global rules:** at a 13px root, planner controls are **≈ 29–36px** tall (`h-9` → 29px,
  `h-10` → 32.5px, `h-11` → 36px) instead of 40–52px, and body text 12–13px. It is a mouse/trackpad-only desktop density
  (touch screens keep 16px). Proportionally it's the same as the reference.
- **Compact from `desk`:** cards `p-4` with 12px header and body gaps (was 20 / 16px), page `py-4`, Wall Configuration puts
  dimensions │ unit on one row from a 26rem card (was 36rem). Hero title `3.25rem` and subtitle `text-lg` (the reference's
  sizes, scaled by the root font). The canvas panel (toolbar + wall + status) fits one screen:
  `maxHeight: min(max(62vh, 100dvh − --bar-h − 10rem), 52rem)`.
- **No visible page scrollbar** on the planner (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }` on the
  root, not `overflow: hidden`): wheel, touchpad, keyboard and touch scrolling are unchanged.
- Gutters stay `lg:px-12` (scaled by the root font) and the brand bar is untouched; the earlier 1256–1535px gutter and toolbar
  tightening were removed once the root font made room (toolbar needs ≈ 730px of 878px at 1280).

Measured (production build, headless Chromium):

| Viewport             | Root   | Bar | Hero | Gap canvas → row 3 | Frame title lines | Toolbar (needed / available) | Page height |
| -------------------- | ------ | --- | ---- | ------------------ | ----------------- | ---------------------------- | ----------- |
| 1256×700             | 13px   | 46  | 113  | 13 (grid gap)      | 2                 | 730 / 854                    | 1310        |
| 1280×600             | 13px   | 46  | 113  | 13                 | 2                 | 730 / 878                    | 1212        |
| 1280×720             | 13px   | 52  | 113  | 13                 | 2                 | 730 / 878                    | 1332        |
| 1366×768             | 13.6px | 54  | 103  | 14                 | 2                 | 744 / 946                    | 1390        |
| 1707×800 (reference) | 16px   | 64  | 122  | 16                 | 2                 | 866 / 1198                   | 1534        |
| 1920×1080            | 17.5px | 83  | 133  | 17                 | 2                 | 944 / 1351                   | 1885        |
| 2560×1440            | 20px   | 95  | 152  | 20                 | 1                 | 1076 / 1818                  | 2280        |
| 1366×1024 touch      | 16px   | 76  | 149  | 16                 | 2                 | 866 / 872                    | 1655        |

No horizontal overflow and no control spilling out of its card at any of them. Text floors hold (text-xs 11px, text-sm 12px
at 1280).

Canvas: the wall keeps its W × H aspect ratio (`maxHeight`: see "Planner density") and sits on a **room stage**
(`CanvasStage`: the room photo tinted by the paint colour, blurred), so the panel never shows blank strips beside
an aspect-locked wall (Phase 4 audit). Guides, eye-level line
and badges are % overlays, so they track every recalculation. The SAF room photo is multiplied over the
paint colour; the 84″ sofa is a to-scale vector at the geometry's sofa line. The page root has
`overflow-x: clip`.

Frame chips wrap onto a second row when the panel is narrow (Moonlight behaviour; it uses `flex-wrap`).

Verified (Phase 4 audit): no horizontal overflow, clipping, element collisions or console errors on every
route at 22 widths (320 → 2560, incl. layout switch points) with classic scrollbars; page side margins 0
and canvas-panel strips ≤ 15px at 1280 → 2560; planner behaviour 33/33 + all 13 remaining §H checks; rotation
portrait ↔ landscape keeps the arrangement and never scrolls sideways.

**No horizontal scroll, guaranteed:** the auth shell and the planner page have `overflow-x: clip` (not `hidden`, which would
break the sticky brand bar and backdrop), so no decorative layer can ever create a horizontal scrollbar.

## Testing checklist per screen (same as Moonlight)

Check at **320, 375, 414, 768, 1024, 1280, 1366×768, 1440, 1536, 1920**. Phones in portrait and
landscape. 200% browser zoom. Keyboard-only navigation. Windows forced-colors mode.

**Also test with classic (always-visible) scrollbars** and common desktop window sizes, not just
device presets: maximised 1080p browser (≈ 1903×917 / 1903×937) and Windows display scaling 125%
(≈ 1522×733 CSS px). Headless Chromium hides scrollbars by default, so launch it without
`--hide-scrollbars`. A wide-window blank-margin issue on Register was missed until this was added.
