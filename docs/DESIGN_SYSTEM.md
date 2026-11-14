# Design System: SAF Studio (Sagar Arts & Frames)

Brand palette derived directly from the official logo asset [`logo-mark.svg`](../frontend/src/assets/images/logo-mark.svg) (`#A06F37` saddle brown and `#F2A428` radiant gold).
Centralized color tokens live in [`frontend/src/styles/colors.css`](../frontend/src/styles/colors.css) and are imported into [`frontend/src/styles/theme.css`](../frontend/src/styles/theme.css) as a Tailwind v4 `@theme` block. Every token becomes a utility automatically (`--color-brand-600` → `bg-brand-600`, `--color-ink-900` → `text-ink-900`).

**Rule:** don't hard-code hex values or arbitrary pixel values in components. Colors must reference centralized tokens in `colors.css`.

## Design direction

**Warm artisan luxury, gallery-modern.** Grounded in bespoke framing craftsmanship, natural timber mouldings, and radiant gilded accents.
Warm saddle artisan brown is the primary action colour, radiant amber gold provides illuminating highlights and active selection indicators, and dark roasted espresso carries heavy, tightly-tracked headlines—avoiding pure black (`#000000`) for typography. Backgrounds use warm archival alabaster and linen surfaces rather than cold icy blues.

| Moonlight (do **not** copy)                     | SAF Studio (Warm Artisan Luxury)                                  |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Warm heritage: cream paper, crimson, serif      | Warm atelier luxury: alabaster/linen, saddle brown, gold, sans    |
| Logo + EST. tag inside the form column          | Full-width white **brand bar** with logo lockup on every screen   |
| Hero photo left, form right (both auth screens) | Login: card **left**, art right. Register: art left, card right   |
| Corner waves and leaf ornaments                 | Vertical caption stacks, thin hairlines, gold rules, linen blocks |
| Numbered step cards ①–④ in the planner          | Hero headline + 4-step strip, and panels with plain titles        |

## Colour

All colors are centralized in [`frontend/src/styles/colors.css`](../frontend/src/styles/colors.css).

| Token                   | Hex                   | Role / Origin                  | Use                                                                                       |
| ----------------------- | --------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `brand-600`             | `#8A5A2B`             | Warm Saddle Artisan Brown      | Primary action buttons (Sign In / Create Account / Request a Quote), active segment, chip |
| `brand-500`             | `#A06F37`             | **Exact Logo Monogram Brown**  | Brand identity mark, decorative brand tint                                                |
| `brand-700`             | `#70481F`             | Burnished Walnut (darker step) | Hover; **link + eyebrow text** (8.3:1 contrast on white)                                  |
| `brand-800`             | `#583716`             | Dark Chocolate Timber          | Pressed / active button state                                                             |
| `brand-50/100`          | `#FBF5EE`/`#F5E9DA`   | Biscuit Tints                  | Selected tile and chip tint backgrounds                                                   |
| `brand-400`             | `#C99863`             | Caramel Midtone                | Decorative accents                                                                        |
| `gold-400`              | `#F2A428`             | **Exact Logo Gilded Gold**     | Frame ornaments, hairline rules, active frame selection ring in canvas                    |
| `gold-500`              | `#DC8F15`             | Amber Gold (hover)             | Gold hover states                                                                         |
| `gold-600`              | `#8C5908`             | Antique Bronze Gold            | Gold **text** when placed on white/light backgrounds (5.3:1)                              |
| `gold-100`              | `#FEF6E9`             | Champagne Tint                 | Warning / highlight badge backgrounds                                                     |
| `ink-900`               | `#231709`             | Dark Roasted Espresso          | Display headings, BrandBar wordmark, prominent prices (zero pure black)                   |
| `ink-800`               | `#322214`             | Deep Walnut                    | Field labels, panel titles                                                                |
| `ink-700`               | `#4A3525`             | Warm Saddle Bark               | Body text                                                                                 |
| `ink-600`               | `#6B533E`             | Warm Umber                     | Subtitles; secondary text on linen surfaces                                               |
| `ink-500`               | `#856F59`             | Soft Sepia                     | Helper text, placeholders, icons (4.76:1 on white)                                        |
| `ink-400`               | `#9E8C7A`             | Warm Stone Slate               | **Form-field borders**, Switch off-border (3.24:1, WCAG 1.4.11)                           |
| `ink-300`               | `#C4B5A5`             | Pale Clay                      | Disabled text & borders                                                                   |
| `surface`               | `#FFFFFF`             | Pure White                     | Cards, inputs, brand bar, modal dialogs                                                   |
| `mist-50`               | `#FAF7F2`             | Studio Archival Alabaster      | Page background (replaces cold icy cyan)                                                  |
| `mist-100`              | `#F3EDE4`             | Natural Warm Linen             | Planner configuration panel backgrounds                                                   |
| `mist-200`              | `#E8DFCF`             | Sandstone Tint                 | Hover / subtle fills, step-icon discs                                                     |
| `mist-300` / `sage-200` | `#D8CDBA` / `#E2DBCD` | Warm Biscuit Blocks            | Decorative colour blocks behind art                                                       |
| `line`                  | `#E8DFD5`             | Warm Parchment Hairline        | Card borders, dividers (**not** field boundaries)                                         |
| `success-600`           | `#286A34`             | Forest Olive                   | Positive status, "Frame Selected" badge                                                   |
| `success-50`            | `#F0F6F1`             | Sage Tint                      | Success banner background                                                                 |
| `danger-600`            | `#B83535`             | Brick Carmine                  | Destructive actions, field errors, error borders                                          |
| `danger-700`            | `#942525`             | Crimson Alert                  | Error **text on `danger-50` tints** (Alert): 6.38:1                                       |
| `danger-50`             | `#FDF2F2`             | Blush Tint                     | Error banner background                                                                   |

### Contrast (computed, WCAG 2.2)

| Pair                                  | Ratio       | Result                    |
| ------------------------------------- | ----------- | ------------------------- |
| ink-900 heading on white              | 17.5        | ✅ AAA                    |
| white on brand-600 button             | 5.87        | ✅ AA body text           |
| brand-700 link / eyebrow on white     | 8.31        | ✅ AAA                    |
| ink-600 subtitle on white / mist-100  | 7.15 / 6.27 | ✅ AAA / AA               |
| ink-500 placeholder on white          | 4.76        | ✅ AA                     |
| ink-400 field border on white         | 3.24        | ✅ non-text (WCAG 1.4.11) |
| danger-600 on white                   | 5.34        | ✅ AA                     |
| danger-700 on danger-50 (Alert error) | 6.38        | ✅ AAA                    |
| gold-600 on white                     | 5.30        | ✅ AA                     |
| ink-400 Switch off-state border       | 3.24        | ✅ non-text               |
| success-600 on white                  | 5.42        | ✅ AA                     |
| brand-600 on surface (non-text UI)    | 3.58        | ✅ non-text               |
| danger-600 on surface (error border)  | 3.93        | ✅ non-text               |

**Enforced by a test:** [`src/styles/contrast.test.ts`](../frontend/src/styles/contrast.test.ts) computes these
ratios from `colors.css` itself. A token edit that breaks AA fails `npm run check`.

## Typography

One self-hosted family, **Plus Jakarta Sans Variable** (`@fontsource-variable/plus-jakarta-sans`,
weights 200–800). Its ExtraBold matches the heavy geometric headlines. It replaces Moonlight's
Playfair Display + DM Sans pair.

| Role                    | Classes                                                                | Mockup example                               |
| ----------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| Display title           | `font-display font-extrabold tracking-display text-4xl lg:text-5xl`    | "Welcome Back.", "Curate Your Perfect Wall." |
| Hero tagline            | `font-display font-extrabold tracking-display text-2xl lg:text-4xl`    | "Your space. Your art. Your story."          |
| Panel title             | `text-base font-bold text-ink-800`                                     | "Wall Configuration", "Frame Gaps"           |
| Eyebrow                 | `text-xs font-bold uppercase tracking-eyebrow text-brand-700`          | "YOUR CREATIVE SPACE"                        |
| Side caption stack      | `text-[0.6875rem] font-medium uppercase tracking-caption text-ink-500` | "ART / FRAMES / PRINTS / WALL DECOR"         |
| Subtitle / body         | `text-base lg:text-lg text-ink-600`                                    | "Sign in to continue designing…"             |
| Field label             | `text-sm font-semibold text-ink-800`                                   | "Mobile No. or Email"                        |
| Control label (planner) | `text-xs sm:text-sm text-ink-600`                                      | "Wall Width", "Paint Shade"                  |
| Price                   | `text-2xl font-extrabold text-ink-900`                                 | "₹ 18,500"                                   |

Headline copy ends with a full stop wherever the mockups show one. That is a brand voice rule.

**Logo & wordmark.** The delivered `logo.svg` is a **stacked** lockup (brown/gold "SAF" monogram above
a sans "SAGAR ARTS & FRAMES"), while the mockups show a horizontal one. `BrandBar` therefore pairs the
derived monogram (`logo-mark.svg`) with a **live-text wordmark**: `APP_NAME` in medium weight, uppercase,
`tracking-[0.14em]`, `ink-900`, plus "CUSTOM ART. TIMELESS FRAMES." in `tracking-caption`, `ink-500`.
The logo's own wordmark is a light sans, so no serif font is loaded.

## Shape, depth, spacing

- **Radius:** inputs, buttons, tiles `rounded-field` (8px); auth card and planner panels
  `rounded-card` (16px); swatches, toggles and avatar `rounded-full`.
- **Shadow** (cool navy tint, never neutral grey): auth card `shadow-float`; panels and action bar
  `shadow-card`; inputs `shadow-field`; primary CTA `shadow-button`.
- **Field height:** `--field-h` (48px, 52px from `sm`). On auth pages it's fluid, 40px (phones, short
  laptops) → 52px (the mockup, ≥ 1440×900), with the rest of the auth type and spacing
  (RESPONSIVE.md, "Fluid sizing").
- **Hairlines:** 1px `line` dividers; vertical 1px `ink-500/40` rules beside caption stacks;
  40×2px `gold-400` rule above taglines.
- **Spacing:** Tailwind's 4px scale. Auth form gaps are fluid tokens (`--auth-form-gap` 12 → 20px, label→input 6 → 8px), planner
  panels `p-4 lg:p-5`, grid gaps `gap-4`.

## Moonlight → SAF token map (for porting class strings)

When porting a Moonlight component, keep its JSX/logic and swap tokens with this table. Then adjust
layout to the SAF mockup.

| Moonlight            | SAF (Warm Artisan Luxury)                      | Notes                                       |
| -------------------- | ---------------------------------------------- | ------------------------------------------- |
| `brand-*` (crimson)  | `brand-*` (warm saddle brown)                  | Same name, same role, warm artisan hue      |
| `gold-*`             | `gold-*`                                       | Same role (radiant gold ornament/accent)    |
| `cream-50`           | `surface`                                      | Cards/inputs are pure white in SAF          |
| `cream-100`          | `mist-50`                                      | Archival alabaster page background          |
| `cream-200`          | `mist-100`                                     | Warm linen panels / segmented track         |
| `cream-300/400`      | `line` / `ink-300`                             | Decorative borders                          |
| `cream-600` (fields) | `ink-400`                                      | Field boundary (3:1)                        |
| `ink-900/700/500`    | `ink-900/700/600`                              | Dark espresso / saddle bark (no pure black) |
| `success-500`        | `success-600`                                  | Forest olive status                         |
| `danger-600`         | `danger-600`                                   | Brick carmine status                        |
| `font-display` serif | `font-display font-extrabold tracking-display` | Different weight + tracking                 |
| `rounded-field` 10px | `rounded-field` 8px                            | Same token name                             |

## Component inventory (from the SAF mockups)

Generic primitives live in `components/ui/` under the **same names and props as Moonlight**, so feature
code ports unchanged. All were ported on 2026-11-06 (✅), and Moonlight's `Toaster` and `RegisterForm`
tests pass against them unchanged.

| Component          | SAF appearance (as built)                                                                                                                                     | Used in           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `Button`           | `primary` solid warm saddle brown; `primary-gradient` saddle-to-walnut gradient (auth CTAs) + trailing `→` via `rightIcon`; `secondary` white + `line` border | All               |
| `TextField`        | white, 1px `ink-400` boundary, slate outline icon left, 8px radius, 48 → 52px (`sm`), teal focus ring                                                         | Login, Register   |
| `PasswordField`    | lock-keyhole icon + eye toggle (open eye while hidden, as in the mockup)                                                                                      | Login, Register   |
| `PhoneField`       | phone icon · fixed `+91` · hairline · number (no chevron: D23 → Moonlight)                                                                                    | Register          |
| `Divider`          | `line` hairlines with centred teal "OR" in tracked caps                                                                                                       | Login, Register   |
| `TextLink`         | `brand-700`, underlined                                                                                                                                       | All               |
| `SegmentedControl` | joined white track; active = solid teal pill, white text                                                                                                      | Planner           |
| `Switch`           | teal pill toggle, grey when off                                                                                                                               | Planner           |
| `NumberStepper`    | boxed `[−] value [+]`                                                                                                                                         | Frame Gaps, Mat   |
| `Select`           | white box, chevron right                                                                                                                                      | Frame Size, units |
| `SwatchPicker`     | circles, selected = teal ring on white; `textured` radial shading for wood (R2: Moonlight's flat-hex finishes)                                                | Planner           |
| `Badge`            | small pills (`new`, `neutral`, `success`, `warning`, `brand`)                                                                                                 | Planner           |
| `IconButton`       | square-cornered (`rounded-field`) ghost / outline / solid / glass                                                                                             | Planner, dialogs  |
| `Dialog`           | white card, 16px radius, `shadow-float`, extrabold title, mist footer                                                                                         | Planner dialogs   |
| `Alert`            | info = mist + teal icon; error = `danger-*`; success = `success-*`                                                                                            | Auth, planner     |
| `Toaster`          | navy toast, teal-light action, white text                                                                                                                     | Planner           |
| `Logo`             | `variant="full"` (stacked, as delivered) or `"mark"` (monogram)                                                                                               | Brand bar         |
| `Spinner`          | logic-only                                                                                                                                                    | Buttons, loader   |

SAF-specific composites (new presentation, existing behaviour):

- **`BrandBar`** ✅: sticky white bar with a bottom hairline. Monogram, hairline, then the live-text
  wordmark. Height is the `--bar-h` variable. Full-bleed on every page (no centred cap, so no blank edges on wide windows);
  the `actions` slot holds the planner's profile menu.
- **`CaptionStack`** ✅: vertical uppercase caption list with a left hairline and optional `/ 01` index
  (auth page edges on image-free layouts). Decorative, `aria-hidden`.
- **`AuthTagline`** ✅: gold rule, extrabold tagline, subtitle and an inline-SVG mini-gallery drawn
  in brand tokens. Shown only where the backdrop (which has the tagline baked in) isn't.
- **`StepStrip`**: planner hero steps 01–04 (icon disc, number, title, one-line description).
- **Layout tiles**: `SegmentedControl variant="tiles"` + `LayoutStyleIcon` (Grid / Salon / Centre / Row), selected = teal border + tint.
- **Inspiration cards** (inline in `AiAssistantPanel`): room-photo thumbnail + caption. Selected = teal border + tint.
- **`CanvasStage`**: the wall canvas sits on the room photo, tinted by the paint colour and blurred, so wide panels show the room instead of blank strips.

## Iconography

Thin outline icons (user, lock, mail, phone, eye, arrow-right, download, expand, layout-grid,
bookmark, refresh, wand, upload, trash, chevrons). Use **`lucide-react`**, already installed and the
same as Moonlight, imported per icon. Layout-style tiles (Grid/Salon/Centre/Row) use small custom
line icons, either SVGs in `assets/icons/` or composed lucide shapes.

## Motion

Same rules as Moonlight: 150–200ms colour/shadow transitions; subtle lift on hover for tiles; a
fade or slide for the canvas carousel; dialogs use `dialog-in`, toasts `toast-in`. Everything is
disabled under `prefers-reduced-motion` (global rule in `index.css`).

## Accessibility baseline (unchanged from Moonlight)

- Every input has a visible `<label>`. Icons inside fields are `aria-hidden`.
- Global `:focus-visible` teal outline. Inputs show a teal ring on their wrapper and a real outline under
  `forced-colors`.
- Touch targets ≥ 24px (WCAG 2.5.8). Standalone small links get `py-2 -my-2`.
- Swatches and segmented controls are radio groups. Toggles expose state with `aria-pressed` /
  `role="switch"`.
- Decorative art, caption stacks and colour blocks use `alt=""` / `aria-hidden`.
