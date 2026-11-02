# 09 · Product page: gallery, color and size pickers, add to cart, details and recommendations

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Build the product page from the attached design using real Wix data from the storefront part of the wix headless kit skill. Include the photo gallery, color and size pickers, add to cart, the detail sections and the recommendations. Show the 3D button and the 3D View thumbnail but keep them disabled for now."

Attached design: product page, 866 × 1815 px. Described in full under "The design" below.

## Goal

A shopper opens `/products/<slug>` from any card and sees one Kix sneaker from Wix Stores. They can flip through its photos, open a photo full screen, pick a color (the photo follows) and a size, and add that exact variant to their Wix cart. The page confirms the add inline, and the header bag shows the live item count. Below, the page shows store info (shipping, returns, checkout), About This Product (the description and the "Features" list), Product Details (colorways, materials, care), Fit & Sizing (the size range), Shipping & Returns, and You Might Also Like (up to 4 sneakers from the same sport, then the same gender). The 3D button, the 3D View thumbnail and the wishlist heart are visible but disabled. The server renders the whole page with the owner-editable SEO tags. An unknown slug gets a real 404 page.

## Out of scope

- The cart drawer and cart page (user's choice: inline confirmation now). The header bag still links to `/cart`, which 404s until the cart plan.
- 3D viewing and the wishlist. Both controls render disabled (user's choice).
- Reviews and ratings: the stars under the price, the stars on recommendation cards, and the whole Customer Reviews block with Write a Review. There's no source (plan 07's data map).
- Size Guide and Learn More links. Those pages don't exist.
- The quantity stepper. The design has none, so every add is 1 pair (the kit's default).
- Purchase extras our catalog doesn't use: modifiers, subscription plans and notify-me. See Risks.
- Breadcrumbs. The design has none, and every product's main category is Wix's "All Products", so the trail would read Home › All Products.
- Release. Verification is local, as in plans 07 and 08.

## Decisions

- **After Add to Cart (user): an inline confirmation.** Under the button: "Added to your bag." (`role="status"`), or our own error copy "We couldn't add this to your bag. Try again." We never show the kit's error text. The kit's `add()` also sets the cart store's `open: true`. With no drawer mounted, nothing renders it. When the cart plan mounts the drawer, it opens after each add with no change here.
- **Header bag count (user, part of the same choice).** A small React island, `BagButton.tsx`, mounted `client:only="react"` in `SiteLayout`. It uses the kit's `useCart()` and renders the same `IconButton` markup as today, plus a count badge when `itemCount > 0` (`useCart()` returns `itemCount` at the top level). The accessible name is "Bag, 2 items". Its server fallback is today's plain bag link, so the header never jumps. It reads the cart once per page load, like the kit's `CartButton`.
- **Wishlist heart (user): visible, disabled.** A square icon button with `aria-disabled="true"`. It stays focusable and has the tooltip and accessible name "Wishlist coming soon". It does nothing on click.
- **3D button and 3D View thumbnail (request): visible, disabled.** Both use `aria-disabled="true"` and stay focusable, with the tooltip "3D view coming soon". The 3D pill sits bottom-centre on the main photo. The 3D View tile is the last item in the thumbnail strip: a muted tile with the `Rotate3d` icon and the label "3D View".
- **Policy copy (user): neutral, no numbers, no links.**
  - Perk strip:
    - Truck: "Shipping" / "Calculated at checkout"
    - RotateCcw: "Returns" / "Per our store policy"
    - Lock: "Secure Checkout" / "Hosted by Wix"
  - Fit & Sizing (Footprints icon): "Available in sizes {first} to {last}.", from the product's Size choices ("7 to 12", "1Y to 7Y"). It makes no fit claim. Hidden when the product has no Size option.
  - Shipping & Returns (Truck icon): "Shipping is calculated at checkout. Returns follow our store policy."
- **Purchase controls are ours, on the kit's `useProductDetail`, not the kit's `OptionPicker`.** The kit says to wire `OptionPicker` as-is. AGENTS.md says kit UI is used only where it matches the design, and `OptionPicker` doesn't match: small pills, a full-width red button, no heart, and uppercase grey legends. This is the same call plan 08 made for `FilterPanel`. All selection, variant resolution, availability and add logic stays in the kit's store. We render `d.optionGroups`, call `d.selectOption(group.id, choice.choiceId)`, gate on `d.canAdd`, show `d.blockedReason`, and call `d.add()`.
- **Nothing is pre-selected (kit rule).** Selections start empty, so nobody buys a colour they never noticed. The label reads "Color:" with the picked name after it, as in the design ("Color: Black / Crimson"). Until a pick, it reads "Color" alone.
- **Add to Cart looks enabled, and the hook still gates it.** The design shows a black button, so it stays black, with `aria-disabled="true"` while `!d.canAdd`. A click then calls nothing on the store (the store's `add()` would return silently anyway). It moves focus to the first enabled choice button of the first group with no pick. Under the button, `d.blockedReason` ("Choose Color and Size") shows in neutral secondary text whenever it is set. While `d.adding` the button reads "Adding…" with `aria-disabled="true"` and `aria-busy="true"`, not `disabled`, so keyboard focus stays on it, and a second click does nothing. It reads "Pre-order" when `d.isPreorder` and shows `d.preorderMessage` under it. "Only {n} left" shows when `d.remaining` is 1–10, which never happens while stock is untracked. "Added to your bag." and the error copy clear on the next pick or add.
- **Option group markup.** Each group is a `<fieldset>` whose `<legend>` holds "Color:" with the picked name, or "Size". Every choice is a `<button type="button" aria-pressed>` named by the choice name: the swatch through `aria-label` (with the name as `title` too), the size by its text. Unavailable choices (`!inStock || !exists`) are `disabled`, dimmed and, for sizes, struck through, and their names add ", unavailable". This is the kit's rule, restyled.
- **The gallery.** It keeps one `activeIndex` into `product.gallery`, starting at 0. The main photo is always `gallery[activeIndex]`. When `d.imageUrl` changes to a non-null value, an effect sets `activeIndex` to the gallery item with the same `mediaKey()` (from `src/wix/media.ts`). Both URLs come from the same `imgSrc(…, 1200, 1200)` in `catalog-core.ts`, so they should match. If none matches, the main photo shows `d.imageUrl` until the shopper next uses a thumbnail or arrow. So thumbnails and arrows keep working after a color pick, and every photo stays reachable (a kit rule).
  - Thumbnails list `product.gallery` in order (2 per sneaker today: one per colorway), then the 3D View tile.
  - Each photo thumbnail is an `aria-pressed` button named "Show photo {n} of {total}".
  - The prev/next arrows are named "Previous photo" and "Next photo", step through the gallery with wraparound, and hide for a single photo.
  - The main photo's alt text is "{name}, photo {n} of {total}". `gallery` holds bare URLs with no alt text.
- **Disabled 3D controls.** The 3D pill and the 3D View tile are named "3D view, coming soon". The tile has no `aria-pressed`.
- **Main photo frame is square, not the design's portrait.** Every Wix photo is 1024 × 1024. The design's frame (≈ 667 × 860 at 1440) would crop about 22% off the sides of a square shoe photo. So the frame takes `aspect-ratio: 1`, at about 667px. The info column may run taller than the photo, which is fine. Thumbnails keep the design system's 0.92 ratio with `object-fit: cover` (about 4% cropped).
- **Expand opens a lightbox.** A native `<dialog>` (`showModal()`, so Escape and the focus trap are built in) labelled "{name} photo" shows the current photo at up to 90vw × 90vh. It has a close button ("Close photo"), closes on a backdrop click, locks background scroll while open (the kit's overlay rule), and returns focus to the expand button.
- **Eyebrow.** "Men's Shoe", "Women's Shoe" or "Kids' Shoe", from the product's `categoryIds` matched to the `men`, `women` and `kids` categories. Hidden when none matches or the category read failed.
- **Ribbons.** Every `product.ribbons` entry renders beside the price in the design's badge look (`ui-badge--sale`: pink fill, red text). The design's computed "16% OFF" becomes the merchant's ribbon ("Sale"), as plan 07 decided, because the kit forbids computed percentages. This is a deliberate exception: cards keep `ui-badge--new` (red fill, from the home design). Each surface uses one style for all of its ribbons, as the kit asks, so "New" on Court 1 Retro looks different on its card and on its page.
- **Price.** `d.price` with `d.compareAtPrice` struck and labelled "Was", then `d.pricePerUnit` when set, then `product.discountNames` under the row when present (none today; a kit contract). Wix formats prices as "$189.00" (the design shows "$185"). That's the same accepted difference as plans 07 and 08.
- **Description split.** `descriptionHtml` is `<p>` blocks (2 per product). The first renders under the price, as the design's short description. The rest render in About This Product. If there's only one paragraph, About shows no paragraph. The section hides when it has neither text nor features. Merchant HTML renders as HTML (`set:html` / `dangerouslySetInnerHTML`), per the kit contract. Wix rich text allows only `<p>`, `<br>`, `<strong>`, `<em>`.
- **Feature list.** The "Features" info section, one item per `<p>`, as plain text. The design gives each row its own icon, and our data has none. Every row uses one icon (`Check`) rather than icons guessed from the text.
- **Product Details rows, only those with data.**

  | Row | Source |
  | --- | --- |
  | Colorway | every Color choice name, joined with " · " |
  | Material | "Materials" info section, plain text |
  | Product Care | "Care" info section, plain text |
  | One row per other info section | its title and plain text (none today) |

  Style, SKU and Origin are dropped: every variant's `sku` is null (probed on 3 products), and Origin has no source. When the owner adds SKUs, a later change can show the picked variant's SKU.
- **You Might Also Like.** The page finds the product's sport category (a child of `sports`) and its gender category among `categoryIds`. It reads both lists in parallel with `fetchProductsByCategory(id, { limit: 5 })`, keeps sport first, removes duplicates and the product itself, and takes 4. Today that gives 4 for every sneaker except Mini Court (3: the Lifestyle sport, while the Kids category holds only itself). The section hides when the list is empty. "View All" links to `/category/<sport slug>`, or the gender slug when there's no sport. Cards are `ProductCard.astro` in a new `wide` size: the compact card with the design's landscape image (aspect ≈ 1.41) and no stars. `wide` is Astro-only on purpose: recommendations render on the server, and `ProductCard.tsx` only renders the listing size. A comment in both files says so. Tones cycle `mint, peach, periwinkle, lilac`, the design's order (`tones.ts` already has them).
- **One island, server-rendered sections.** `ProductView.tsx` (`client:load`, `initial={product}`) holds the gallery and the buy column, the only interactive parts. The perk strip, About, Product Details, Fit & Sizing, Shipping & Returns and the recommendations are Astro on the server, so they ship no JS. The eyebrow and the short description are server-computed and passed to the island as props. Every hook runs before any branch (a kit hard rule).
- **DOM structure of the top section.**
  - `ProductView`'s root element is the `.pdp__top` grid.
  - `ProductGallery`'s root uses `display: contents`, so its rail (`.ui-gallery__rail`) and frame (`.ui-gallery__frame`) become grid items in named areas (`rail photo buy` on desktop).
  - The buy column (`.pdp__buy`) is one flex column. Its direct children are, in order: eyebrow, name, price row, summary, Color group, Size group, buy row, status line.
  - Because they are siblings, CSS `order` can move the summary after the buy row on phones.
- **Desktop first screen.** The kit asks for the image, name, price, first choice and button with its reason in the first screen on desktop too. With a 118px header and the design's spacing, the buy row would end around 930px. So the gap under the header and the spacing in the buy column are tightened until the Add to Cart button is fully visible in a 1440 × 900 window. Step 8 checks it, and the differences from the design are listed.
- **Analytics.** One new event, `product_added_to_cart: { product_id: string }`, sent after a successful `add()`. The product ID is a catalog ID, not personal data. A failed add calls `captureError(error, 'cart_add')`, a new `ErrorArea`. No events for the disabled controls.
- **Phone layout (under 768px).** One column, in this order:
  1. The main photo: square, with its height capped at 38vh so it stays a bounded band.
  2. Thumbnails as a scrolling row of 56px tiles under the photo, the 3D View tile included.
  3. The eyebrow, name, price and ribbons.
  4. Color, then Size.
  5. The buy row.
  6. The short description, moved after the buy row by CSS `order`. This follows the kit rule that a phone shows image, name, price, the first choice and the button before the copy.

  The buy row is `position: sticky; bottom: 0` with the page background and a top border. It stays on screen while the buy column is in view. The phone header is ≈ 100px tall (two rows), so the first-screen check uses a real phone's visible area, 390 × 664 (Safari with its bars), not 390 × 844. The photo, name, price, Color swatches and the sticky button must all be visible there. If they don't fit after tightening the spacing, stop and ask; don't drop elements unasked. The arrows and the expand button are 44px. Size pills are 44px tall in 5 columns. Swatches are 44px. Sections below stack: perk cards one per row, About then the feature list, Details then Fit and Shipping, with horizontal dividers in place of the vertical ones. Recommendations use 2 columns.
- **Tablet (768–1023px).** The photo and buy column sit side by side (`1fr 1fr`), with the thumbnails as a row under the photo. Lower sections stack as on phones. Recommendations use 2 columns.
- **Not found.** `fetchProductBySlug` returns null both for a missing slug and for a failed read (it swallows errors). The page logs `[product] not found or read failed: <slug>` and answers 404, with SiteLayout, "This sneaker doesn't exist.", "It may have sold out or moved." and a "See all sneakers" button to `/shop`. This matches plan 08's category 404, not the kit skeleton's bare `Response`.
- **Server sub-requests.** `fetchProductBySlug` (1), `loadSEOTagsServiceConfig` (1–2) and `fetchCategories` (2) run in parallel. Then the two recommendation lists run in parallel (2 each). That's about 9 in total, well under 20.
- **Server reads and failures.**
  - Every read uses `Promise.allSettled`. A failed side read hides only its own part.
  - SEO: unlike the kit skeleton's `Promise.all`, a failed SEO read doesn't turn the product into a 404. It is logged (`[product] SEO tags read failed`), and `<SEO.Tags>` renders only when the config is non-null, falling back to SiteLayout's `<title>`. This matches `category/[slug].astro`. `wixMetadata` and `loadSEOTagsServiceConfig` (`STORES_PRODUCT`, `itemData: { slug }`, the `x-wix-forwarded-url` page URL) are otherwise exactly as the skeleton.
  - Categories: `fetchCategories` swallows its errors and returns `[]`, so an empty list is the failure signal. It logs `[product] categories read failed`, the eyebrow hides, and the recommendations hide.
  - Recommendations: a rejected list logs `[product] recommendations read failed` and the other list is still used.
- **Info sections data fix (user, during step 2).** Building step 2 showed that all 12 sneakers shared one "Features" and one "Materials" section, both holding Court 1 Retro's copy. The kit's seed derives `uniqueName` from the title (`seed-store.mjs` `buildInfoSections`), so every product's sections collapsed into the first product's. The user chose to fix the data. `.seed/info-sections.mjs` (git-ignored, like plan 07's scripts) does it in two documented calls per product: Get Or Create Info Section with `uniqueName` `<slug>-features` / `<slug>-materials` (titles unchanged, copy from `.seed/store-plan.json`), then Update Product (`revision`, the full `infoSections` array: Features, Materials, the shared Care). Nothing was deleted: the old shared sections remain, unassigned. The result is in `.seed/info-sections-result.json`.
- **Plan review.** A general-purpose subagent reviewed this plan against the kit code. It confirmed:
  - the `blockedReason` wording;
  - that `add()` rethrows, and that `addLine` opens the cart on failure too;
  - that `useCart` works as `client:only` and the two islands share one cart store;
  - the sub-request count;
  - the recommendation counts;
  - Astro's fallback slot.

  It found 2 blockers, both fixed above:
  - the gallery was stuck on the picked color's photo (now one `activeIndex` synced through `mediaKey()`);
  - the 390px first screen was untested against a real phone's visible area (now 390 × 664, a 38vh photo and 56px thumbnails).

  Its other fixes are applied too:
  - SEO with `allSettled`;
  - logging an empty category list;
  - the grid and DOM structure;
  - the desktop first screen;
  - focus kept during an add;
  - the accessibility details;
  - `discountNames`;
  - the ribbon-style exception;
  - `wide` being Astro-only;
  - the 404-on-outage risk.

## Context

- Skills: `wix-headless-kit` 1.35.0 (SKILL.md) and its storefront playbook `wix-headless-templates/storefront/INSTRUCTIONS.md`: the PDP skeleton with `wixMetadata`, `loadSEOTagsServiceConfig` (`seoTags.ItemType.STORES_PRODUCT`) and `<SEO.Tags>`, the `useProductDetail` contract, "What a complete storefront shows" and the hard rules.
- Code read: `src/wix/storefront/product-detail-store.ts` (selection, `imageUrl`, `canAdd`, `blockedReason`, `add()` → `addLine`), `src/hooks/storefront/useProductDetail.ts`, `src/wix/storefront/types.ts` (`ProductDetail`, `OptionGroupView`), `catalog.ts` (`fetchProductBySlug` swallows errors to null; `fetchProductsByCategory` = `searchCatalog`, 2 sub-requests), `catalog-core.ts` (`DETAIL_FIELDS`), `cart-store.ts` (`addLine` sets `open: true` after every add), `src/components/storefront/OptionPicker.tsx`, `ShopView.tsx`, `explore.ts`, `src/pages/category/[slug].astro` (SEO and 404 pattern), `src/layouts/SiteLayout.astro`, `src/components/ui/{ProductCard.astro,ProductCard.tsx,PerkCard.astro,SectionHeading.astro,Thumbnail.astro,Badge.astro,Button.astro,IconButton.astro}`, `src/pages/design-system.astro` (Thumbnails and Selectors panels), `src/styles/global.css`, `src/styles/site.css`, `src/scripts/analytics.ts`.
- Live data, probed with a visitor token and `GET /stores/v3/products/slug/{slug}` with the kit's `DETAIL_FIELDS`, as the kit's REST twin does, on Court 1 Retro, Nightshift High, Pacer 2 and Mini Court:
  - 2 photos each, 1024 × 1024
  - info sections Features, Materials and Care
  - 20 variants (14 for Mini Court), all with a null `sku`
  - main category is All Products
  - 3–4 direct categories
  - `compareAtPrice` "$220.00" on Nightshift High
- Builds on plan 07 (catalog, data map for this page), plan 08 (React island pattern, `ProductCard.tsx`, the category page's SEO and 404 handling, `lucide-react`), plan 06 (`track()`, `captureError`) and plan 02 (thumbnail, color and size specimens).

## The design

Canvas 866px wide. I treat it as a downscaled 1440px page (×1.663). Every size below is that estimate at 1440, tuned in the screenshot loop. Page background is near-white (`--color-panel`).

**Header** (shared, unchanged): MEN active. Same accepted differences as plan 08.

**Top section** (content aligned with the header's logo and account icon, ≈ 70px under the header):
1. **Thumbnail rail**, left: 6 tiles ≈ 123 × 133px (ratio 0.92), ≈ 13px apart, radius ≈ 6px, photo cover. No visible selected state in the design; we use the design system's 2px black border for `aria-pressed`.
2. **Main photo** ≈ 32px right of the rail: ≈ 667px wide, radius ≈ 6px, the photo's own beige background. Its controls:
   - Expand: top-right, ≈ 33px inset. A white square ≈ 40px, radius ≈ 4px, with the `Maximize` icon.
   - Prev and next: round white buttons ≈ 52px, vertically centred, ≈ 27px from each edge, with the chevron icons and the arrow shadow.
   - 3D pill: bottom-centre, ≈ 27px up. White, pill radius, ≈ 116 × 53px, with an icon and "3D" in the display face, bold, ≈ 20px.
3. **Buy column** ≈ 47px right of the photo, ≈ 471px wide, top-aligned with the photo:
   - Eyebrow "Men's Shoe": sans, ≈ 16px, black.
   - Name: display face, uppercase, ≈ 46px, weight 700, line-height ≈ 1.15. It wraps to 2 lines in the design.
   - Price row, ≈ 20px below: price in the display face ≈ 40px weight 600. The struck was-price is grey, ≈ 28px. The badge (pink fill, red text) sits ≈ 30px after.
   - Stars and count: dropped.
   - Short description: sans ≈ 18px, line-height ≈ 1.6, grey, max ≈ 420px.
   - "Color: <name>", ≈ 30px below: the label is ≈ 18px weight 600 black, the name regular grey. Under it, round swatches ≈ 52px with ≈ 22px gaps. White swatches get a faint border. The selected one gets an outer 1px black ring with a ≈ 4px gap (the design system's `ds-color-option` ring).
   - "Size" label (as Color), with "Size Guide" right-aligned (dropped). Under it a 5-column grid of pills ≈ 85 × 60px with ≈ 11px gaps: white, 1px control border, radius ≈ 6px, display face ≈ 20px weight 600. The selected pill gets a black border plus a 1px inset ring (as `ds-size-option`).
   - Buy row, ≈ 45px below: Add to Cart is ≈ 389 × 80px, black, radius ≈ 4px, with a white bag icon and "Add to Cart" in sans ≈ 22px weight 500. Beside it, ≈ 15px away, the heart button ≈ 67 × 80px: white, 1px control border, radius ≈ 6px.
4. **Perk strip**, ≈ 43px under the photo: 3 cards, ≈ 103px tall, ≈ 15px gaps, muted fill. Each card has an outline icon ≈ 46px, a title (display face ≈ 22px weight 600) and a grey line. This is the home page's `PerkCard` look.

**Lower sections.** Each is separated by a full-width 1px divider (`--color-border`) with ≈ 47px above and below:
5. **About This Product | feature list.** Two columns split by a 1px vertical divider at ≈ 55% width. Left: heading in the display face ≈ 33px weight 700, then a paragraph in sans ≈ 20px, line-height ≈ 1.6, grey. Right: rows ≈ 54px apart, each an outline icon ≈ 30px then grey sans text ≈ 20px.
6. **Product Details | Fit & Sizing + Shipping & Returns.** Left: heading as in 5, then a table ≈ 670px wide. Rows ≈ 43px with 1px borders, the label column ≈ 271px wide, both columns sans ≈ 19px (label black-ish, value grey). Right: two blocks, each an icon ≈ 46px, a heading in the display face ≈ 25px weight 700, grey text ≈ 19px and an underlined link (dropped).
7. **Customer Reviews**: dropped (no source).
8. **You Might Also Like**: the heading as in 5, with "View All" right-aligned (grey sans ≈ 20px). A 4-column card grid with ≈ 44px gaps. Each card has a landscape image (≈ 300 × 213, ratio ≈ 1.41) on a pastel tone, with the dark bag tile button ≈ 47px at the bottom-right inside the image. Under it the name (display face, uppercase, ≈ 19px weight 500) and the price (≈ 22px weight 600) on separate lines. Stars dropped.

**Footer**: shared, unchanged.

## Approach

**Data flow.**

```
/products/[slug].astro  (wixMetadata: checkoutAndOrders.productPageMetadata, as the kit skeleton)
  allSettled: fetchProductBySlug(slug) · loadSEOTagsServiceConfig(STORES_PRODUCT) · fetchCategories()
  no product → 404 page (logged)
  productPage(product, categories) → { eyebrow, summaryHtml, aboutHtml, features[], details[], sizeRange,
                                       sportId, genderId, viewAllHref }        (pure, product-page.ts)
  allSettled: fetchProductsByCategory(sportId, 5) · fetchProductsByCategory(genderId, 5)
  pickRelated(lists, product.id, 4)
  ├─ <ProductView client:load initial={product} eyebrow summaryHtml />
  │     useProductDetail({ initial })   (kit: selection, variant, imageUrl, canAdd, blockedReason, add)
  │     ├─ ProductGallery (thumbs + 3D View tile, frame, arrows, expand <dialog>, 3D pill)
  │     └─ buy column: eyebrow, name, ribbons, price, summary, OptionGroup × n, buy row, status line
  ├─ perk strip (PerkCard × 3)
  ├─ About (set:html) | FeatureList
  ├─ SpecTable | InfoBlock (Fit & Sizing) + InfoBlock (Shipping & Returns)
  └─ SectionHeading "You Might Also Like" + ProductCard size="wide" × ≤4

SiteLayout header: <BagButton client:only="react"> (useCart → count badge), fallback = today's bag link
```

**Owners.** Product, variants, prices, photos, categories, recommendations: Wix Stores through the kit's `catalog.ts` and `useProductDetail`. The add: Wix eCommerce through the kit's `cart-store.ts` (`addLine`). SEO: Wix SEO through the kit's skeleton. Rendering: our primitives. Analytics: PostHog through `track()` and `captureError()`.

**New tokens** (`global.css` `:root`):
- `--color-scrim: rgb(17 17 17 / 80%)`, for the lightbox backdrop.

Every other value maps to an existing token:

| Element | Token |
| --- | --- |
| Photo and thumbnail radius | `--radius-sm` |
| Expand button and Add to Cart radius | `--radius-xs` |
| Arrows | `--shadow-arrow` |
| 3D pill | `--radius-pill` |
| Grey text | `--color-text-secondary` |
| Borders | `--color-control-border` (controls), `--color-border` (dividers, table rows) |
| Perk fill | `--color-muted-fill` |
| Ribbon badge | `ui-badge--sale` |
| Bag count badge | `--color-primary` fill, `--color-white` text |
| Disabled 3D, heart and wishlist icons | `--color-state-disabled` |
| Unavailable choices | `--ds-busy-opacity` |
| Swatch | `--color-swatch-border`, `--shadow-swatch`, ring as `.ds-color-option` |
| Transitions | `--ds-motion-fast` |

Swatch fill is the data's hex, passed as `--swatch-color`, as plan 08 does. Sizes live in the primitive classes, with `clamp()` so desktop values shrink with the viewport (plan 08's rule).

**New primitive classes** (`global.css`):
- `ui-gallery`, with `__rail`, `__frame`, `__arrow--prev`/`--next`, `__expand` and `__3d`
- `ui-thumbnail`: the design system's `ds-thumbnail` look as a real primitive, with an optional label; `ui-thumbnail--3d` is the muted icon tile
- `ui-swatch`: the PDP color option, 52px at 1440, with the selected ring and the unavailable state
- `ui-size-option`: the size pill, with selected and unavailable (line-through) states, in a `ui-size-grid` of 5 columns
- `ui-option-group`, with `__label` (bold) and `__value` (grey) for the "Color: name" and "Size" rows
- `ui-pdp-title`: the product name headline
- `ui-price`, with `__now`, `__was` and `__unit` for the large price row
- `ui-buy-row`, with `__cta` (`ui-button--primary`, sized up) and the heart (`ui-icon-button--square`, bordered)
- `ui-status-line`: neutral guidance and the confirmation; an error modifier uses `--color-error`
- `ui-feature-list`: icon and text rows
- `ui-spec-table`: label and value rows
- `ui-info-block`: icon, heading, text
- `ui-lightbox`: the `<dialog>` with `::backdrop` on `--color-scrim`, plus a close button
- `ui-icon-button__count`: the bag badge
- `ui-product-card--wide`: aspect 1.41, compact type

The new React components reuse these classes:
- `ProductGallery.tsx`, `OptionGroup.tsx`, `BagButton.tsx`
- The `IconButton` markup is reused in JSX, as `ProductCard.tsx` does

**Page layout** (`site.css`, sizes and grids only):
- `.pdp`: the container as `.site-header__bar`, so content aligns with the logo
- `.pdp__top`: grid `clamp(72px, 8.5vw, 123px) minmax(0, 667fr) minmax(320px, 471fr)`, gaps ≈ 32px and 47px
- `.pdp__perks`: 3 columns
- `.pdp__split`: `55fr 45fr` with a vertical divider
- `.pdp__related`: 4 columns
- The 1023px and 767px breakpoints described in Decisions

**Server helpers** (`src/components/storefront/product-page.ts`, pure, no Wix calls):
- `paragraphs(html)`: the inner HTML of each `<p>`
- `plainText(html)`: tags stripped, entities decoded for `&amp; &lt; &gt; &quot; &#39; &nbsp;`
- `productPage(product, categories)`: the shape in the data flow above
- `pickRelated(lists, excludeId, n)`

## Steps

Each step ends with `npm run check` passing and a commit.

- [x] 1. **Tokens and primitives.** Add `--color-scrim` and the primitive classes above to `global.css`, and the `.pdp*` layout to `site.css`. Add the `wide` size to `ProductCard.astro`. (check: `npm run check`; `/design-system` and `/` look unchanged in a screenshot.)
- [x] 2. **Server page.** Write `product-page.ts` and `src/pages/products/[slug].astro`: the kit skeleton's `wixMetadata` and SEO reads, with `allSettled` and a conditional `<SEO.Tags>` (see "Server reads and failures"), the reads above with logging, the 404 page, and the lower sections (perk strip, About, Product Details, Fit & Sizing, Shipping & Returns, recommendations). The island is a placeholder `div` for now. (check:
  - `curl -s -o /dev/null -w '%{http_code}'` gives 200 for `kix-nightshift-high` and 404 for `no-such-shoe`;
  - the HTML holds the product name, the SEO tags, 3 Features items, Colorway/Material/Product Care rows, "Available in sizes 7 to 12" and 4 recommendation cards, none of them Nightshift High;
  - `kix-mini-court` shows 3 cards and "1Y to 7Y".)
- [x] 3. **Gallery.** `ProductGallery.tsx` inside a new `ProductView.tsx` island: rail, frame, arrows, expand lightbox, the disabled 3D pill and the 3D View tile. (check in the browser:
  - the thumbnails and arrows swap the photo, and the arrows wrap;
  - picking the second color (step 4) swaps the photo and marks its thumbnail through `mediaKey()`, and afterwards the thumbnails and arrows still change the photo;
  - Escape and the close button shut the lightbox and focus returns to expand;
  - the 3D controls do nothing, have their tooltip, and are reachable by Tab;
  - no hydration warning in the console.)
- [x] 4. **Buy column.** Eyebrow, name, ribbons, price, summary, `OptionGroup` for Color (swatches) and Size (pills), the buy row with the disabled heart, the status line. (check:
  - before picking, the line reads "Choose Color and Size", and pressing Add to Cart focuses the Color group without a network request;
  - after picking both, the add request in the Network panel carries the picked variant's ID, and the response's line item shows the picked Color and Size;
  - "Added to your bag." appears;
  - "Was $220.00" is struck on Nightshift High.)
- [x] 5. **Header bag count.** `BagButton.tsx` in `SiteLayout` with its fallback. (check: the count shows after an add, survives a reload, and reads "Bag, 1 item" to a screen reader; other pages still render their header with JS disabled.)
- [x] 6. **Analytics.** Add `product_added_to_cart` to the catalog and `'cart_add'` to `ErrorArea`, and call both. (check: the PostHog debug log shows the event with only `product_id`.)
- [ ] 7. **Phone and tablet layouts** per Decisions. (check:
  - at 390 × 664 the photo band, name, price, Color swatches and the sticky Add to Cart are in the first screen, with no horizontal scroll;
  - at 1440 × 900 Add to Cart is fully visible without scrolling;
  - 768px and 1024px have no overlap.)
- [ ] 8. **Compare with the design** at 1440px and 390px through Claude in Chrome (390px through a same-origin iframe, scrolled so lazy images load). List every difference, then fix or explain each, and repeat. Then force each failure by a temporary edit, reverting after each:
  - the recommendation reads throw: the section hides, the log shows `[product] recommendations read failed`;
  - `fetchCategories` throws: no eyebrow, no recommendations, the page renders;
  - `add()` rejects: our error copy shows, `captureError` fires, the button works again.
  
  (check: screenshots of each.)
- [ ] 9. **Review.** A reviewer subagent compares the work with this plan; fix real gaps.
- [ ] 10. **Close out.** Write Result, set `Status: done`, update the index, propose AGENTS.md edits.

## Files

- Create:
  - `src/pages/products/[slug].astro`
  - `src/components/storefront/{ProductView.tsx,BagButton.tsx,product-page.ts}`
  - `src/components/ui/{ProductGallery.tsx,OptionGroup.tsx,SpecTable.astro,FeatureList.astro,InfoBlock.astro}`
- Change:
  - `src/styles/global.css` (token, primitives)
  - `src/styles/site.css` (`.pdp` layout)
  - `src/components/ui/ProductCard.astro` (`wide` size), `ProductCard.tsx` (comment only: `wide` is Astro-only)
  - `src/layouts/SiteLayout.astro` (`BagButton`)
  - `src/scripts/analytics.ts` (event, error area)
  - `prompts/README.md`
- Unchanged: every kit file under `src/wix/`, `src/hooks/` and `src/components/storefront/{OptionPicker,QuickAdd,FilterPanel,CartButton,CartDrawer}.tsx`. No new dependencies: the icons come from `lucide-react` and `@lucide/astro`, both already installed.

## Acceptance criteria

- WHEN a shopper opens `/products/<slug>` for a visible product THE SITE SHALL render, from Wix on the server:
  - the name, the eyebrow, every ribbon, the price with a labelled struck "was" price when Wix has one, the short description, the color swatches and the size grid;
  - the kit's owner-editable SEO tags.
- WHEN the slug matches no product (or the read fails) THE SITE SHALL answer 404 with a not-found message and a link to `/shop`.
- WHEN a shopper picks a color THE MAIN PHOTO SHALL switch to that colorway, and the matching thumbnail SHALL be marked.
- WHEN the selection is incomplete THE PAGE SHALL show the kit's reason ("Choose Size"), and Add to Cart SHALL add nothing.
- WHEN the selection is complete and the shopper presses Add to Cart THE SITE SHALL add exactly the picked variant to the Wix cart, confirm inline, and update the header bag count.
- WHEN the add fails THE PAGE SHALL show our error copy and SHALL report the error to PostHog without the message.
- THE 3D button, the 3D View thumbnail and the wishlist heart SHALL be visible, focusable, labelled "coming soon", and SHALL do nothing.
- THE PAGE SHALL show no stars, review counts, reviews, Size Guide or Learn More links, SKU or Origin, and no shipping, returns or fit promise beyond the neutral copy.
- THE PAGE SHALL show up to 4 recommendations from the same sport, then the same gender, never the current product, and SHALL hide the section when there are none.
- AT 390 × 664 THE FIRST SCREEN SHALL show the photo, name, price, the Color choices and the Add to Cart button, with no horizontal scroll; AT 1440 × 900 Add to Cart SHALL be visible without scrolling.

## Verification

- Command output: `npm run check`, `npm run build`, the `curl` checks in step 2.
- Screenshots: 1440 and 390 beside the design; 768 and 1024; the lightbox; the reason, confirmation and error states; the 404; the forced failures.
- Browser: the Network panel's add request and response (variant ID, Color and Size), the header count after a reload, keyboard focus on the disabled controls.
- PostHog: the console debug line for `product_added_to_cart`.
- The report lists which values were estimated from the image (every size in "The design").

## Risks and open questions

- **Purchase extras aren't rendered.** A future product with a mandatory modifier or a subscription plan would show the kit's reason ("Add Engraving", "Choose a plan") with no control to satisfy it, so it couldn't be bought. Notify-me never shows while stock is untracked. If the owner adds such products, extend `ProductView` or mount the kit's `OptionPicker` for them.
- **Choice image vs gallery URL.** The thumbnail sync assumes `d.imageUrl` equals a `product.gallery` URL. Step 3 checks it, with a fallback.
- **A Wix outage looks like a missing product.** `fetchProductBySlug` swallows errors and returns null (`catalog.ts:114`), so a temporary Wix failure answers 404. That could get product URLs dropped from search results. The category page has the same behaviour today, so this plan accepts it. A follow-up could add a non-swallowing read in `src/wix/storefront/` and answer 503 on a failure.
- **Cart open flag.** `addLine` sets the cart store's `open: true` after every add. Nothing reads it until the cart plan mounts the drawer, which will then open after each add, as the kit intends.
- **The header bag reads the cart on every page** (one browser request), as the kit's `CartButton` would.
- **Neutral policy copy.** "Per our store policy" points at a policy the owner hasn't published. The owner should add a returns policy (and any free-shipping rule) before the copy names one.
- **Placeholder photos.** Plan 07 kept 6 photos as placeholders: both colorways of Nightshift High, Drill TR and Court 1 Retro. On Nightshift High and Drill TR the two colorways show different shoe models, so the gallery's two photos won't look like one shoe until they're regenerated.
- **No credits or money** are spent. No new dependencies or data schemas.

## Result

Filled at close-out.
