# 02 · Kix design system

Status: done

**Request:** Build design system exactly as shown in attached image.

## Goal

Provide a reusable Kix storefront design system and a `/design-system` showcase that follows the supplied 1536 × 1024 reference sheet in layout, type hierarchy, color, controls, and spacing. The existing home page remains available. The sheet is a UI specimen, not a live store.

## Out of scope

Wix catalog/cart/checkout wiring; accounts; saved designs; 3D models; real stock, sale, review, rating, or shipping data; release or seeding. No changes to the existing home page content.

## Decisions

- The user chose `/design-system` for the showcase, preserving the current Wix starter home page.
- The user chose stock-image sites such as Unsplash or Pexels for photos. Select and download free-to-use sneaker images with no visible brand marks or recognizable branded designs; record source pages and photographer credits. If an image cannot pass that review, use a clearly marked image placeholder in its slot.
- Replace Nike logo, names, and designs with a text `KIX` wordmark marked as a placeholder, neutral sample captions, and vetted stock photography, as AGENTS.md requires.
- Do not show star ratings, real prices, stock claims, or sale claims on sample product cards. Keep rating, sale, and status badges as independent design specimens, without attaching them to fictional products. The screenshot's product content is therefore intentionally different.
- Helvetica Now is named in the reference but no licensed font file was supplied. Use a condensed system sans fallback (`Arial Narrow`, `Helvetica Neue`, Arial) and list typeface matching as a known limit. A supplied licensed font can later replace the token.
- Use `@lucide/astro` for the reference's thin outline icons, per the icon-library rule. Add `tailwindcss` and `@tailwindcss/vite` to establish the required `@theme` tokens. These are new dependencies and need approval with this plan.
- The showcase's controls demonstrate local UI states only: category/size/color selection, quantity adjustment, password visibility, and focus/hover/disabled states. Cart, wishlist, and save-design actions are visibly specimen-only and never imply a stored purchase or design.

## Context

- Inspected the supplied `wix-design-system.png` at 1536 × 1024, `AGENTS.md`, `package.json`, `astro.config.mjs`, the current starter page/layout, and the Headless kit storefront theme example. The repository has no design tokens, storefront primitives, icon package, licensed font, or product photos yet.
- Astro 7 styling and scripts: https://docs.astro.build/en/guides/styling/ and https://docs.astro.build/en/guides/client-side-scripts/ .
- Tailwind 4 Astro setup: https://tailwindcss.com/docs/installation/framework-guides/astro . Lucide Astro package: https://lucide.dev/packages .
- Potential photo search pages (each selected photo must be visually vetted): https://www.pexels.com/search/unbranded%20sneakers/ and https://www.pexels.com/search/basic%20sneakers/ . A candidate stock photo is https://www.pexels.com/photo/a-pair-of-running-shoes-6746706/ . Do not use it if inspection finds a brand mark/design.
- This is a storefront sheet. The installed `wix-design-system` skill concerns Wix dashboard UI, so it does not govern these shopper-facing primitives. No Wix API calls are needed.

## Approach

Create `src/styles/global.css` as the single source for Tailwind `@theme` values and CSS custom properties. Import it in a separate showcase layout so the existing starter page is not redesigned. Build reusable primitives in `src/components/ui/`; callers set layout classes but choose component variants for visual differences. Compose the showcase from the following sections in the screenshot order:

1. **Top row (roughly 398px high at 1536px):** Brand Colors (10 circular swatches, 5 × 2), Typography (large `Aa`, font label, size table, sample heading/body copy), Buttons (two full-width actions, four icon buttons, four state chips, save-design specimen), Input Fields (search, select, three-part quantity stepper, email, password).
2. **Middle row (roughly 323px):** Navigation (header sample, breadcrumb strip, six category pills) and Product Card Variations (four portrait-ish photo tiles on pastel backgrounds, card captions, cart icon specimens; no invented catalog facts).
3. **Bottom row (roughly 228px):** Thumbnails (six image slots and selected state), Selectors (five colors and 5 × 2 size grid), Badges (six independent style specimens), Icons (5 × 4 grid of 24px Lucide line icons).

At the reference's 1536px width, use 24px page insets, about 8px horizontal panel gaps, 16px row gaps, translucent white panels, and 24px panel padding. Top panel widths are approximately 449/357/355/303px; middle 609/871px; bottom 571/331/292/267px. Use grid fractions to retain those proportions at 1440px. At 390px stack sections in the same reading order with 16px page insets, 12px gaps, a two-column product grid, wrapped swatches/size buttons, and a horizontally scrollable thumbnail rail. Keep tap targets at least 44px and avoid horizontal page overflow.

### Tokens

Values printed in the image (exact): primary `#E10600`, black `#111111`, background `#F7F1E9`, surface `#EDE3DB`, text-secondary `#6B7280`, success `#2F6B3A`, warning `#F6A21A`, info `#2563EB`, sale `#FF6B6B`, border `#E5E7EB`. Type scale printed in the image: display 56/64, H1 40/48, H2 32/40, H3 24/32, body 16/24, small 14/20, caption 12/16 (font size/line height in px).

Proposed new tokens for values not labeled in the image (estimated, to tune by screenshot): white panel `#FFFEFC`, primary foreground `#FFFFFF`, muted fill `#F2F0ED`, product tile beige `#EEE3D9`, mint `#DDF1EC`, peach `#FFE6C7`, pink `#FFDAD8`, hover gray `#6B7280`, pressed gray `#454A52`, disabled gray `#D1D1D1`; radii 6/8/12px and pill 9999px; spacing 4/8/12/16/20/24/32px; control heights 48/50px; swatches 60px (brand) and 32px (selector); icon size 24px with 1.75px stroke; motion 150ms and 200ms. Put all colors, font stacks, radii, and motion in `global.css`; other component styling references tokens.

### Elements and states

- Buttons: black filled, white outlined, icon-only, disabled, hover, pressed, and wide save-style specimen. Icons are Lucide components, never screenshot traces.
- Inputs: search icon and placeholder, select chevron, quantity minus/value/plus with 1 lower bound, email, and password reveal. Each has keyboard focus styling and accessible names.
- Navigation: `KIX` placeholder wordmark, menu labels, bag/account icons, breadcrumbs, and selected/idle category chips; sample items do not navigate to nonexistent pages.
- Product specimens: four stock photos in pastel tiles with image loading/failure placeholders, text labels identifying samples, and disabled cart icons. No stars, price, inventory, or discount on cards until Wix supplies data.
- Thumbnails: selected border and six photo/crop placeholders; captions use `View 1`–`View 6` because real front/back/top/3D views are unavailable.
- Selectors: selected ring on color, selected outline on size, keyboard-operable state. Badges remain disconnected visual samples, not product claims.
- Icon grid, in screenshot order: Search, UserRound, ShoppingBag, Heart, Menu; LayoutGrid, ChevronLeft, ChevronRight, ChevronUp, ChevronDown; Plus, Minus, X, SquareArrowOutUpRight, LockKeyhole; Truck, ShieldCheck, RotateCcw, Gift, Star. Use Lucide's closest named icon when an exact glyph differs.

## Steps

- [x] 1. Add approved Tailwind 4 and Lucide Astro dependencies; configure Vite; create `global.css` with all tokens (check: installed versions, token audit, `npm run check`).
- [x] 2. Vet and download stock photos; record source URLs/credits and optimize local copies for the showcase (check: inspect every image for logo/design and file sizes; broken-image fallback).
- [ ] 3. Build reusable primitives and their keyboard/local state behavior (check: component states and accessible labels in browser). Browser interaction check left to the user.
- [ ] 4. Compose `/design-system` with the three-row reference layout and phone stack (check: all sections and content order present, no page overflow). Phone overflow check left to the user.
- [ ] 5. Run `npm run check` and `npm run build`; capture screenshots at 1440px and 390px, compare every section against the source, list differences, adjust, repeat. Record estimated values and unavoidable font/photo/data differences. Command checks passed; exact viewport screenshots left to the user.
- [x] 6. Fill Result and update index. Propose any AGENTS.md corrections for approval before saving them. Keep work uncommitted and staged, following the user's latest preference for this project.

## Files

- Create: `src/styles/global.css`; `src/layouts/DesignSystemLayout.astro`; `src/pages/design-system.astro`; reusable files under `src/components/ui/` for panels, color/type specimens, buttons, inputs, navigation/chips, product/photo specimens, thumbnails, selectors, badges, and icons; vetted images under `public/images/design-system/` and a source-credit note.
- Change: `package.json`, `package-lock.json`, `astro.config.mjs`; this plan and `prompts/README.md`.
- Preserve: existing `src/pages/index.astro`, its starter components/layout, and `wix.config.json`.

## Acceptance criteria

- WHEN `/design-system` opens at 1440px, THE SITE SHALL show all reference sections with matching hierarchy, relative panel widths, spacing, palette, typography scale, and control states, subject to the documented Kix/stock/font/data substitutions.
- WHEN it opens at 390px, THE SITE SHALL stack the same sections legibly with working controls, accessible focus, and no horizontal page overflow.
- WHEN a photo fails, THE SITE SHALL show a marked image placeholder without breaking the card layout.
- WHEN the user interacts with specimen controls, THE SITE SHALL update only local preview state and shall not claim a cart, saved design, or catalog operation happened.

## Verification

Run `npm run check` and `npm run build` under Node 24.18.0 or newer, report exit/output. Start a local Astro server (the Wix CLI `dev` wrapper has the documented dashboard exit issue), request `/design-system`, and use available browser tooling to screenshot at 1440px and 390px. Compare each section to the supplied image; report measured/estimated differences, source photo substitutions, and any font mismatch. Check keyboard selection, focus rings, quantity bounds, password reveal, image fallback, and responsive overflow. No Wix records or PostHog events are involved.

## Risks and open questions

- The user needs to approve three added dependencies: `tailwindcss`, `@tailwindcss/vite`, `@lucide/astro`.
- Exact Helvetica Now rendering requires a licensed font asset that is not supplied. Stock photos will have different shoes, angles, and lighting from the prohibited Nike reference.
- Some stock-photo search tags claim “unbranded” even for branded shoes. Inspect the actual image and reject anything with a real brand mark or recognizable branded design.
- No Wix AI credits, Wix data mutations, publishing, or paid photo services are planned.

## Result

The `/design-system` showcase, reusable UI components, Tailwind tokens, Lucide icons, and four locally stored Pexels specimen photos are implemented. The original starter home page remains. Product cards deliberately omit prices, ratings, stock, and branded product names. Photo sources are listed in `public/images/design-system/SOURCES.md`.

`npm run check` passed with 0 errors, warnings, and hints. `npm run build` passed under Node 24.18.0. The Astro dev route and a local photo both returned HTTP 200 on port 4333. One desktop browser view showed all three rows, but it was not a calibrated 1440px capture. The user then asked the agent to stop local testing and will perform the exact 1440px/390px visual and interaction checks, including keyboard states, phone overflow, quantity bounds, password reveal, and image fallback. Those verification boxes remain unchecked for that reason.

The reference image's Helvetica Now file was not supplied; the showcase uses a system fallback. Panel dimensions, additional badge colors, radii, spacing, and responsive layout values were estimated from the reference and stored as tokens. Stock-photo scenes and neutral labels differ from the reference's protected brand/product imagery and fictional commerce claims. The `KIX` wordmark is a marked placeholder. No Wix data, release, or external account was changed. Work remains staged and uncommitted.

One-pass prompt: “Build the attached design-system sheet as a `/design-system` showcase, following AGENTS.md brand restrictions, with reusable tokens/primitives, unbranded stock photos, and responsive phone styling; stop local testing when I ask and leave the files staged.”
