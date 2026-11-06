# Design System: SAF Studio (Sagar Arts & Frames)

Derived **only** from [`reference-designs/`](../reference-designs) (`login.png`, `register.png`,
`memory-wall-design.png`). Colours were sampled pixel by pixel from those files, not estimated by eye.
Never take visual decisions from Moonlight's designs or components. Moonlight only provides the
_behaviour_ (see [PORTING_PARITY.md](PORTING_PARITY.md)).

Tokens live in [`frontend/src/styles/theme.css`](../frontend/src/styles/theme.css) as a Tailwind v4
`@theme` block. Each token becomes a utility automatically (`--color-brand-600` → `bg-brand-600`).

**Rule:** don't hard-code hex values or arbitrary pixel values in components. If a value is missing,
add a token to `theme.css` and record it here.

## Design direction

**Bright, airy, gallery-modern.** A sunlit white room with soft mint and powder-blue colour blocks.
Teal is the single strong action colour, warm gold/wood appears as fine accents (short rules,
frame mouldings), and deep navy carries heavy, tightly-tracked sans-serif headlines that end in a
full stop ("Welcome Back.", "Curate Your Perfect Wall."). White cards float over photographic
scenes. Small uppercase captions with wide letter-spacing frame the page edges like gallery
labels. The art and photography carry the emotion while the chrome stays clean and cool.

| Moonlight (do **not** copy)                     | SAF Studio                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Warm heritage: cream paper, crimson, serif      | Cool modern: white/mist, teal, heavy geometric sans               |
| Logo + EST. tag inside the form column          | Full-width white **brand bar** with logo lockup on every screen   |
| Hero photo left, form right (both auth screens) | Login: card **left**, art right. Register: art left, card right   |
| Corner waves and leaf ornaments                 | Vertical caption stacks, thin hairlines, gold rules, mint blocks  |
| Numbered step cards ①–④ in the planner          | Hero headline + 4-step strip, and panels with plain titles        |

## Colour

| Token                    | Hex       | Sampled from                    | Use                                                                    |
| ------------------------ | --------- | ------------------------------- | ---------------------------------------------------------------------- |
| `brand-600`              | `#0F7C82` | Sign In / Create Account fill   | Primary buttons, active segment, toggles on, selected chip             |
| `brand-500`              | `#1E8F90` | Sign In gradient left edge      | **Decorative only**: white text on it is 3.9:1. The CTA gradient runs `brand-600 → brand-700` |
| `brand-700`              | `#0B656B` | (darker step)                   | Hover; **link + eyebrow text** (mockup's lighter teal fails AA)        |
| `brand-800`              | `#0C5257` | "Forgot Password?" darkest ink  | Pressed                                                                |
| `brand-50/100`           | —         | selected tile tint              | Selected-state backgrounds                                             |
| `brand-400`              | `#45A7A6` | eyebrow "JOIN THE SAF STUDIO"   | Decorative only (2.9:1, never text)                                    |
| `gold-400`               | `#C29A5F` | short rules above taglines      | Hairline rules, ornaments (non-text)                                   |
| `gold-600`               | `#8A6230` | (darker step)                   | Gold **text** if ever needed                                           |
| `ink-900`                | `#0B1D33` | "Welcome Back." / taglines      | Display headings, prices                                               |
| `ink-800`                | `#1C2A40` | field labels                    | Labels, panel titles                                                   |
| `ink-700`                | `#334155` | —                               | Body text                                                              |
| `ink-600`                | `#5B6981` | subtitles                       | Subtitles; any secondary text on mist surfaces                         |
| `ink-500`                | `#64748B` | input icons, side captions      | Helper text, placeholders, icons (**on white only**)                   |
| `ink-400`                | `#8592A4` | placeholder ink                 | **Form-field borders** (3.2:1, WCAG 1.4.11)                            |
| `surface`                | `#FFFFFF` | card, header                    | Cards, inputs, brand bar, action bar                                   |
| `mist-50`                | `#F8FCFD` | planner page                    | Page background                                                        |
| `mist-100`               | `#EEF6F8` | planner config panels           | Panel backgrounds                                                      |
| `mist-200`               | `#DCEBEF` | step-icon discs                 | Subtle fills, hover                                                    |
| `mist-300` / `sage-200`  | `#C3DCE1` / `#CFE3DD` | arcs / mint blocks  | Decorative colour blocks behind art                                    |
| `line`                   | `#E1E7EE` | input outline, OR divider       | Card borders, dividers (**not** field boundaries)                      |
| `success-600`            | `#1E7F34` | "Frame #1 Selected" dot         | Positive status                                                        |
| `danger-600`             | `#C73947` | "Remove" button                 | Destructive actions, field errors, error borders                       |
| `danger-700`             | `#A42C38` | (darker step)                   | Error **text on `danger-50` tints** (Alert): 6.1:1                     |

### Contrast (computed, WCAG 2.2)

| Pair                                   | Ratio | Result                                |
| -------------------------------------- | ----- | ------------------------------------- |
| ink-900 heading on white               | 17.0  | ✅                                    |
| white on brand-600 button              | 5.0   | ✅ AA body text                       |
| brand-700 link / eyebrow on white      | 6.8   | ✅                                    |
| ink-600 subtitle on white / mist-100   | 5.5 / 5.1 | ✅                                |
| ink-500 placeholder on white           | 4.75  | ✅ (fails on mist-100: use ink-600)   |
| ink-400 field border on white          | 3.2   | ✅ non-text                           |
| danger-600 on white                    | 5.1   | ✅                                    |
| danger-700 on danger-50 (Alert error)  | 6.1   | ✅ (danger-600 there is 4.49 ❌)      |
| white on brand-500                     | 3.9   | ❌ never put text on brand-500        |
| ink-400 Switch off-state border        | 3.2   | ✅ non-text (ink-300 was 1.9 ❌)      |
| success-600 on white                   | 4.9   | ✅                                    |
| brand-400 (mockup eyebrow teal)        | 2.9   | ❌ decorative only                    |
| mockup input border `#DBE1EA`          | 1.3   | ❌ replaced by ink-400                |
| mockup placeholder `#8591A4`           | 3.2   | ❌ replaced by ink-500                |

The ❌ rows are deliberate, documented deviations from the mockup, made for accessibility (the mockup's
CTA gradient, eyebrow teal, input border and placeholder all fail). Moonlight's audit made the same kind of fix.

**Enforced by a test:** [`src/styles/contrast.test.ts`](../frontend/src/styles/contrast.test.ts) computes these
ratios from `theme.css` itself. A token edit that breaks AA fails `npm run check`. Add a row there when you
introduce a new text/background pairing.

## Typography

One self-hosted family, **Plus Jakarta Sans Variable** (`@fontsource-variable/plus-jakarta-sans`,
weights 200–800). Its ExtraBold matches the heavy geometric headlines. It replaces Moonlight's
Playfair Display + DM Sans pair.

| Role                       | Classes                                                                  | Mockup example                          |
| -------------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| Display title              | `font-display font-extrabold tracking-display text-4xl lg:text-5xl`      | "Welcome Back.", "Curate Your Perfect Wall." |
| Hero tagline               | `font-display font-extrabold tracking-display text-2xl lg:text-4xl`      | "Your space. Your art. Your story."     |
| Panel title                | `text-base font-bold text-ink-800`                                       | "Wall Configuration", "Frame Gaps"      |
| Eyebrow                    | `text-xs font-bold uppercase tracking-eyebrow text-brand-700`            | "YOUR CREATIVE SPACE"                   |
| Side caption stack         | `text-[0.6875rem] font-medium uppercase tracking-caption text-ink-500`   | "ART / FRAMES / PRINTS / WALL DECOR"    |
| Subtitle / body            | `text-base lg:text-lg text-ink-600`                                      | "Sign in to continue designing…"        |
| Field label                | `text-sm font-semibold text-ink-800`                                     | "Mobile No. or Email"                   |
| Control label (planner)    | `text-xs sm:text-sm text-ink-600`                                        | "Wall Width", "Paint Shade"             |
| Price                      | `text-2xl font-extrabold text-ink-900`                                   | "₹ 18,500"                              |

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

| Moonlight            | SAF                            | Notes                                       |
| -------------------- | ------------------------------ | ------------------------------------------- |
| `brand-*` (crimson)  | `brand-*` (teal)               | Same name, same role, new hue               |
| `gold-*`             | `gold-*`                       | Same role (ornament)                        |
| `cream-50`           | `surface`                      | Cards/inputs are pure white in SAF          |
| `cream-100`          | `mist-50`                      | Page background                             |
| `cream-200`          | `mist-100`                     | Subtle panels / segmented track             |
| `cream-300/400`      | `line` / `ink-300`             | Decorative borders                          |
| `cream-600` (fields) | `ink-400`                      | Field boundary (3:1)                        |
| `ink-900/700/500`    | `ink-900/700/600`              | Use `ink-500` only on white                 |
| `success-500`        | `success-600`                  |                                             |
| `danger-600`         | `danger-600`                   |                                             |
| `font-display` serif | `font-display font-extrabold tracking-display` | Different weight + tracking |
| `rounded-field` 10px | `rounded-field` 8px            | Same token name                             |

## Component inventory (from the SAF mockups)

Generic primitives live in `components/ui/` under the **same names and props as Moonlight**, so feature
code ports unchanged. All were ported on 2026-11-06 (✅), and Moonlight's `Toaster` and `RegisterForm`
tests pass against them unchanged.

| Component          | SAF appearance (as built)                                                                       | Used in              |
| ------------------ | ----------------------------------------------------------------------------------------------- | -------------------- |
| `Button`           | `primary` solid teal; `primary-gradient` teal sheen (auth CTAs) + trailing `→` via `rightIcon`; `secondary` white + `line` border | All |
| `TextField`        | white, 1px `ink-400` boundary, slate outline icon left, 8px radius, 48 → 52px (`sm`), teal focus ring | Login, Register |
| `PasswordField`    | lock-keyhole icon + eye toggle (open eye while hidden, as in the mockup)                        | Login, Register      |
| `PhoneField`       | phone icon · fixed `+91` · hairline · number (no chevron: D23 → Moonlight)                      | Register             |
| `Divider`          | `line` hairlines with centred teal "OR" in tracked caps                                         | Login, Register      |
| `TextLink`         | `brand-700`, underlined                                                                         | All                  |
| `SegmentedControl` | joined white track; active = solid teal pill, white text                                        | Planner              |
| `Switch`           | teal pill toggle, grey when off                                                                 | Planner              |
| `NumberStepper`    | boxed `[−] value [+]`                                                                           | Frame Gaps, Mat      |
| `Select`           | white box, chevron right                                                                        | Frame Size, units    |
| `SwatchPicker`     | circles, selected = teal ring on white; `textured` radial shading for wood (R2: Moonlight's flat-hex finishes) | Planner |
| `Badge`            | small pills (`new`, `neutral`, `success`, `warning`, `brand`)                                   | Planner              |
| `IconButton`       | square-cornered (`rounded-field`) ghost / outline / solid / glass                               | Planner, dialogs     |
| `Dialog`           | white card, 16px radius, `shadow-float`, extrabold title, mist footer                           | Planner dialogs      |
| `Alert`            | info = mist + teal icon; error = `danger-*`; success = `success-*`                              | Auth, planner        |
| `Toaster`          | navy toast, teal-light action, white text                                                       | Planner              |
| `Logo`             | `variant="full"` (stacked, as delivered) or `"mark"` (monogram)                                 | Brand bar            |
| `Spinner`          | logic-only                                                                                      | Buttons, loader      |

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
