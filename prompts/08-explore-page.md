# 08 · Explore page: category list, price and color filters, search and the product grid

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Build the explore page from the attached design using real Wix data from the storefront part of the wix headless kit skill. Include the category list with counts, price and color filters, search and the product grid, and keep the chosen filters in the page address so a filtered view can be shared."

Attached design: explore (product listing), 1055 × 1491 px. Described in full under "The design" below.

## Goal

A shopper opens `/shop` (every Kix sneaker) or any `/category/<slug>` page (a sport, a gender, or a curated list) and sees a live grid of Wix Stores products under a headline with the live count ("4 Lifestyle Sneakers"). A left sidebar lists the sport categories with Wix's product counts, a price slider bounded by the scope's real prices, and color dots from the catalog's Color option. A search box narrows by product name. Every filter change re-queries Wix across the whole scope and is written into the page address, so copying the URL shares the exact filtered view, and opening it renders that view on the server. On a phone the sidebar becomes a scrolling category row and a Filters disclosure above a 2-column grid.

## Out of scope

- Combining a gender with a sport (Men × Lifestyle). User's choice: one category per page.
- Add to cart from the grid. The bag button links to the product page, like the home cards (user's choice). The kit's `QuickAdd`, `CartButton` and `CartDrawer` wait for the product and cart plans.
- The product page (`/products/<slug>` still 404s, as it does from the home cards today).
- Sort, Size and In-stock filters. The design has none (the kit's `FilterPanel` has all three; see Decisions).
- Stars and review counts. No source (plan 07's data map).
- Deleting Wix's 12 sample products. The owner removes them in the dashboard; this plan keeps them off `/shop` instead.
- Adding the new primitives to `/design-system`.
- Release. Verification is local; I'll ask before releasing.

## Decisions

- **One category per page** (user). `/shop` and `/category/[slug]` mount the same island. Sidebar sport links and header gender links are each a page; nothing combines two categories, so the kit's shop store is used unchanged.
- **Bag button links to `/products/<slug>`** (user), labelled "Choose options for <name>", exactly as `ProductCard.astro` does on home.
- **One analytics event, `catalog_filtered`** (user). Properties: `filter: 'category' | 'price' | 'color' | 'search' | 'clear'` and `category: <slug> | 'all'`. Never the search text, prices or color names.
- **Search text stays out of PostHog.** The kit writes the search into the URL (`?q=`), and PostHog records URLs on every event. Two layers in `PostHog.astro`:
  - `mask_personal_data_properties: true` and `custom_personal_data_properties: ['q']` (posthog-js config, `@posthog/types/dist/posthog-config.d.ts`). This masks `q` in `$current_url`, `$pageleave`, heatmaps and session replay (the review traced each in the SDK source).
  - It does **not** mask referrers: `getReferrer()` returns raw `document.referrer` (`@posthog/browser-common/dist/utils/event-utils.js:185`), so `/shop?q=court` would reach `$referrer`, `$initial_referrer` and the session entry referrer on the next page. The existing `before_send` therefore also rewrites the `q` value to `<MASKED>` in every string property whose key contains `referrer` or `url`, at the top level and inside `$set` and `$set_once`.
  - Verified in step 9.
- **Kit fix: the result count ignores the search** (needs your approval; approving this plan approves it). `searchCatalog` counts with `countProducts({ filter: query.filter })` ([catalog.ts:61](../src/wix/storefront/catalog.ts)), but the search text sits outside the filter, so `/shop?q=orbit` would show 1 card under "12 Sneakers", on the server and in the store. [Count Products](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/count-products.md) accepts `search: SearchDetails` beside `filter`. The fix is that one call: `countProducts({ filter: query.filter, ...(query.search ? { search: query.search } : {}) })`, with a comment naming this plan. It's the only kit edit. I'll offer to report it to Wix as kit feedback.
- **`/shop` is scoped to the Sports category, not all products.** All 12 sneakers sit under Sports' five children, and a Sports-scoped search includes subcategories (`allCategoriesInfo.categories` `$matchItems`, per `catalog-core.ts`). This keeps the 12 Wix sample products (Baseball Cap, Ceramic Flower Vase…, listed in `.seed/seed-result.json` `preexisting`) off the page. If Sports is missing, `/shop` logs `[shop] category missing: sports` and falls back to all products.
- **Our own filter UI on the kit's `useShop`, not the kit's `FilterPanel`.** The kit says to wire `FilterPanel` as-is, but AGENTS.md says kit UI is used only where it matches the designs, and `FilterPanel` (toolbar with sort, chips, collapsible groups, size and stock filters, a bottom sheet) doesn't match this sidebar. All selection, URL sync, facet and paging logic stays in the kit's `shop-store.ts` through `useShop`; only the rendering is ours. Adding sort or size later is a small UI change.
- **The island is React** (`client:load`), because `useShop` is a React hook. It's the site's first React island. Astro primitives can't render inside it, so the card, slider, swatch, search field and category list get React primitives in `src/components/ui/*.tsx` that reuse the same CSS classes. `ProductCard.tsx` mirrors `ProductCard.astro`'s markup and classes; a comment in each says to keep them in step.
- **Icons: add `lucide-react`** (`^1.61.0`, the same Lucide set as `@lucide/astro` 1.61.0; peer `react ^18` OK). AGENTS.md forbids redrawn icons, and React can't use `@lucide/astro`. Approving this plan approves the dependency. Icons: `ShoppingBag` (card bag), `Search` (search button), `SlidersHorizontal` (phone Filters button).
- **Server renders the filtered view.** The page reads `min`, `max`, `q` and `choice` from its own URL with a small parser (`src/wix/storefront/shop-url.ts`, ours, beside the kit's files) and passes them to `searchCatalog`, so a shared link's first HTML already matches and the store's revalidation on start returns the same list (no flash). The parser accepts exactly the store's own format: `choice=<option|modifier>:<facetId>:<choiceId>` (a bare id counts as an option pick), grouped per facet into `FacetSelection`s.
- **Controls show the URL's values before hydration.** The page passes the parsed URL state to the island; until the store has started (a `ready` flag set in `useEffect`), the search box, slider values, pressed swatches and empty-state copy read it. Afterwards they read `useShop` state. The first client render equals the server's: `useShop` reads the same `getState` on both, and the store adopts the URL only inside its effect.
- **Facets are server-rendered too.** The store loads `facets` and `priceRange` only after `start()`, so without help the server HTML has no color dots and no slider. The pages also call `fetchFacetData({ categoryId })` (2 sub-requests) and pass it as `initialFacetData`. The island renders it until the store's own facets arrive. Until then the dots are `aria-disabled="true"` (not `disabled`, so they stay focusable), because `toggleChoice` ignores a choice it can't find in the store's facets (`shop-store.ts:311`).
- **Dimming only for the shopper's own changes.** The store reports `loading: true` during SSR and during its revalidation after `start()`, even when the list won't change. The grid dims (`aria-busy="true"`) only when `ready && loading && userChanged`, where `userChanged` is a ref the filter handlers set. A page load never shows a dimmed grid.
- **Headline count.** `useShop().total` is null while a query runs, so the headline shows the last known total (the server's `total` first). Copy: `{n} {label}`, with the singular label when n = 1. With no total known on either side, it shows the label alone ("Lifestyle Sneakers"). The page computes the label and passes `scope: { slug: string | 'all'; label: { one: string; many: string } }`; `slug` is also the analytics `category` value. Labels by scope:
  - `/shop` and Sports → "Sneaker"/"Sneakers"
  - Sports' children → "{Name} Sneaker(s)"
  - `men`, `women`, `kids` → "Men's", "Women's", "Kids' Sneaker(s)"
  - `new-arrivals` → "New Arrival(s)"
  - `popular` → "Popular Sneaker(s)"
  - any other category → its name for both forms
- **Category list = "Sneakers" group.** "All" (→ `/shop`, no count, since Sports holds no products directly), then Sports' children by `index`, each linked to `/category/<slug>` with `({productCount})`. Wix's `itemCounter` counts products directly in the category, which is how the five sports are stocked. A null count shows no number. The heading reads "Sneakers" (the design's "SNEAKER'S" is a typo). The current page's item is marked `aria-current="page"` with the design's bar; on gender and curated pages no sport is marked, and counts stay the sport's total across genders.
- **Color filter = the scope's color facets.** `facets.filter(f => f.isColor)` choices as dots, in catalog order, with `aria-pressed`, an accessible name "{color name}, {count} sneakers" and a `title` tooltip. OR within the facet (kit rule). A choice with no `colorCode` gets a `--color-muted-fill` dot with a 1px `--color-control-border` ring. The Size facet isn't shown (not in the design or the request).
- **Price slider.** Two native `<input type="range">` thumbs over one track, bounds `floor(priceRange.min)`–`ceil(priceRange.max)`, step 1.
  - Each thumb has its own name, "Minimum price" and "Maximum price", and an `aria-valuetext` such as "$69".
  - The visible labels show the current values with `$` (`$69` … `$229`).
  - The thumbs clamp so low ≤ high, because `catalogFilter` throws when min > max (`catalog-core.ts:127`).
  - It commits on `change` (pointer release or key), not on every `input`. A thumb at its bound sends no value for that side.
  - Hidden while `priceRange` is null (unknown, or every product costs the same).
- **Search** submits on Enter or the button (not per keystroke), max 100 characters (the kit's limit), searches names within the current scope, and an empty submit clears it. `type="search"`, label "Search sneakers" (visually hidden), placeholder "Search".
- **Load more.** Page size 24 (the kit's default). A "Load more" secondary button appears when `hasMore` and is disabled while `loadingMore`. Today's catalog (12 per scope at most) never shows it.
- **States**, checked in this order, because on error the store also sets `products` to `[]` (`shop-store.ts:262`). `error` first: "We couldn't load sneakers." with Try again (`retry()`) and, when filters are active, Clear filters; the kit's error text isn't shown. Server read failed → `initialProducts` undefined → skeleton tiles until the client query answers. A shopper's change in flight → grid dimmed (see above). `[]` without filters → "No sneakers here yet." with a link to all sneakers. `[]` with filters → "No sneakers match these filters." with a Clear filters button. Unknown or hidden category slug → a 404 page (status 404, SiteLayout, "This category doesn't exist." and a link to `/shop`), not the kit skeleton's empty `Response`.
- **Prices** render from the DTO as the home cards do (`$229.00`, "From", ranges, struck `compareAtPrice`, every ribbon as a badge). Design shows `$220`; same accepted difference as plan 07.
- **Header stays shared.** The design draws the logo inside the sidebar column with the sidebar border running up through the header, and its nav type is smaller than home's. We keep `SiteLayout`'s header and start the sidebar border under it. The sidebar's text aligns with the logo's left edge.
- **Phone layout (under 768px):** headline (smaller) and a full-width search; the category list becomes one horizontally scrolling row of links; a "Filters" button (with the active filter count) toggles an inline panel holding Price and Color (no overlay, so no scroll lock or focus trap needed); a 2-column grid; card name and price on separate lines; bag 44px. Tablet (768–1023px): sidebar 220px, 2-column grid.
- **Server sub-requests.** `/shop`: `fetchCategories` (2), then `searchCatalog` (2) and `fetchFacetData` (2) in parallel = 6. `/category/[slug]`: `fetchCategoryBySlug` (1), then in parallel `searchCatalog` (2), `fetchCategories` (2), `fetchFacetData` (2) and `loadSEOTagsServiceConfig` = about 8. Well under 20.
- **Plan review:** a general-purpose subagent reviewed the plan against the code and found 2 blockers. Both are fixed above:
  - the count ignored the search (now a one-line kit fix);
  - `$referrer` wasn't masked (now handled in `before_send`).

  Its other fixes are applied too:
  - facets server-rendered, with dots `aria-disabled` until the store's own facets load;
  - no dimming on page load;
  - the error state checked before the empty states;
  - per-thumb slider names, value text and clamping;
  - an image fallback that also catches failures before hydration;
  - a fallback dot for a missing color code, a defined `scope` prop and copy for an unknown total;
  - type-only imports in `shop-url.ts`.

  It confirmed the URL keys, the per-facet grouping, bare-id filtering, `start()` re-querying, matching server and first client renders, and the sub-request counts.

## Context

- Skills: `wix-headless-kit` (SKILL.md) and the storefront playbook `wix-headless-templates/storefront/INSTRUCTIONS.md` (contracts for `useShop`, `ProductSummary`, `Category`, `Facet`; the shop and category page skeletons with the SEO machinery; hard rules).
- Code read: `src/wix/storefront/shop-store.ts` (URL keys `min`, `max`, `stock`, `q`, `choice`, `sort`, `category`; `replaceState` after each change; `start()` revalidates the seed), `src/hooks/storefront/useShop.ts`, `src/wix/storefront/catalog.ts` (`searchCatalog` returns `{ products, nextCursor, hasMore, total }`; `fetchCategories`; `fetchCategoryBySlug`), `catalog-core.ts` (`catalogFilter`, `CatalogSearchOptions`, `FacetSelection`), `types.ts`, `src/components/ui/ProductCard.astro`, `Photo.astro`, `IconButton.astro`, `TextField.astro`, `NewsletterForm.astro` (field + dark button pattern), `src/layouts/SiteLayout.astro`, `SiteNav.astro`, `src/pages/index.astro`, `src/styles/global.css`, `src/styles/site.css`, `src/scripts/analytics.ts`, `src/components/PostHog.astro`, `.seed/category-tree-result.json`, `.seed/seed-result.json`.
- Docs: [Query Categories](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/categories/query-categories.md) (`itemCounter`: items directly in the category, returned by default), [Search Products](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/search-products.md). posthog-js 1.444.0 config types (`mask_personal_data_properties`, `custom_personal_data_properties`).
- Versions: `astro ^7.3.2`, `@astrojs/react ^6.0.6`, `react 18.3.1`, `@lucide/astro 1.61.0`, `posthog-js 1.444.0`; `lucide-react` latest is 1.66.0.
- Builds on plan 07 (catalog, category tree: Sports `e15d663c…` with Lifestyle, Running, Basketball, Skate, Training; Men, Women, Kids, New Arrivals, Popular top-level), plan 06 (`track()`), plan 03 (card and header).

## The design

Canvas 1055px wide; I treat it as a downscaled 1440px page (×1.365), the lesson from plan 03. Every size below is that estimate at 1440, tuned in the screenshot loop.

**Layout.** White page. Left sidebar ≈ 290px wide with a 1px light-grey right border running the page height; text inset ≈ 53px (aligned with the logo). Main column starts ≈ 33px after the border and ends aligned with the header's account icon.

**Sidebar, top to bottom.**
1. "SNEAKER'S" heading: condensed uppercase, ≈ 36px, weight 600, black.
2. Category list, ≈ 58px line pitch, starting ≈ 53px below the heading. Items condensed uppercase ≈ 21px weight 500 in grey with the count in parentheses ("RUNNING (320)"). The active item ("LIFESTYLE (632)") is black, weight 600, indented ≈ 23px, with a 2px light-grey vertical bar ≈ 31px tall at the list's left edge.
3. ≈ 95px gap, then "FILTER" heading (same style as 1).
4. "PRICE" label: condensed uppercase ≈ 20px weight 600, black.
5. "$40" left and "$450" right in grey ≈ 19px; under them a 2px black track ≈ 198px wide with two black round thumbs ≈ 15px at the ends.
6. "COLOR" label (same as 4), then 15 round dots ≈ 27px in 5 columns, ≈ 15px column gap and ≈ 22px row gap; light dots have a faint border.

**Main column.**
1. Headline "632 LIFESTYLE SNEAKERS": condensed uppercase ≈ 64px, weight 600, black, top-aligned with the sidebar heading.
2. Search, right-aligned on the headline row: a light-grey filled field ≈ 358 × 68px with "SEARCH" placeholder (condensed uppercase ≈ 24px, grey), joined to a black square button ≈ 75 × 68px holding a white search icon. Square corners (≈ 2px).
3. Grid: 3 columns, ≈ 33px column gap, ≈ 41px row gap, starting ≈ 68px under the headline.
4. Card: a square image tile with square corners on a pastel background (the photo's own). A black bag button ≈ 64 × 60px, radius ≈ 2px, white bag icon ≈ 24px, flush to the image's right edge and ≈ 20px above its bottom. ≈ 22px below the image: the name (condensed uppercase ≈ 22px, weight 500) left and the price (≈ 22px, weight 600) right on one row. Under them stars and "(1,248)" (dropped: no source).

**Header** (shared, unchanged): logo left; MEN (active, bold black), WOMEN, KIDS, CUSTOMIZE, MEMBERS centered in grey; bag and account icons right.

## Approach

**Data flow.**

```
/shop.astro                                   /category/[slug].astro
  fetchCategories() → sports (by slug)          fetchCategoryBySlug(slug) → 404 page when null
  parseShopUrl(Astro.url.searchParams)          then in parallel: searchCatalog({ categoryId, ...url }),
  in parallel: searchCatalog({ limit: 24,         fetchCategories(), fetchFacetData({ categoryId }),
    categoryId: sports.id, ...url }),             loadSEOTagsServiceConfig(...)
    fetchFacetData({ categoryId: sports.id })   <SEO.Tags> + wixMetadata exactly as the kit skeleton
        │                                               │
        └──────────── <ShopView client:load ...> ◄──────┘
             initialProducts (undefined if the read failed), initialCategories,
             initialCategoryId, initialTotal, initialFacetData, urlState,
             scope { slug, label: { one, many } }
             │
             useShop(...)  (kit: query, URL sync via replaceState, facets, price range, paging)
             ├─ sidebar: CategoryNav (Sports' children), RangeSlider, ColorDot × n
             ├─ headline + SearchField
             └─ grid: ProductCard × n | skeletons | empty | no-match | error; Load more
```

`ShopView` calls `setFilters({ ...filters, minPrice, maxPrice })`, `setFilters({ ...filters, search })`, `toggleChoice(id)` and `clearFilters()`, and calls `track('catalog_filtered', …)` after each (and on a category link click, with `{ beacon: true }`).

**Owners.** Catalog, counts, prices, facets: Wix Stores through the kit's `catalog.ts` and `useShop`. URL state: the kit's `shop-store.ts`. Rendering: our React primitives. Analytics: PostHog through `track()`.

**New tokens** (in `global.css` `:root`, next to `--ds-option-swatch`):
- `--ds-filter-swatch: 28px` (color filter dot)
- `--ds-range-thumb: 15px`, `--ds-range-track: 2px` (price slider)
- `--ds-busy-opacity: .5` (dimmed grid while a query runs)

Every color maps to an existing token: field fill `--color-muted-fill`, inactive category and slider labels `--color-text-secondary`, active bar `--color-state-disabled`, sidebar border `--color-border`, track, thumbs and buttons `--color-black`, skeleton tiles `--color-muted-fill`, swatch border as `.ds-color-option` (`rgb(17 17 17 / 12%)`, moved into the new primitive), radii `--radius-xs`. Tile tones while an image loads cycle `beige, aqua, rose, mint, peach, periwinkle, lilac, coral` from `tones.ts`. Swatch fill is the data's hex, passed as `--swatch-color` (data, not a design value).

**New primitive classes** (styles in `global.css`, sizes with `clamp()` so desktop values shrink with the viewport):
- `ui-product-card--listing`: square image with no radius, name and price on one wrapping row, the bag flush right. Shared `ui-product-card__*` classes otherwise.
- `ui-product-card--skeleton`: a muted square and two muted text bars.
- `ui-filter-heading` (SNEAKERS, FILTER), `ui-filter-label` (PRICE, COLOR)
- `ui-category-nav` (list, counts, `[aria-current="page"]` bar and indent; a `--row` modifier for the phone's scrolling row)
- `ui-range` (two overlaid range inputs: transparent tracks, pointer events only on thumbs, a styled track between the thumbs, `:focus-visible` ring on the thumb)
- `ui-color-dot` (`[aria-pressed="true"]` ring as `.ds-color-option`)
- `ui-search-field` (`ui-field` filled with `--color-muted-fill`, no border, joined to a `ui-icon-button--dark` square)
- `ui-page-title` (the headline)
- `ui-busy` (`[aria-busy="true"]` → `--ds-busy-opacity`, transition `--ds-motion-base`)

**Page layout** (`site.css`, sizes and grids only): `.explore` (container `min(var(--site-wide-max), 100% - 2 * var(--site-wide-inset))`, grid `clamp(220px, 20.2vw, 290px) 1fr`), `.explore__sidebar` (border-right, padding-left as the header bar's `clamp(16px, 2.6vw, 37px)`), `.explore__main`, `.explore__head` (headline and search row), `.explore__grid` (3 columns ≥ 1024px, 2 below), `.explore__filters-toggle` (phone only), plus the 1023px and 767px breakpoints described in Decisions.

## Steps

Each step ends with `npm run check` passing and a commit.

- [x] 1. **Dependency and tokens.** `npm install lucide-react@^1.61.0`. Add the new tokens and primitive styles to `global.css`. (check: `npm ls lucide-react` shows one version; `npm run check` passes.)
- [x] 2. **React primitives** in `src/components/ui/`. Add a keep-in-step comment to `ProductCard.astro`. (check: `npm run check`.)
  - `ProductCard.tsx`: props `product`, `tone`; the listing look; exports `ProductCardSkeleton`. The image fallback works like `Photo.astro`'s: `onError`, plus an effect that checks `complete && naturalWidth === 0` for failures before hydration.
  - `RangeSlider.tsx`: props `min`, `max`, `value: [lo, hi]`, `onCommit([lo, hi])`, `format`; the thumb names, value text and clamping from Decisions.
  - `ColorDot.tsx`: props `name`, `hex: string | null`, `count`, `pressed`, `pending`, `onToggle`. `pending` renders `aria-disabled`.
  - `SearchField.tsx`: a `<form role="search">`; props `defaultValue`, `onSubmit(text)`.
  - `CategoryNav.tsx`: props `items: { label, href, count, current }[]`, `onNavigate`.
- [x] 3. **Kit count fix.** Confirm the Count Products `search` field once more with `wix-docs`, then change the one call in `catalog.ts` as Decisions says. (check: `npm run check`; in step 7, `/shop?q=orbit` shows "1 Sneaker".)
- [x] 4. **URL parser.** `src/wix/storefront/shop-url.ts` exports `parseShopUrl(params: URLSearchParams)` → `{ minPrice?, maxPrice?, search?, inStockOnly?, facetSelections: FacetSelection[], choiceIds: string[] }`. It mirrors `shop-store.ts`'s `readUrlState` and copies its `decodeChoice`, which isn't exported. Type-only imports (`import type`), so it runs under plain Node with no Wix SDK. (check: `node --experimental-strip-types` on a scratch script prints the expected result for `?min=100&max=200&q=orbit&choice=option:F1:C1&choice=option:F1:C2&choice=C3`: two selections, F1 with C1 and C2, and C3 as an option pick with an empty facet id.)

  The store groups picks by `${kind}:${facetId}` (`facetSelections()`), and `catalogFilter` builds each condition from `kind` and `choiceIds` only, so a bare id (empty facet id) still filters, OR-ed with other bare ids. The parser groups the same way, so server and client send the same filter. It doesn't expand linked child choices (the store does once facets load); Kix colors have none.
- [x] 5. **Analytics.** Add `catalog_filtered: { filter: 'category' | 'price' | 'color' | 'search' | 'clear'; category: string }` to `AnalyticsEvents`. In `PostHog.astro`, add `mask_personal_data_properties: true` and `custom_personal_data_properties: ['q']` to `posthog.init`, and extend `before_send` with the referrer and URL masking from Decisions. (check: `npm run check`.)
- [x] 6. **`ShopView.tsx`** in `src/components/storefront/`, as described in Approach and Decisions: hooks first, then branches (error before empty); nothing in the render path throws. (check: `npm run check`.)
- [x] 7. **Pages.** `src/pages/shop.astro` and `src/pages/category/[slug].astro` per the kit skeletons' frontmatter: a guarded `try`, and the SEO pieces exact on the category page. Add the URL parse, `fetchFacetData`, `initialTotal`, `scope`, the 404 page, and the `[shop]`/`[category]` server logs. (check, against the dev server on 4321:
  - `curl -s localhost:4321/shop` contains "Kix Court 1 Retro", "12 Sneakers", color dot names and "Minimum price", and no "Baseball Cap" and no `aria-busy="true"`;
  - `/category/lifestyle` contains 4 product names and "4 Lifestyle Sneakers";
  - `/category/men` contains "6 Men's Sneakers" and 6 names;
  - `/shop?q=orbit` server HTML contains "Kix Orbit High", no other product names, and "1 Sneaker";
  - `/shop?min=150` server HTML contains no product under $150;
  - `curl -s -o /dev/null -w '%{http_code}' localhost:4321/category/nope` prints 404.)
- [ ] 8. **Behaviour in the browser** (Claude in Chrome, `localhost:4321`):
  - click a color: the URL gains `choice=`, the grid and count update, the dot shows pressed;
  - drag and release a price thumb, then use arrow keys: the URL gains `min`/`max` and the grid updates;
  - search "court": the URL gains `q=court`; an empty search removes it;
  - reload the filtered URL and open it in a new tab: the same grid, controls and count from the first paint, no dimming, and no hydration warning in the console;
  - click a dot right after load, before the store's facets arrive: it's announced as unavailable and nothing breaks; once they load it works;
  - a filter that matches nothing shows "No sneakers match these filters." and Clear filters restores the grid;
  - sidebar links go to `/category/<slug>` with the right item marked;
  - force failures by temporary edits, reverted after each: `searchCatalog` throwing in the page (skeletons, then the client grid) and in the client (error state with Try again).
- [ ] 9. **Analytics check.** With `?__posthog_debug=true` and the browser console:
  - one `catalog_filtered` per action, with the expected `filter` and `category`;
  - on a page with `?q=court`, the `$pageview` and `catalog_filtered` events carry `q=<MASKED>` in `$current_url`;
  - after following a link from `/shop?q=court` to another page, `$referrer` (and `$initial_referrer` in a fresh session) carry `q=<MASKED>`;
  - no event property anywhere contains "court".

  If PostHog isn't configured locally, say so and leave this unchecked.
- [ ] 10. **Design comparison** at 1440px and 390px (390 through a same-origin iframe, scrolled so lazy images load), side by side with the design. List every difference, fix, repeat. Also check 1024px and 768px for layout breaks.
- [ ] 11. **Final checks and review.** `npm run check` and `npm run build`; a reviewer subagent compares the work with this plan; fix real gaps.
- [ ] 12. **Close out.** Write Result, set `Status: done`, update the index, propose AGENTS.md edits, and ask about releasing.

## Files

- Create: `src/pages/shop.astro`, `src/pages/category/[slug].astro`, `src/components/storefront/ShopView.tsx`, `src/components/ui/{ProductCard,RangeSlider,ColorDot,SearchField,CategoryNav}.tsx`, `src/wix/storefront/shop-url.ts`
- Change: `src/styles/global.css` (tokens, primitives), `src/styles/site.css` (explore layout), `src/scripts/analytics.ts` (event), `src/components/PostHog.astro` (URL and referrer masking), `src/wix/storefront/catalog.ts` (the one-line count fix), `src/components/ui/ProductCard.astro` (keep-in-step comment), `package.json` and `package-lock.json` (`lucide-react`), `prompts/README.md`
- Unchanged: every other kit file under `src/wix/storefront/`, `src/hooks/storefront/`, `src/components/storefront/{FilterPanel,QuickAdd,OptionPicker,CartButton,CartDrawer}.tsx`

## Acceptance criteria

- WHEN a shopper opens `/shop` THE SITE SHALL list every product under Sports from Wix, with "{n} Sneakers" where n is Wix's count, and no Wix sample products.
- WHEN a shopper opens `/category/<slug>` for a visible category THE SITE SHALL list that category's products under its headline, with the kit's owner-editable SEO tags; for an unknown slug it SHALL answer 404 with a not-found message and a link to `/shop`.
- THE SIDEBAR SHALL list All and Sports' children in Wix's order, each with Wix's product count, as links, with the current one marked.
- WHEN a shopper picks colors, sets a price range or submits a search THE GRID SHALL re-query Wix across the whole scope, the headline count SHALL match the cards (search included), and the URL SHALL hold the selection.
- WHEN a shopper opens a URL holding a selection THE SERVER SHALL render the filtered grid, the color dots and the price slider, and THE CONTROLS SHALL show that selection before and after hydration, with no dimmed grid on load.
- WHEN nothing matches THE PAGE SHALL say so and offer Clear filters; WHEN a read fails THE PAGE SHALL show an error with Try again (never an empty-state message); WHILE a shopper's change is loading THE GRID SHALL stay visible and dimmed.
- THE CARD SHALL show the photo, every ribbon, the name, the DTO's price display (From, range, or price with a labelled struck "was") and a bag link to the product page, and SHALL show no stars or review counts.
- WHEN a filter changes THE SITE SHALL send one `catalog_filtered` event without the search text, and no PostHog URL property SHALL contain the search text.
- AT 390px THE PAGE SHALL show the headline, search, a scrolling category row, a Filters toggle and a 2-column grid, with no horizontal page scroll.

## Verification

- Command output: `npm ls lucide-react`, `npm run check`, `npm run build`, the parser script, the `curl` checks in step 7.
- Screenshots: 1440 and 390 beside the design (filtered and unfiltered), 1024 and 768; the empty, no-match, error and loading states; a 404.
- Browser: URL before and after each control; a reloaded shared URL.
- PostHog: console debug lines for `catalog_filtered` and `$pageview` with the masked `q`.
- Report which values are estimated from the image (all sizes in "The design").

## Risks and open questions

- **First React island.** `@astrojs/react` is configured but no page mounts an island yet; a hydration mismatch would show in the console. The `ready` flag keeps the first client render identical to the server's.
- **Shared links carry ids.** The kit's `choice=option:<facetId>:<choiceId>` format is long and not human-readable, but it's stable and the store owns it. Prettier color slugs would mean rewriting the store's URL code.
- **PostHog's live SDK** comes from the PostHog host (`/static/array.js`), not the npm 1.444.0 copy we read. The masking options exist in both, and step 9 checks the events actually sent.
- **A kit file changes.** Re-deploying the kit's `catalog.ts` would undo the count fix; the comment in the file says so.
- **Counts across genders.** On `/category/men`, sport counts are totals for all genders, as chosen.
- **Wix sample products** remain in the store and reach `/category/all-products` if anyone opens it. The owner deletes them at Products in the dashboard.
- **No credits or money** are spent. One new dependency (`lucide-react`).

## Result

Filled at close-out.
