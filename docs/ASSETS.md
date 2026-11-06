# Assets

Assets were added manually after Phase 0 and **verified on 2026-11-06** (below). This doc is the
inventory, the rules from Moonlight that still apply, and what is still missing.

## Rules (unchanged from Moonlight)

1. **Images/SVGs used by components → `frontend/src/assets/`.** Vite fingerprints them, and a broken
   path fails the build instead of production.
2. **Components never import image files.** They import from the area manifest
   ([`brand.ts`](../frontend/src/assets/brand.ts), [`auth.ts`](../frontend/src/assets/auth.ts),
   [`memoryWall.ts`](../frontend/src/assets/memoryWall.ts)), which records size, alt text and
   `srcSet`. Types are in `assets/types.ts`.
3. **Raster images go through `vite-imagetools`** via query strings in the manifest (WebP + srcset).
   Sources are never modified. Example: `login.png` (1.7 MB) ships as 40–78 KB WebP.
4. **`frontend/public/`** is only for fixed-URL files: favicon, apple-touch-icon, OG image, robots.txt.
5. **Naming:** `kebab-case`. Decorative files render with `alt=""` + `aria-hidden`.
6. Manifest **export names and shapes match Moonlight's** (`brandAssets.logo`, `iconAssets.google`,
   `samplePhotos`, `memoryWallAssets.roomBackground`, `memoryWallAssets.layoutThumbnails.*`), so
   ported feature code needs no changes. The one deliberate difference: auth uses
   `authAssets.<screen>.backdrop` (an `AuthBackdropAsset`) because SAF's art is full-page.

## Folder layout (as delivered)

```
frontend/src/assets/
├── types.ts            ImageAsset, HeroImageAsset, SamplePhotoAsset, AuthBackdropAsset (SAF)
├── brand.ts  auth.ts  memoryWall.ts      manifests (the only importers of image files)
├── icons/
│   └── google-g.svg                     official Google "G" (added: was missing, see below)
└── images/
    ├── logo.svg                         delivered vector lockup (stacked)
    ├── logo-mark.svg                    DERIVED: monogram only (viewBox crop of logo.svg)
    ├── login/login.png                  full-page backdrop
    ├── register/register.png            full-page backdrop
    └── memory-wall/                     ← delivered as `memory-wall` (kebab-case), kept
        ├── memory-wall.png              empty room for the canvas
        ├── header-background.png        planner hero strip (RENAMED, see below)
        ├── frames/01.png … 15.png       sample photos
        └── layouts/{balanced-grid,centre-focus,creative-salon,minimal-row}.webp
```

Phase 0 docs proposed `memory_wall/` (Moonlight's spelling). The delivered `memory-wall/` matches the
kebab-case rule and the `features/memory-wall` folder, so it was kept. Only the manifests reference
these paths.

## Inventory & verification (2026-11-06)

Checked against the 15 required items from Phase 0 and the reference designs. Dimensions were read with
`sharp`, and every image was opened and viewed.

| #   | Required (Phase 0)                    | Delivered                                              | Verdict | Notes |
| --- | ------------------------------------- | ------------------------------------------------------ | ------- | ----- |
| A1  | `images/logo.svg` (vector lockup)     | `images/logo.svg` 890×505, 28 KB                       | ✅ Good  | True vector. **Stacked** (monogram above wordmark), while the mockup bar is horizontal. The BrandBar composes the mark plus a live-text wordmark |
| A2  | `images/logo-mark.svg`                | —                                                      | ✅ Derived | Created from `logo.svg` by a viewBox crop (no redrawing). Also used for `public/favicon.svg`. Regenerate both if the logo changes |
| A3  | `icons/google-g.svg`                  | — (`icons/` was empty)                                 | ✅ Added | Copied the official four-colour Google mark (Google's asset, identical in Moonlight). Not a Moonlight design element |
| A4  | Login hero art, no text               | `login/login.png` 1585×992, 1.7 MB                     | 🟡 Usable | **Full-page backdrop** (art + left scene in one image) with the **tagline and side captions baked in**. Handled like Moonlight's W2: text in `alt`, never overlaid, card positioned by `backdropLayout.ts`. 1585px is soft on 2× displays |
| A5  | Login left scene                      | merged into A4                                         | ✅       | — |
| A6  | Register hero art, no text            | `register/register.png` 1672×941, 1.9 MB               | 🟡 Usable | Same as A4 (baked tagline + 01/02/03 steps). Measured in Phase 3: art ends x≈990, window decor from x≈1570, framed art from y≈4.5%, steps' glyphs end ~2.5% above the bottom, so `maxAspect` 1.8 + `objectPosition` y 60%. At 4:3 the empty side is too narrow for the card, so the image-free layout is used |
| A7  | Register foreground plants            | merged into A6                                         | ✅       | — |
| A8  | Planner empty room                    | `memory-wall/memory-wall.png` 1860×846                 | ✅ Good  | Window + plant left, arches + slats right, empty wall. No reference object of known width yet, so the scale is set in Phase 4 |
| A9  | 84″ sofa cut-out (transparent)        | —                                                      | 🟡 Covered in code | Not delivered. Phase 4 draws the reference sofa as a **to-scale vector** (84″ wide, top at the geometry's `sofaTopY`, from Moonlight's `ROOM_PHOTO` model: a low ~14.6″ profile), so the toggle works and stays exportable. A photographic cut-out would still look richer; if delivered, its height must match that model |
| A10 | Sample photos `frame-NN`              | `frames/01.png … 15.png`, 1122×1402, 2.1–3.4 MB each   | ✅ Good  | 15 photos (Moonlight had 10). **All portrait**: no landscape sample, so `sampleFor` falls back to portrait photos for landscape frames. Manifest ids stay `frame-01…15`. Re-encoded to ≤ 640px WebP |
| A11 | 4 inspiration thumbnails              | `layouts/*.webp` ~750×423                              | ✅ Good  | Names without Moonlight's `ai-` prefix (fine) |
| A12 | Wood finish textures                  | —                                                      | ➖ N/A   | Not needed: **R2** keeps Moonlight's flat-hex finishes |
| A13 | Layout-style icons                    | —                                                      | ✅ In code | `LayoutStyleIcon` draws the Grid / Salon / Centre / Row schematics as inline SVG |
| A14 | Planner header plants                 | `memory-wall/Modern Sunlit Interior with Greenery.png` | ✅ Renamed | Renamed to **`header-background.png`** (spaces and capitals broke the naming rule). 2172×197 with alpha |
| A15 | apple-touch-icon, OG image            | —                                                      | ⚪ Missing | Pre-launch. Can be generated from `logo-mark.svg` |

### Summary of changes made

- **Renamed:** `Modern Sunlit Interior with Greenery.png` → `header-background.png`.
- **Added:** `icons/google-g.svg` (official Google mark).
- **Derived:** `images/logo-mark.svg` and `public/favicon.svg`, both from `logo.svg`.
- **Replaced placeholders:** temporary favicon → real monogram; Logo → `logo.svg`/`logo-mark.svg`;
  login/register art → backdrops; planner images registered in `memoryWall.ts`.

### Still needed

1. 🟡 **84″ sofa cut-out** (A9): optional now (vector fallback in place); must match the ~14.6″ sofa model if delivered.
2. 🟡 **Higher-resolution backdrops** (≥ 2400px wide) for crisp 2× laptops. Ideally text-free too, so taglines can become live text everywhere.
3. ⚪ One **landscape** sample photo (better Portrait/Landscape demo).
4. ⚪ apple-touch-icon (180×180) and OG image (1200×630).
