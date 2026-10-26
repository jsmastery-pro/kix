# 03 · Home page

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Build the complete home page from the attached design, the whole landing page from the header and hero down to the footer, using only our design system components. Use placeholder data shaped like the store data types the wix headless kit skill ships so we can swap in real Wix data later. Match the design at desktop and phone width, then release it."

## Goal

Visitors to the live Kix site land on a finished home page: header, hero carousel, Shop by Category, New Arrivals, a Limited Collection banner carousel, Popular Right Now, Members Get More, and the footer. The page is laid out like the attached design at 1440px and 390px. Every product, category and slide comes from `src/data/mock.ts`, typed with the kit's `ProductSummary` and `Category` DTOs. Wiring it to Wix later means changing the frontmatter imports, not the components.

## Out of scope

Shop, category, product, cart, account, customize and footer pages (links point at their future routes and 404 until built). Wix Stores, cart, members and newsletter wiring. Seeding. PostHog. 3D. Star ratings. Social links. Changes to `/design-system` beyond shared token edits.

## Decisions

- **Photos (user):** vetted free Pexels photos of unbranded sneakers. Reuse the 4 in `public/images/design-system/`, add about 9 more under `public/images/home/`, and inspect each for logos or recognizable branded designs. Rejected images are replaced, and a slot with no passing image gets a marked placeholder. Credits go in `public/images/home/SOURCES.md`. Stock photos have their own backgrounds, so they're cropped (`object-fit: cover`) inside the pastel tiles rather than floating as cut-outs.
- **Members Get More (user):** shown as written ("Free Shipping · On orders over $100", "Easy Returns · 30-day return policy", "Exclusive Access · Early drops & member-only releases"). The user confirmed Kix will honor these. The copy lives in `mock.ts` so it can be edited in one place.
- **Headline font (user):** Barlow Condensed (SIL OFL) through Astro 7's built-in Fonts API with the Fontsource provider. There's no npm dependency; the font is self-hosted in the build.
  - Config: `fonts: [{ provider: fontProviders.fontsource(), name: "Barlow Condensed", cssVariable: "--font-barlow", weights: [400, 500, 600, 700, 800, 900], styles: ["normal", "italic"], subsets: ["latin"] }]` in `astro.config.mjs`. Astro's default is weight 400 only, but the page uses 500–700 and the design-system sheet uses 800, plus 900 italic for the wordmark.
  - Layout: `<Font cssVariable="--font-barlow" preload={[{ weight: "700", style: "normal" }]} />`, preloading only the hero weight.
  - `--font-display` becomes `var(--font-barlow)` with the current fallbacks after it. The design-system sheet picks this up too, since it already uses `--font-display`.
- **Release (user):** release to the live site after verification. Links use the routes the store will have: `/shop`, `/category/<slug>`, `/products/<slug>`, `/customize`, `/membership`, `/account`, `/cart`. They 404 until those pages exist. The visible prices are placeholders.
- **No star ratings:** AGENTS.md and the kit forbid invented ratings, and `ProductSummary` has no rating field. Cards show name and price only. This is an intentional difference from the design.
- **Brand substitutions:** a `KIX` text wordmark (the existing marked placeholder style) replaces the swoosh in the header and footer. Product names are our own (below). The footer says "About Kix" and "© 2026 Kix. All rights reserved."
- **Footer links:** "Sale" is dropped because there's no promotions data, and "Investors" is dropped because Kix is a made-up brand with no investor page. Both are intentional differences. The routes:

  | Column | Link | Route |
  | --- | --- | --- |
  | Shop | Men | `/category/men` |
  | Shop | Women | `/category/women` |
  | Shop | Kids | `/category/kids` |
  | Shop | Customize | `/customize` |
  | Support | Help Center | `/help` |
  | Support | Shipping | `/help/shipping` |
  | Support | Returns | `/help/returns` |
  | Support | Order Status | `/account/orders` |
  | Support | Size Guide | `/help/size-guide` |
  | Company | About Kix | `/about` |
  | Company | Sustainability | `/about/sustainability` |
  | Company | Careers | `/careers` |
  | Company | News | `/news` |

- **"View All" targets:** Shop by Category → `/shop`, New Arrivals → `/category/new-arrivals`, Popular Right Now → `/category/popular`.
- **Social icons omitted:** Kix has no social accounts, and Lucide 1.x (the installed icon library) ships no brand icons. Intentional difference.
- **Newsletter:** heading "Join Our Newsletter", helper "Be the first to know about new releases.", and an email field with the placeholder "Email address" plus an arrow submit button, all as designed. There's no newsletter backend yet, so submitting sends and stores nothing: the script validates the field, cancels the submit and shows "Sign-ups open soon." inline. The form is `method="post"` (never GET, so an email can't land in a URL), the submit button is disabled until the script runs, and the field uses `autocomplete="email"`.
- **Active nav item:** the design bolds MEN. On `/` no section is current, so all five items render in the idle gray, and the bold black style applies via `aria-current` on a matching route. Intentional difference.
- **Section data is curated, not computed:** "New Arrivals" and "Popular Right Now" make claims, so when wired each will read an owner-curated Wix category (`new-arrivals`, `popular`) through `fetchProductsByCategory`. The heading stays true because the merchant decides what's in it. "Shop by Category" will read `fetchCategories()` filtered to the children of an owner-made top-level category with slug `sports`, sorted by `index`. That way Men, Women, Kids and the curated categories never appear as tiles.
- **Carousels:** the hero and banner use one `Carousel` primitive with a small inline Astro `<script>` and no framework island.
  - Server output: every slide after the first renders with `hidden` and `inert`, so nothing flashes and the first slide is complete without JavaScript.
  - Behavior: dots and arrows switch slides, and the arrow keys work when the carousel has focus. There's no autoplay (calmer, respects reduced motion, nothing moves under the reader).
  - Headings: the page has one visually hidden `h1` ("Kix sneakers"). Slide titles are `h2`.
- **Kit types copied now:** `src/wix/storefront/types.ts` is copied verbatim from the kit's `storefront/app/wix/storefront/types.ts`, so the mock imports the real contracts. The kit's deploy never overwrites an existing file (`force: false`), and the file is identical, so the later deploy keeps it.
- **Layout named like the kit's:** `src/layouts/SiteLayout.astro` mirrors the kit's `SiteLayout` contract (`<slot name="seo-tags" />`, `title` and `description` props, global.css import). Wiring Wix then means adding its `CartButton` and `CartDrawer` mounts and the `fetchCategories()` nav. The kit's deploy won't overwrite our file, so that merge is a manual step in the wiring plan.
- **Phone layouts (derived):** described under Approach.
- **Plan review:** AGENTS.md names a `plan-reviewer` agent, but none is defined in `.claude/`. A general-purpose agent reviewed this plan instead. All ten of its findings are applied above: font weights, the build-failure risk, the design-system baseline, the missing copy and routes, the card fields, the nested link, the category filter, the no-JS carousel and form, and the size variants.
- **Component styling follows the existing pattern:** class rules in CSS that reference tokens only. New page and chrome layout rules go in a new `src/styles/site.css` (sizes and grids only, no colors, fonts, radii or motion), imported by `SiteLayout`. New tokens go in `global.css`.

## Context

- Read: `AGENTS.md`, `prompts/02-design-system.md`, `src/styles/global.css`, all of `src/components/ui/*`, both layouts, `src/pages/index.astro`, `astro.config.mjs`, `package.json` (Astro 7.4.2, @wix/astro 3.1.0, Tailwind 4.3.3, @lucide/astro 1.61.0 resolved).
- Skill loaded: `wix-headless-kit` (`node_modules/@wix/agent-skills/skills/wix-headless-kit/SKILL.md`). The storefront playbook `wix-headless-templates/storefront/INSTRUCTIONS.md` covers the home page rules, the DTO contracts and the `SiteLayout` contract. Also read `storefront/app/wix/storefront/types.ts`, `storefront/app-astro/layouts/SiteLayout.astro`, and `install/deploy.mjs` (no overwrite).
- Astro Fonts API: https://docs.astro.build/en/guides/fonts/ (top-level `fonts`, `fontProviders.fontsource()`, `<Font>` from `astro:assets`, Tailwind 4 `@theme inline`). Confirmed in the installed `astro/dist/core/config/schemas/base.d.ts` and `assets/fonts/providers/index.d.ts`.
- Lucide 1.61 icons confirmed present: `ShoppingBag`, `UserRound`, `ArrowLeft`, `ArrowRight`, `Truck`, `RefreshCcw`, `LockKeyhole`. No brand icons.
- Wix CLI: logged in as the project owner under Node 24.18.0 (`~/.nvm/versions/node/v24.18.0`). The default shell Node is 22.12, so every Wix command runs with Node 24.18 on `PATH`.
- Builds on plan 02 (tokens, primitives, Pexels sourcing approach).

## Approach

### Data flow

`src/pages/index.astro` imports from `src/data/mock.ts` in its frontmatter and passes DTOs as props to primitives. There's no client fetching. When wired, the same frontmatter calls `fetchCategories()` and `fetchProductsByCategory(…)` inside the guarded `try` the kit's skeletons use, and editorial slides move to a Wix CMS collection.

`mock.ts` exports:

- `shopCategories: Category[]`: Lifestyle, Running, Basketball, Skate, Training. Slugs are kebab-case, `description: ""`, `imageUrl` is a local photo path, `parentId: "sports"`, `index` 0–4, `productCount: null`, `breadcrumbs: []`.
- `navCategories: Category[]`: Men, Women, Kids. The header renders these as `/category/<slug>`, with Customize (`/customize`) and Membership (`/membership`) as fixed links.
- `newArrivals: ProductSummary[]` (3) and `popularNow: ProductSummary[]` (4). Every field is filled with an honest default: `maxPrice === price`, `fromPrice: false`, `compareAtPrice: null`, `discountNames: []`, `pricePerUnit: null`, `ribbon: null`, `ribbons: []`, `availability: "IN_STOCK"`, `preorder: false`, `hasSubscriptions: false`, `hoverImageUrl: ""`, `optionsSummary: ""`, `swatches: []`, `quickAddable: false`, `minPriceVariantId: null`.
  - New Arrivals: KIX COURT 1 RETRO ($229), KIX SUMMIT HIGH ($89), KIX STRAP HIGH LX ($279).
  - Popular: KIX NIGHTSHIFT HIGH ($349), KIX SANDLOT SUEDE ($229), KIX MERIDIAN PREMIUM ($309), KIX ORBIT HIGH ($95).
- `heroSlides: EditorialSlide[]` (4) and `collectionSlides: EditorialSlide[]` (4). `EditorialSlide` is a type defined in `mock.ts` as `{ id, eyebrow, title, body, ctaLabel, href, imageUrl, imageAlt }`, a future CMS collection, not a Stores DTO. The component that renders it is named `FeatureSlide`, so the two names don't clash. Each slide uses the photo of the product it names. Banner 1 uses a black-and-white high-top photo, and hero 4 uses the most colorful photo. Step 2 records which photo fills which slot in `SOURCES.md`.

  Hero slides:

  | # | Eyebrow | Title | Body | CTA → route |
  | --- | --- | --- | --- | --- |
  | 1 | New Release | KIX COURT 1 RETRO | Timeless style. Reimagined for today. | Shop Now → `/products/kix-court-1-retro` |
  | 2 | Just Dropped | KIX STRAP HIGH LX | Locked in. Lifted up. | Shop Now → `/products/kix-strap-high-lx` |
  | 3 | Back in Rotation | KIX SUMMIT HIGH | Built for the climb. Made for the street. | Shop Now → `/products/kix-summit-high` |
  | 4 | Make It Yours | DESIGN YOUR PAIR | Recolor the upper, sole, laces and accent. | Customize → `/customize` |

  Banner slides (eyebrow "Limited Collection" on all four):

  | # | Title | Body | CTA → route |
  | --- | --- | --- | --- |
  | 1 | BUILT FOR WHAT'S NEXT | Icons, reimagined. | Explore → `/shop` |
  | 2 | NIGHTSHIFT HIGH | Dark mode. Full speed. | Explore → `/products/kix-nightshift-high` |
  | 3 | MERIDIAN PREMIUM | Clean lines. Long days. | Explore → `/products/kix-meridian-premium` |
  | 4 | ORBIT HIGH | Bold color. Big moves. | Explore → `/products/kix-orbit-high` |

- `memberPerks`: the three perks as written. Icons: `Truck`, `RefreshCcw`, `LockKeyhole`.

Tile background colors are presentation, not data. The page assigns tones by index:

| Section | Tones, in order |
| --- | --- |
| Categories | beige, mint, peach, coral, periwinkle |
| New Arrivals | tan, aqua, rose |
| Popular | mint, peach, periwinkle, lilac |
| Hero | sand |
| Banner | taupe |

### Components

Pages compose only `src/components/ui/` primitives; callers pass layout classes only.

- **Change `Button`:** optional `href` renders an `<a class="ui-button …">`, and a new `size: 'md' | 'lg'` (`lg`: 54px high, 186px minimum width, 18px, for slide CTAs). Keeps current `<button>` behavior otherwise.
- **Change `IconButton`:** optional `href` and `type` (`button` | `submit`), plus a new `shape` prop:
  - `square`: current.
  - `round`: 40px white carousel arrows.
  - `tile`: card bag, 40px dark square, 4px radius.
  - `field`: 48px dark square, beside a field.
- **New `Wordmark`:** `KIX` placeholder wordmark, a link to `/`, with a hidden "placeholder logo" note. Reuses `.ds-wordmark` styling, moved to a shared class.
- **New `SiteNav`:** uppercase condensed links, idle gray, `aria-current` in black and bold.
- **New `SectionHeading`:** an H2 with an optional "View All" link.
- **New `CategoryTile`:** takes `Category` and `tone`; a square pastel tile with the photo and the name below; links to `/category/<slug>`.
- **New `ProductCard`:** takes `ProductSummary`, `tone` and `size: 'feature' | 'compact'`.
  - Image: wrapped in a link to `/products/<slug>`. The bag `IconButton shape="tile"` is a sibling positioned over the image's bottom-right corner, not nested in that link. It's labeled "Choose options for {name}" and links to the product page until the kit's `QuickAdd` replaces it.
  - Name: uppercase condensed.
  - Price, per the kit's rules: `From {price}` when `fromPrice`; `price – maxPrice` for a range; otherwise `price`, with a labeled "was" `compareAtPrice` when present. `pricePerUnit` sits beside the price when present, and `discountNames` sit under it.
  - Availability: "Pre-order" when `availability === "OUT_OF_STOCK"` and `preorder`; "Sold out" when out of stock otherwise.
  - Ribbons: every entry in `ribbons`, one shared style (`Badge`).
  - With the mock only the plain price shows, but every branch is ready.
  - Sizes: `feature` puts name and price on one row (New Arrivals); `compact` stacks the price under the name (Popular).
- **New `Carousel`:** a region with `aria-roledescription="carousel"` and slides as a slot. Dots are `button`s with `aria-label="Show slide n"` and `aria-current`. Round prev/next arrows are optional. It uses an inline script, and slides 2+ are server-rendered `hidden inert`.
- **New `FeatureSlide`:** renders an `EditorialSlide`: eyebrow, an `h2` title, body, a CTA `Button href size="lg"`, and the image. `variant: 'hero' | 'banner'`.
- **New `PerkCard`:** a Lucide icon slot, title and text on a muted-fill card.
- **New `NewsletterForm`:** label, helper text, `TextField type="email"` and an `IconButton shape="field" type="submit"`, plus an inline status line (`aria-live="polite"`).
- **Change `TextField`:** gets optional `required` and `autocomplete` props (the default stays `off`).
- **New layout `SiteLayout`:** header (Wordmark, SiteNav, bag link → `/cart`, account link → `/account`); `<main>`; footer composed in `src/components/SiteFooter.astro` from Wordmark, link columns and NewsletterForm.

### Desktop layout

The design image is 774px wide and represents a ~1024px canvas (scale ×1.32: its bag icon becomes 24px and its section headings 32px, matching the design system's icon size and H2). Type and control sizes use that scale. The layout widens fluidly to 1440. All values are estimates from the image.

- **Page:** background `--color-panel` (the design's page is white; the warm tone stays in tiles and hero). Content container max 1280px, centered, side inset `clamp(16px, 5.6vw, 80px)`. Hero and banner are wider: inset `clamp(16px, 2vw, 28px)` from the viewport edge, max 1384px.
- **Header:** 84px tall, three columns. The wordmark sits left at about 28px. The nav is centered, with 5 items in Barlow Condensed 600, 15px, uppercase, 0.02em tracking, a 44px gap, idle color `--color-text-secondary` and active `--color-black` 700. Bag and account icons sit right: 24px, 1.75 stroke, 32px apart.
- **Hero:** height `clamp(520px, 44vw, 640px)` and `--color-tile-sand` background. Text column left at 6% inset, vertically centered with a slight upward offset. Eyebrow: Barlow 700, 22px, uppercase. Title: Barlow 700, `clamp(56px, 6.5vw, 92px)`, line-height 0.95, uppercase, max 2 lines. Body: sans 20px/28px, `--color-text-secondary`-darker (`--color-ink-soft`). CTA: a primary Button at 186×54 with Barlow 600 18px. The image fills the right 55% (`object-fit: cover`, rounded none). Dots sit bottom-left: 12px, 14px gaps, active `--color-black`, idle `--color-state-disabled`. Arrows sit bottom-right: 40px round white buttons, 12px apart.
- **Sections:** 72px apart. Heading: Barlow 600, 32px/40px, with 24px under it. "View All" is Barlow 600, 16px, right-aligned.
- **Shop by Category:** 5 columns, 24px gap, square tiles, radius `--radius-sm`. The label is sans 500, 16px, with a 12px gap above.
- **New Arrivals:** 3 columns, 34px gap, image aspect 1.13:1. Name is Barlow 500 18px uppercase; price is Barlow 600 18px on the same row. The bag button is 40px at a 12px inset.
- **Limited Collection banner:** height `clamp(380px, 32vw, 460px)`, `--color-tile-taupe` background, text left at 5% (eyebrow 20px, title `clamp(48px, 5vw, 64px)` uppercase, body 18px, Explore button). Image right. Dots bottom-right, no arrows.
- **Popular Right Now:** 4 columns, 34px gap, square images, name Barlow 500 16px uppercase, price 16px under it.
- **Members Get More:** 3 columns, 24px gap. Cards are 72px tall, muted fill, `--radius-sm`, with a 28px icon at 24px left padding, title Barlow 600 18px and text sans 14px `--color-text-secondary`.
- **Footer:** top border `--color-border` with 40px padding. Grid columns: brand and copyright (1.6fr), Shop, Support, Company (each 1fr), newsletter (1.8fr). Column heads are sans 600 14px; links sans 14px `--color-text-secondary` with an 8px gap. The newsletter is a 48px field plus a 48px dark arrow button. 48px bottom padding.

### Phone layout (390px, derived)

16px insets.

- **Header:** 64px; wordmark plus icons. Nav moves to a horizontally scrollable row beneath (all five items, 44px tap height, no overlay menu).
- **Hero:** stacked text, then image band at 240px. Title 44px, body 16px, CTA full width. Dots below, left; arrows hidden.
- **Shop by Category:** a horizontal snap rail of 140px tiles (all 5 reachable).
- **New Arrivals:** a horizontal snap rail of cards at 78% width.
- **Banner:** text, then a 200px image band, then dots.
- **Popular:** a 2-column grid, 12px gap.
- **Perks:** 1 column.
- **Footer:** wordmark and copyright, then the three link columns as a 3-column grid of 14px links, then the newsletter at full width.
- No horizontal page scroll. Every tap target is at least 44px.

### Tokens

**Existing tokens reused:** `--color-black` (buttons, type, bag), `--color-panel` (page), `--color-text-secondary`, `--color-border`, `--color-muted-fill` (perk cards, design `#f4f3f4`), `--color-state-disabled` (idle dots, design `#d3ccc8`), `--color-white`, `--color-tile-beige` (`#eee3d9`, design `#eee1d5`), `--color-tile-mint` (`#ddf1ec`, design `#dcf6f2` / `#d7f8e8`), `--color-tile-peach` (`#ffe6c7`, design `#ffe5c5`), `--radius-sm`, `--radius-pill`, `--ds-motion-base`.

**Proposed new tokens** (sampled from the image):

| Token | Value | Used for |
| --- | --- | --- |
| `--color-tile-sand` | `#f2e8dd` | Hero |
| `--color-tile-coral` | `#fccbc0` | Skate tile |
| `--color-tile-periwinkle` | `#cdd0e7` | Training tile, Popular 3 |
| `--color-tile-lilac` | `#eedbfd` | Popular 4 |
| `--color-tile-aqua` | `#ddf7f9` | New 2 |
| `--color-tile-tan` | `#e8d5c4` | New 1 |
| `--color-tile-rose` | `#e7c4b4` | New 3 |
| `--color-tile-taupe` | `#c9b9b3` | Banner |
| `--color-ink-soft` | `#3f3f46` | Hero body text |
| `--font-barlow` | Set by the Fonts API | Headline font |
| `--radius-xs` | `4px` | Bag tile button |
| `--shadow-arrow` | `0 2px 8px rgb(17 17 17 / 8%)` | Carousel arrows |

`--font-display` becomes `var(--font-barlow), "Arial Narrow", "Helvetica Neue", Arial, sans-serif`.

Layout sizes live in `site.css` as `--site-*` custom properties (header height, insets, gaps).

### Accessibility and states

- One visually hidden `h1` ("Kix sneakers").
- Slide titles and section headings are `h2`; card names are `h3`.
- Images have alt text from the DTO name and empty alt on decorative slides.
- A broken image falls back to the pastel tile with a marked "Image placeholder" note (same pattern as `ProductSpecimen`).
- Focus rings use the existing `:focus-visible` style.
- Data states: the mock can't load or fail, but each section renders nothing (its heading included) for an empty list. That's the empty state a wired fetch will hit, and it's documented in `index.astro` for the wiring plan.

### Secrets, events, new dependencies

None. Astro downloads the font from Fontsource at build time, so no npm package is added.

## Steps

- [ ] 1. Tokens and font: add the new tokens, the Fonts API config and `@theme inline` mapping, and site body base styles; create `site.css` (check: `npm run check`; `/design-system` renders with Barlow headlines, and its screenshot becomes the baseline for step 4).
- [ ] 2. Photos: download about 9 Pexels candidates, inspect each at full size for logos or branded designs, keep about 1200px-wide JPEGs under 200 KB in `public/images/home/`, and write `SOURCES.md` (check: visual inspection of every image, file sizes listed).
- [ ] 3. Data: copy the kit's `types.ts` verbatim to `src/wix/storefront/types.ts`; write `src/data/mock.ts` (check: `npm run check` proves every mock object satisfies its DTO; `diff` the copied file against the kit's).
- [ ] 4. Primitives: Button/IconButton/TextField changes plus the new primitives listed above (check: `npm run check`; `/design-system` matches the step 1 screenshot).
- [ ] 5. `SiteLayout`, `SiteFooter`, and the new `index.astro` composing every section. Delete the starter `Hero.astro` and `Welcome.astro` if nothing else imports them, and keep `Layout.astro` only if referenced (check: `npm run check`, `npm run build`).
- [ ] 6. Visual pass: screenshots at 1440 and 390 (headless Chrome full-page plus Claude in Chrome for interaction), compare each section with the design, list differences, fix, repeat until only the documented intentional differences remain (check: final screenshot pair plus difference list).
- [ ] 7. Behavior checks: carousel dots, arrows and keys; `inert` on hidden slides; newsletter validation message; keyboard tab order; no horizontal overflow at 390 (`document.documentElement.scrollWidth === 390`); broken-image fallback (check: console output and screenshots).
- [ ] 8. Release with Node 24.18: `npm run build`, then `npm run release`; open the live URL from the release output at 1440 and 390 (check: live screenshots, HTTP 200 for `/` and the font file).
- [ ] 9. Close out: Result, index, AGENTS.md proposals; commit each passing step.

## Files

- **Create:**
  - `prompts/03-home-page.md`
  - `src/data/mock.ts`
  - `src/wix/storefront/types.ts`
  - `src/layouts/SiteLayout.astro`
  - `src/components/SiteFooter.astro`
  - `src/components/ui/{Wordmark,SiteNav,SectionHeading,CategoryTile,ProductCard,Carousel,FeatureSlide,PerkCard,NewsletterForm}.astro`
  - `src/styles/site.css`
  - `public/images/home/*` and `public/images/home/SOURCES.md`
- **Change:**
  - `src/pages/index.astro`
  - `src/styles/global.css`
  - `astro.config.mjs` (fonts)
  - `src/components/ui/{Button,IconButton,TextField}.astro`
  - `prompts/README.md`
- **Delete (if unreferenced):** `src/components/Hero.astro`, `src/components/Welcome.astro`, `src/layouts/Layout.astro`, `src/assets/{astro,background,wix}.svg`

## Acceptance criteria

- WHEN `/` opens at 1440px, THE SITE SHALL show header, hero carousel, Shop by Category (5), New Arrivals (3), banner carousel, Popular Right Now (4), Members Get More (3) and footer in the design's order, proportions, colors and type, except for the documented intentional differences.
- WHEN `/` opens at 390px, THE SITE SHALL show every section stacked as described, with no horizontal page scroll and tap targets of at least 44px.
- WHEN a visitor activates a carousel dot or arrow (or presses ←/→ while it's focused), THE SITE SHALL show that slide, mark its dot current, and make the hidden slides inert.
- WHEN a visitor submits the newsletter form with a valid email, THE SITE SHALL show "Sign-ups open soon." and send nothing. With an invalid email it shows the browser's validation.
- WHEN a photo fails to load, THE SITE SHALL keep the tile size and show a marked placeholder.
- WHEN `mock.ts` is replaced by the kit's fetch functions, THE components SHALL need no prop changes (they accept `ProductSummary` and `Category`).
- WHEN the release finishes, THE live URL SHALL serve the new home page with Barlow Condensed headlines.

## Verification

- `npm run check` and `npm run build` (Node 24.18): output shown.
- `diff` of the copied `types.ts` against the kit's: empty.
- Local server: `npx astro dev --port 4333`, because `wix dev` exits 1 on its dashboard step. Headless Chrome full-page screenshots at 1440 and 390, side by side with the design crops. Claude in Chrome (the Playwright MCP isn't connected) for interaction checks and the overflow measurement.
- `npm run release`: the release output's live URL, and screenshots of the live page at both widths.
- The report lists each difference from the design, each estimated value, and each image source.

## Risks and open questions

- Stock photos won't match the design's floating studio shoes, so the page will feel more photographic. Real product photos or Tripo renders replace them later.
- All sizes are estimates from a 774px image. The screenshot loop narrows the gap, but they stay estimates.
- The release puts placeholder products and prices on the public URL, and their links 404 (accepted by the user).
- The Members perks are public promises the user has confirmed.
- Wiring later: the kit's `CartButton`, `CartDrawer`, `QuickAdd` and `FilterPanel` style themselves with token names we don't define yet (`foreground`, `muted-foreground`, …). The kit's `QuickAdd` replaces our bag button and may not look like the design. Both belong to the wiring plan.
- Barlow Condensed is downloaded from Fontsource at build time. If that download fails, the build fails (`CannotFetchFontFile`); it does not fall back. So `build` and `release` need network access. If that becomes a problem, switch to the `local()` provider with the woff2 files committed.
- No money, Wix AI credits or data changes. One release.

## Result

Filled at close-out.
