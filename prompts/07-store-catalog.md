# 07 · Store data map, 12 Kix sneakers and the storefront data layer

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Plan the data behind all of our page designs, which I've attached, and show which parts come from Wix Stores, Wix CMS or Wix Members. Point out anything that has no data source yet. Then propose 12 Kix sneakers for my approval, add them to the store and set up the store data layer, using the storefront part of the wix headless kit skill."

Attached designs: home, explore (product listing), product page, cart, sign in, create account.

## Goal

When this is done, every element of the six designs has a named data owner (Wix Stores, Wix eCommerce, Wix Members, Wix CMS, static copy) or is listed as having no source yet. The live Wix site has Wix Stores installed, priced in USD, with 12 Kix sneakers in 2 colorways each, an AI photo per colorway, sizes as variants, and a category tree for the nav, explore sidebar and home sections. The kit's storefront data layer, hooks and components are deployed. The home page's Shop by Category, New Arrivals and Popular Right Now sections read live Stores data instead of `mock.ts`.

## Out of scope

- The explore, product and cart pages. Each gets its own plan built on this data layer (`useShop`, `useProductDetail`, `useCart`).
- Mounting the kit's `CartButton`/`CartDrawer` in `SiteLayout`. That's in the cart page plan, which also decides drawer versus page.
- CMS collections (home slides, 3D model links, saved designs, wishlist). Each comes with the feature that needs it.
- Reviews, ratings, coupons, shipping rules, SKUs and payments. See the data map's "No source yet" table.
- Analytics events for products and the cart. Those pages don't exist yet.
- Release. Verification is local only (user's choice).
- Deleting Wix's sample products. The kit never deletes; the owner removes them in the dashboard.

## Decisions

- **Photos (user): Wix AI, one per colorway.** That's 24 images at up to 1 Wix AI credit each (~24 credits at most, charged to the Wix account; the seed tries a cheaper model first). Each colorway's photo is a choice image, so picking a color swaps the photo and the product page gets a 2-image gallery. Products get no separate product-level image, so we don't pay for a duplicate. The gallery's first item (the first colorway) becomes the main image. Every image is inspected for brand marks before the step passes.
- **Scope (user): also wire the home page's three product sections.** The hero and banner carousels and Members Get More stay in `mock.ts`. The slides become a CMS collection later; the perks are static copy the user confirmed in plan 03.
- **Branch (user):** `feat/posthog-setup` was fast-forwarded into `main` (done while planning: `main` is at `7db9d3a`). This work commits directly on `main`. Plan 06 is still `approved`, not closed out; that's unchanged.
- **Release (user): no.** Verify on `localhost:4321` only.
- **Currency: USD.** Every design prices in `$`, and the store doesn't exist yet, so nothing gets repriced. The seed sets it before creating products.
- **Stock: untracked (`"inStock": true`).** AGENTS.md forbids invented stock levels. A counted quantity would make the kit show "Only N left" from a number we made up. The owner sets real counts in Inventory.
- **Categories:** we keep plan 03's tree. It's the one `index.astro`'s comment and the header nav already expect.

  | Category | Slug | Parent | Use |
  | --- | --- | --- | --- |
  | Men, Women, Kids | `men`, `women`, `kids` | none | Header nav and footer (`navCategories` in `mock.ts` already links these slugs) |
  | Sports | `sports` | none | Parent of the five below. Explore sidebar and home "Shop by Category" read its children |
  | Lifestyle, Running, Basketball, Skate, Training | `lifestyle`, `running`, `basketball`, `skate`, `training` | Sports | Each has a category image: its main product's first colorway photo |
  | New Arrivals | `new-arrivals` | none | Owner-curated home section |
  | Popular | `popular` | none | Owner-curated home section ("Popular Right Now") |

- **Child categories need a small script.** The kit's seed creates top-level categories only. `parentCategory` can only be set at create time (it's immutable per [Create Category](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/categories/create-category.md)), so a script creates Sports and its five children after the seed. It runs after the seed so each child can be created with its image. It uses the documented Create Category body and the seed's exported helpers.
- **Ribbons:** "New" on the three New Arrivals and "Sale" on the three products with a compare-at price. The kit forbids computed "16% OFF" badges, so the design's percent badge becomes the merchant's "Sale" ribbon.
- **Info sections:** each product gets "Features" (feeds the PDP's "About This Product" bullets), "Materials" (feeds Product Details), and a shared "Care" ("Wipe clean with a soft, damp cloth."). Rich text allows only `<p>`, `<br/>`, `<strong>` and `<em>`, so each feature is its own `<p>`.
- **Sizes:** men's US 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12 (the product design's grid); women's US 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10; kids' 1Y–7Y. All use one option named "Size", so the explore Size filter mixes men's and women's numbers. The gender categories scope that in practice.
- **Color names map to one hex across the catalog.** Wix keys a color choice by name, so the seed rejects a name with two codes.
- **Seed inputs stay out of git.** AGENTS.md says products and prices live in Wix, never in files, so `.seed/store-plan.json` and `.seed/category-tree.mjs` sit in a git-ignored `.seed/` folder. This plan holds everything needed to recreate them.
- **Home server calls: 3 kit calls, 6 Wix sub-requests per render.** `fetchCategories()` comes first (2 sub-requests: the All Products lookup and the category query), then two `fetchProductsByCategory()` calls in parallel (2 each: search and count). That breaks AGENTS.md's "one external call per request" rule but is well under the 20 sub-request limit. The kit's own category page makes more. See Risks: the rule looks wrong for SSR pages and should be reworded at close-out.
- **Header nav stays static.** `navCategories` (Men, Women, Kids) keeps its fixed slugs, which match the seeded categories. Fetching it would add a call to every page.
- **Plan review:** a general-purpose subagent reviewed this plan (there's no dedicated reviewer agent in `.claude/`). It found no blockers. Its fixes are applied:
  - sub-requests counted as 6, not 3
  - logging for `fetchCategories()`'s silent `[]`, and `allSettled` so one failed section doesn't hide the other
  - a step 7 check that only live data can pass
  - a regenerate path that works (the seed reuses one file per prompt and only adds to galleries)
  - image and tree checks that use the right reads
  - a same-shoe check across colorways
  - the seed's choice-image counters
  - category order and the image `url` fallback
  - the expected `$229.00` price format
  - tile tones, and two wording fixes

  One suggestion was changed: it named the field `PRODUCT_CHOICES_MEDIA_REFERENCES`, but the docs list `PRODUCT_CHOICES_DISPLAY_IMAGE`, so step 4 uses that and confirms it first.

## Context

- Skill: `wix-headless-kit` 1.35.0 (plugin). `check.mjs` says the plugin skill is behind upstream (`SKILL.md`, `deploy.mjs`, `setup.mjs`, `pins.json`), but the storefront templates match the copy in `node_modules/@wix/agent-skills` (1.35.0), the same version plan 05 used. Upgrading the skill is not part of this plan.
- `context.mjs`: shape `wix-project`, publisher `cli`, site `86f0930e-59bd-46af-a1b2-3615bea485a9`, so we iterate: deploy, install, edit, seed only what the brief asks for.
- `read-site.mjs` (storefront): "the app is not installed on this site". So no store, no products, no categories, and no currency set yet.
- Node: the shell defaults to 22.12. Wix CLI commands and the kit scripts need `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- Read: `storefront/INSTRUCTIONS.md` (file map, contracts, skeletons, hard rules), `storefront/seed/SEED.md`, `seed-store.mjs` (`setupStore`, `createCategories`, `addProductsToCategories`, the image and choice-image flow, `validateProducts`), `install/deploy.mjs` (storefront dependencies), `read-site.mjs`.
- Docs: [Create Category](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/categories/create-category.md) (`category.parentCategory.id`, `slug`, `image.id`, `treeReference`), [Search Products](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/search-products.md) (`POST /stores/v3/products/search`; `media.main.image.id` / `.url`; `fields: ["MEDIA_ITEMS_INFO"]`).
- Deploy dry check: `storefront/app` adds 15 files that don't exist yet (`wix/storefront/{catalog,catalog-core,cart,cart-core,cart-store,shop-store,product-detail-store}.ts`, `hooks/storefront/{useShop,useProductDetail,useCart}.ts`, `components/storefront/{CartButton,CartDrawer,FilterPanel,OptionPicker,QuickAdd}.tsx`). `types.ts`, `sdk.ts`, `media.ts` and `money.ts` are identical to ours. `config.ts`, `SiteLayout.astro` and `global.css` exist and are kept, because deploy copies with `force: false`.
- New dependencies, which approving this plan approves: `@wix/stores ^1.0.888`, `@wix/categories ^1.0.220`, `@wix/ecom ^1.0.2451`, `@wix/redirects ^1.0.125` (already in the tree through `@wix/sdk`; now direct), `@wix/seo ^1.0.79`. `@wix/essentials` is already declared.
- Builds on plan 03 (home sections, category slugs, routes), plan 05 (kit deploy pattern) and plan 06 (PostHog; untouched here).

## Approach

### Data map

Owners: **Stores** = Wix Stores catalog (products, variants, categories, media, ribbons, info sections) through the kit's `catalog.ts`. **eCom** = Wix eCommerce cart and hosted checkout through the kit's `cart.ts`/`useCart`. **Members** = Wix Members (built in plan 05). **CMS** = a Wix CMS collection keyed by product ID as text (AGENTS.md). **Static** = copy in our code.

**Site chrome (every page)**

| Element | Source | Field / call |
| --- | --- | --- |
| Wordmark | Static | Kix placeholder wordmark |
| MEN / WOMEN / KIDS | Stores (slugs) | Static links to `/category/men`, `women`, `kids` |
| CUSTOMIZE | CMS (later) | 3D model links and saved designs: not set up |
| MEMBERSHIP | Static | No page or design yet |
| Cart icon and count | eCom | `useCart().cart.itemCount` (cart plan mounts `CartButton`) |
| Account icon and menu | Members | `member-store.ts` (done) |
| Footer Shop links | Stores (slugs) | Static links to category pages |
| Footer Support/Company links | No source | Pages don't exist (Help, Shipping, Returns, Size Guide, About, Sustainability, Careers, News) |
| Footer Order Status | eCom + Members | A member's orders. No page yet |
| Newsletter | No source | Form shows "Sign-ups open soon." (plan 03) |

**Home**

| Element | Source | Field / call |
| --- | --- | --- |
| Hero carousel (eyebrow, title, copy, CTA, image) | CMS (later); `mock.ts` now | `heroSlides`; CTAs link to seeded product slugs |
| Shop by Category tiles | Stores | `fetchCategories()` → children of `sports` by `index`: `name`, `slug`, `imageUrl` |
| New Arrivals cards | Stores | `fetchProductsByCategory(newArrivals.id, { limit: 3 })` → `ProductSummary` |
| Limited Collection banner | CMS (later); `mock.ts` now | `collectionSlides` |
| Popular Right Now cards | Stores | `fetchProductsByCategory(popular.id, { limit: 4 })` |
| Card name, price, was-price, ribbons, image | Stores | `name`, `price`/`maxPrice`/`fromPrice`, `compareAtPrice`, `ribbons`, `imageUrl` |
| Card stars | No source | Not rendered (plan 03) |
| Members Get More | Static | `memberPerks` in `mock.ts` (user-confirmed copy) |

**Explore (listing)**

| Element | Source | Field / call |
| --- | --- | --- |
| "SNEAKER'S" category list with counts | Stores | Children of `sports`: `name`, `productCount`; links to `/category/<slug>` |
| "632 LIFESTYLE SNEAKERS" heading | Stores | `useShop().total` + active category `name` |
| Search box | Stores | `useShop().setFilters({ search })`. Never sent to analytics |
| Price slider ($40–$450) | Stores | `useShop().priceRange` in the kit's `FilterPanel` |
| Color swatches | Stores | `facets` (Color option, `colorCode`) in `FilterPanel` |
| Grid cards (image, name, price, bag) | Stores + eCom | `ProductSummary`; bag = kit `QuickAdd` (size picker, then cart) |
| Card stars and review counts | No source | Wix Reviews would need its own plan |

**Product page**

| Element | Source | Field / call |
| --- | --- | --- |
| Thumbnails and main image | Stores | `product.gallery`; `useProductDetail().imageUrl` follows the color pick |
| Expand icon, arrows | Static UI | Over the gallery |
| 3D button and viewer | CMS (later) | GLB link keyed by product ID; Tripo → glTF Transform → Wix. Not set up |
| "Men's Shoe" eyebrow | Stores | Derived from `categoryIds` matching `men`/`women`/`kids` |
| Name, price, was-price | Stores | `name`, `useProductDetail().price`, `compareAtPrice` |
| "16% OFF" badge | Stores | Replaced by the merchant's ribbon ("Sale"). The kit forbids computed percentages |
| Stars, "(124)" | No source | Hidden until a reviews source exists |
| Short description | Stores | First paragraph of `descriptionHtml` |
| Color label and swatches | Stores | Color option via kit `OptionPicker` |
| Size grid | Stores | Size option via `OptionPicker` |
| Size Guide link | No source | Static page doesn't exist |
| Add to Cart | eCom | `useProductDetail().add()`, gated by `canAdd`/`blockedReason` |
| Wishlist heart | No source | Options: a CMS collection (member ID + product ID), or drop it. Decide in the PDP plan |
| Perk strip (shipping, returns, secure checkout) | Static | Copy. The free-shipping threshold needs a Wix shipping rule (owner) |
| About This Product paragraph | Stores | Rest of `descriptionHtml` |
| Feature bullets | Stores | Info section "Features". The per-bullet icons have no source: one generic icon, or none |
| Product Details: Style, SKU | Stores (dashboard) | Variant `sku`. The seed can't set SKUs; the owner adds them |
| Product Details: Colorway | Stores | Selected color choice name |
| Product Details: Material, Care | Stores | Info sections "Materials", "Care" |
| Product Details: Origin | No source | Dropped |
| Fit & Sizing, Shipping & Returns | Static | Policy copy. Same caveat as the perk strip |
| Customer Reviews block, Write a Review | No source | Hidden until a reviews source exists |
| You Might Also Like | Stores | `fetchProductsByCategory(<shared sport category>)`, excluding the current product |

**Cart**

| Element | Source | Field / call |
| --- | --- | --- |
| "3 ITEMS" | eCom | `cart.itemCount` |
| Line image, name, colorway, size | eCom | `line.imageUrl`, `productName`, `descriptionLines` |
| Line price, struck price | eCom | `linePrice`, `compareAtLinePrice` |
| Quantity stepper, Remove | eCom | `updateQuantity`, `removeLine`; cap `availableQuantity` |
| Subtotal, Discount, Total | eCom | `cart.subtotal`, `discounts`, `total` (before shipping) |
| Shipping "FREE" | eCom at checkout | The kit says "Calculated at checkout". "Free" needs an owner shipping rule |
| Checkout | eCom | `checkout()` → Wix hosted checkout |
| "OR" + Shop Pay | No source, brand rule | Dropped: another company's brand; Wix checkout shows its own payment methods |
| Promo code + applied state | eCom | `applyCoupon` / `removeCoupon`, `cart.coupon`. No coupons exist yet (owner creates them) |
| Perk list | Static | Copy. The design's "$50" contradicts "$100" elsewhere; we use $100 (plan 03) |
| You Might Also Like (stars) | Stores (stars: no source) | Products from a cart line's category |

**Sign in / Create account**

| Element | Source | Field / call |
| --- | --- | --- |
| Email, password, Google | Members | Done in plan 05 |
| Names | Members | `updateMember` after signup (plan 05) |
| Remember me | No source | Dropped (plan 05) |
| Terms / Privacy links | No source | Pages don't exist |
| Panel photo and headline | Static | Vetted Pexels photo |

**No source yet (summary):** reviews and ratings (everywhere), wishlist, 3D models and saved designs (CMS, planned), editorial slides (CMS, planned), newsletter, Help/About/legal pages, size guide, SKU/style codes (owner adds), coupons (owner creates), the free-shipping rule (owner sets), the member order-status page, and the Membership page.

### The 12 sneakers (placeholder catalog for approval)

Prices in USD. Every product has `"inStock": true`, a Color option (`type: "color"`, 2 choices with `colorCode`, `imagePrompt` and `altText`) and a Size option. The "Was" column becomes `compareAtPrice`.

| # | Name | Price | Was | Ribbon | Sport | Gender | Curated | Colorways (hex) | Sizes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Kix Court 1 Retro | 229 | | New | Lifestyle | Men | New Arrivals | Team Red / White `#B3202A`; Black / Sail `#1F1F1F` | Men's |
| 2 | Kix Summit High | 139 | | New | Basketball | Men | New Arrivals | Forest / Gum `#2F4A3A`; Navy / Gum `#1F2A44` | Men's |
| 3 | Kix Strap High LX | 179 | | New | Skate | Women | New Arrivals | Berry / Pink Foam `#A3194F`; Burgundy / Sail `#6B1F2E` | Women's |
| 4 | Kix Nightshift High | 189 | 220 | Sale | Basketball | Men | Popular | Black / White `#151515`; Black / Crimson `#8E1B24` | Men's |
| 5 | Kix Sandlot Suede | 119 | | | Skate | Men | Popular | Wheat `#C8955A`; Mocha `#6E4B34` | Men's |
| 6 | Kix Meridian Premium | 159 | 185 | Sale | Lifestyle | Women | Popular | Sail / Black `#EDE6D6`; White / Sage `#A9C2A4` | Women's |
| 7 | Kix Orbit High | 119 | | | Lifestyle | Women | Popular | Grape / Teal `#5B2A86`; Petal Pink `#F2B5C4` | Women's |
| 8 | Kix Tempo Run | 139 | | | Running | Women | | Silver / Sky `#C5CAD1`; Lavender Mist `#C9BBE8` | Women's |
| 9 | Kix Pacer 2 | 149 | 170 | Sale | Running | Men | | Graphite / Volt `#3A3D42`; Ocean Blue `#2B6CB0` | Men's |
| 10 | Kix Drill TR | 109 | | | Training | Men | | Black / Blaze `#1C1C1C`; Stone `#BDB6A8` | Men's |
| 11 | Kix Circuit Trainer | 99 | | | Training | Women | | Cloud White `#F4F4F1`; Coral Glow `#F08A7E` | Women's |
| 12 | Kix Mini Court | 69 | | | Lifestyle | Kids | | Royal Purple `#5E35B1`; Sky Blue `#8EC5E8` | Kids' |

Six names match the slugs `mock.ts`'s hero and banner slides already link to (`kix-court-1-retro`, `kix-strap-high-lx`, `kix-summit-high`, `kix-nightshift-high`, `kix-meridian-premium`, `kix-orbit-high`). Category images (first colorway photo, picked so the photo background is close to the tile tone in `index.astro`): Lifestyle ← #1 (beige), Running ← #9 (mint), Basketball ← #4 (mint on a peach tile), Skate ← #3 (rose on a coral tile), Training ← #10 (sand on a periwinkle tile). The photo covers its tile, so a tone only shows while the image loads.

**Size choices.** Men's: `7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12`. Women's: `5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10`. Kids': `1Y, 2Y, 3Y, 4Y, 5Y, 6Y, 7Y`.

**Copy** (`description` is the two `<p>` paragraphs, `Features` is one `<p>` per line, and `Materials` is one `<p>`):

1. **Court 1 Retro.** "Court heritage, cut high. Full-grain leather and a padded collar carry the classic shape into every day." / "A cupsole with a pivot circle grips clean on court and city streets alike. Lace it tight, roll out, repeat." Features: High-top leather upper · Padded collar for ankle support · Rubber cupsole with pivot circle · Perforated toe box for airflow. Materials: Upper: full-grain leather. Lining: textile. Sole: rubber.
2. **Summit High.** "Built for the climb, made for the street. Soft suede and a hook-and-loop ankle strap lock you in." / "The gum rubber sole adds warm contrast and steady grip from the first step to the last." Features: Suede high-top upper · Hook-and-loop ankle strap · Gum rubber outsole · Cushioned foam insole. Materials: Upper: suede. Lining: textile. Sole: gum rubber.
3. **Strap High LX.** "Locked in. Lifted up. Two straps and a padded high collar keep every move secure." / "Bold suede panels and a foam-cushioned sole bring the energy from park to party." Features: Double hook-and-loop straps · Padded high collar · Foam midsole cushioning · Vulcanized rubber outsole for board feel. Materials: Upper: suede and textile. Sole: rubber.
4. **Nightshift High.** "Dark mode, full speed. A sleek leather high-top that moves from late runs to late nights." / "Responsive foam and a herringbone outsole keep the court in your control." Features: Leather and synthetic upper · Responsive foam midsole · Herringbone traction outsole · Padded tongue and collar. Materials: Upper: leather and synthetic. Sole: rubber.
5. **Sandlot Suede.** "Low, loose and ready to roll. Brushed suede wears in, not out." / "A grippy rubber sole and padded collar keep you steady from first push to last trick." Features: Brushed suede upper · Padded collar and tongue · Grippy rubber outsole · Reinforced toe cap. Materials: Upper: suede. Lining: textile. Sole: rubber.
6. **Meridian Premium.** "Clean lines for long days. Premium leather and a soft-touch lining keep it easy from morning to night." / "The low-profile cupsole moves with you and goes with everything." Features: Premium leather upper · Soft-touch textile lining · Low-profile rubber cupsole · Cushioned footbed. Materials: Upper: leather. Lining: textile. Sole: rubber.
7. **Orbit High.** "Bold color, big moves. A high-top with a strap that snaps your fit into place." / "Lightweight foam keeps every step springy, from first bell to last call." Features: Suede and leather high-top upper · Hook-and-loop ankle strap · Lightweight foam midsole · Rubber cupsole. Materials: Upper: suede and leather. Sole: rubber.
8. **Tempo Run.** "Find your pace and keep it. Breathable mesh and a springy foam midsole carry you mile after mile." / "Reflective details keep you seen when the light fades." Features: Breathable engineered mesh upper · Springy foam midsole · Reflective heel details · Rubber outsole with flex grooves. Materials: Upper: engineered mesh. Sole: foam and rubber.
9. **Pacer 2.** "Faster every run. A lighter knit upper and a rocker-shaped sole roll you forward." / "A durable rubber outsole grips wet and dry roads." Features: Lightweight knit upper · Rocker-shaped foam midsole · Durable rubber outsole · Padded heel collar. Materials: Upper: knit textile. Sole: foam and rubber.
10. **Drill TR.** "Lift, jump, sprint, repeat. A wide, stable base keeps you grounded through every set." / "Side support wraps the midfoot for quick cuts and lateral moves." Features: Wide, flat base for lifting · Midfoot side support · Durable mesh and synthetic upper · Rubber outsole with multi-directional grip. Materials: Upper: mesh and synthetic. Sole: rubber.
11. **Circuit Trainer.** "One shoe for every station. Light, flexible and quick from warm-up to cool-down." / "Flex grooves in the sole move with your foot on every rep." Features: Lightweight mesh upper · Flex grooves in the outsole · Cushioned foam midsole · Pull tab at the heel. Materials: Upper: mesh. Sole: foam and rubber.
12. **Mini Court.** "Big style, small sizes. The court classic, made for playgrounds and first days." / "A hook-and-loop strap makes on and off easy for little hands." Features: Leather and synthetic upper · Hook-and-loop strap closure · Cushioned insole · Rubber outsole. Materials: Upper: leather and synthetic. Sole: rubber.

Every product also gets the shared info section `{ "title": "Care", "description": "<p>Wipe clean with a soft, damp cloth.</p>" }`.

**Image prompt** (one per colorway; `<shoe>` is the product's whole Features list as one phrase, identical in both colorway prompts so the two photos show the same model; `<colorway>` spelled out; `<bg>` per product):

> Studio product photo of a single sneaker: <shoe>. <colorway> colorway. Right shoe, side three-quarter view facing left, floating at a slight upward angle with a soft shadow below, plain <bg> background, soft even commercial lighting, original unbranded design with plain side panels, no logos, no emblems, no text, no watermarks

Backgrounds (both colorways share one): 1 warm beige, 2 pale aqua, 3 soft rose, 4 pale mint, 5 soft peach, 6 pale periwinkle, 7 pale lilac, 8 pale sky blue, 9 pale mint, 10 warm sand, 11 pale aqua, 12 soft peach. `altText`: "<Name> in <colorway>".

### Seed plan file shape (`.seed/store-plan.json`)

```json
{
  "currency": "USD",
  "products": [
    { "name": "Kix Court 1 Retro", "price": 229, "ribbon": "New", "inStock": true,
      "description": "<p>Court heritage, cut high. …</p><p>A cupsole with a pivot circle …</p>",
      "options": [
        { "name": "Color", "type": "color", "choices": [
          { "name": "Team Red / White", "colorCode": "#B3202A", "altText": "Kix Court 1 Retro in Team Red / White", "imagePrompt": "Studio product photo … plain warm beige background … no watermarks" },
          { "name": "Black / Sail", "colorCode": "#1F1F1F", "altText": "…", "imagePrompt": "…" } ] },
        { "name": "Size", "choices": ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12"] } ],
      "infoSections": [
        { "title": "Features", "description": "<p>High-top leather upper</p><p>…</p>" },
        { "title": "Materials", "description": "<p>Upper: full-grain leather. Lining: textile. Sole: rubber.</p>" },
        { "title": "Care", "description": "<p>Wipe clean with a soft, damp cloth.</p>" } ] }
  ],
  "categories": {
    "Men": ["Kix Court 1 Retro", "Kix Summit High", "Kix Nightshift High", "Kix Sandlot Suede", "Kix Pacer 2", "Kix Drill TR"],
    "Women": ["Kix Strap High LX", "Kix Meridian Premium", "Kix Orbit High", "Kix Tempo Run", "Kix Circuit Trainer"],
    "Kids": ["Kix Mini Court"],
    "New Arrivals": ["Kix Court 1 Retro", "Kix Summit High", "Kix Strap High LX"],
    "Popular": ["Kix Nightshift High", "Kix Sandlot Suede", "Kix Meridian Premium", "Kix Orbit High"]
  }
}
```

Products with a "Was" price add `"compareAtPrice": <was>`.

### Category tree script (`.seed/category-tree.mjs`)

Run from the project root with Node 24.18 after the seed. It imports `makeCtx`, `queryCategoriesByNames` and `addProductsToCategories` from `<templates>/storefront/seed/seed-store.mjs`, where `<templates>` is the folder `install/templates.mjs` prints.

1. `ctx = makeCtx()`.
2. Read the 12 products: `POST https://www.wixapis.com/stores/v3/products/search` with headers `Authorization: Bearer <ctx.token>`, `wix-site-id: <ctx.siteId>`, `Content-Type: application/json` and body `{ "fields": ["MEDIA_ITEMS_INFO"], "search": { "filter": { "$and": [{ "visible": true }] }, "cursorPaging": { "limit": 100 } } }`. Map name → `{ id, mediaId: media.main.image.id, url: media.main.image.url }`. Fail loudly if any of the 12 or an image is missing.
3. Skip any of the six names that `queryCategoriesByNames` already finds (idempotent re-run).
4. Create Sports, then Lifestyle, Running, Basketball, Skate, Training in that order, one at a time (the tree's revision makes concurrent creates fail with 409). `POST https://www.wixapis.com/categories/v1/categories` with body `{ "category": { "name": "Sports", "slug": "sports", "visible": true }, "treeReference": { "appNamespace": "@wix/stores", "treeKey": null } }`. Children add `"parentCategory": { "id": <sportsId> }` and `"image": { "id": <mediaId> }`, or `"image": { "url": <url> }` when the id is missing (the seed's own pattern).
5. `addProductsToCategories(ctx, { <lifestyleId>: [#1, #6, #7, #12], <runningId>: [#8, #9], <basketballId>: [#2, #4], <skateId>: [#3, #5], <trainingId>: [#10, #11] })`.
6. Query the tree (`POST https://www.wixapis.com/categories/v1/categories/query`, body as in `queryCategoriesByNames`) and print JSON `{ created: [...], reused: [...], tree: [{ name, id, slug, parentId, index }] }`. `index` is set by Wix (read-only), so the order is checked, not set.

### Home wiring (`src/pages/index.astro`)

The frontmatter follows the kit skeleton's guard. Everything goes inside one `try`, so an SSR throw never truncates the page:

```ts
let shopCategories: Category[] = [];
let newArrivals: ProductSummary[] = [];
let popularNow: ProductSummary[] = [];
try {
  // fetchCategories() swallows its own errors and returns [], so an empty list is the failure signal.
  const categories = await fetchCategories();
  if (categories.length === 0) console.error('[home] no categories from Wix');
  const bySlug = (slug: string) => categories.find((c) => c.slug === slug);
  const sports = bySlug('sports');
  shopCategories = sports
    ? categories.filter((c) => c.parentId === sports.id).sort((a, b) => a.index - b.index || a.name.localeCompare(b.name))
    : [];
  const fresh = bySlug('new-arrivals');
  const popular = bySlug('popular');
  // allSettled: one curated read failing never hides the other section.
  const [freshResult, popularResult] = await Promise.allSettled([
    fresh ? fetchProductsByCategory(fresh.id, { limit: 3 }) : Promise.resolve([]),
    popular ? fetchProductsByCategory(popular.id, { limit: 4 }) : Promise.resolve([]),
  ]);
  if (freshResult.status === 'fulfilled') newArrivals = freshResult.value;
  else console.error('[home] new arrivals read failed', freshResult.reason);
  if (popularResult.status === 'fulfilled') popularNow = popularResult.value;
  else console.error('[home] popular read failed', popularResult.reason);
} catch (error) {
  console.error('[home] catalog read failed', error);
}
```

The markup stays as it is. Each section already hides when its list is empty, which covers the empty and error states (SSR has no loading state). Prices render as Wix formats them (likely `$229.00` where the design shows `$229`). The kit says prices come from the DTOs unchanged, so this is an expected difference. `mock.ts` loses `shopCategories`, `newArrivals`, `popularNow`, the `product()` helper and the `court`/`strap`/… constants. It keeps the slides, perks and `navCategories`. Slide `href`s become literal `/products/<slug>` strings, and slide images stay local. The header comment in `index.astro` is updated to say what's live and what's mock.

No new tokens, events or secrets.

## Steps

- [x] 1. **Deploy the data layer.** On `main`, with Node 24.18: `node <SKILL_ROOT>/install/deploy.mjs storefront --stack astro`, then one `node <SKILL_ROOT>/install/install.mjs` (`<SKILL_ROOT>` = `~/.claude/plugins/cache/wix/wix/1.35.0/skills/wix-headless-kit`). Add `.install-exit` to `.gitignore`. (check: `git status` shows only the 15 new kit files, `package.json`/`package-lock.json` with the 5 dependencies, `.gitignore`, and this plan and `prompts/README.md`; `config.ts`, `SiteLayout.astro`, `global.css` unchanged; `npm run check` passes.) Commit, including the plan and index.
- [x] 2. **Write the seed inputs.** Add `.seed/` to `.gitignore`. Write `.seed/store-plan.json` from the tables above (all 12 products). (check: `node -e` importing `validateProducts` from `seed-store.mjs` on the file throws nothing; 12 products, 24 color choices, each with `imagePrompt`; both prompts of a product share the same `<shoe>` phrase.) Commit `.gitignore`.
- [x] 3. **Seed the store.** From the project root: `node <templates>/storefront/seed/seed-store.mjs .seed/store-plan.json > .seed/seed-result.json`. This spends up to ~24 Wix AI credits. (check: exit 0; 12 products created or reused; `failures`, `imageFailures` and `choiceImageFailures` empty; `imagesAttached` = 12; `choiceImagesLinked` = 24; `preexisting` lists Wix's sample products, for the report.) If images miss, re-run the same plan; it's idempotent and reuses files already generated.
- [x] 4. **Inspect the 24 photos.** Read the products with Search Products (`fields: ["MEDIA_ITEMS_INFO", "PRODUCT_CHOICES_DISPLAY_IMAGE"]`, the request shape in the category script; confirm the choice-image field in the docs first). Map each color choice to its image, download all 24 to the scratchpad and view them. (check: no logo, emblem, side stripe resembling a real brand, text or watermark; each photo matches its colorway; both colorways of a product read as the same shoe model.) If any fails, stop and ask. Regenerating means editing that choice's `imagePrompt` (the seed reuses a file per prompt, so the same prompt gives the same image) and re-running the seed, about 1 credit each. The seed only adds to a gallery, so the rejected image stays until the owner deletes it in the dashboard (or we ask first). It stays the main image if it was the first colorway's.
- [x] 5. **Build the category tree.** Write and run `.seed/category-tree.mjs`. (check: the script's `tree` output has Men, Women, Kids, New Arrivals, Popular and Sports top-level, and Lifestyle, Running, Basketball, Skate, Training with `parentId` = Sports, in that `index` order, all with exactly the slugs in Decisions. If an auto slug differs from `men`/`women`/`kids`/`new-arrivals`/`popular`, or the order differs, stop and ask before changing anything.)
- [x] 6. **Verify product slugs.** Read `products[].slug` from `.seed/seed-result.json`. (check: the 12 slugs are `kix-court-1-retro`, `kix-summit-high`, `kix-strap-high-lx`, `kix-nightshift-high`, `kix-sandlot-suede`, `kix-meridian-premium`, `kix-orbit-high`, `kix-tempo-run`, `kix-pacer-2`, `kix-drill-tr`, `kix-circuit-trainer`, `kix-mini-court`; the slide links in `mock.ts` match.)
- [x] 7. **Wire the home sections** as in Approach. (check: `npm run check` and `npm run build` pass; `curl -s localhost:4321/ | grep -c 'Kix Sandlot Suede'` ≥ 1 and `grep -c 'static.wixstatic.com'` ≥ 1, both of which only live data produces (the mock had the name only in uppercase, in the removed `popularNow`); `mock.ts` has no product prices left.) Commit.
- [ ] 8. **Compare with the home design** at 1440px and 390px through Claude in Chrome (390px via a same-origin iframe). (check: the three sections show live names, prices, struck prices on sale items, "New"/"Sale" ribbons and AI photos; tiles link to `/category/<slug>`; every difference from the design is listed and fixed or explained, with Wix's `$229.00` price format expected.) Then force each failure path by temporarily editing the frontmatter, and revert after each: a throw from `fetchProductsByCategory` for `popular` (check: Popular Right Now hides, New Arrivals and categories still render, the server log shows `[home] popular read failed`), and an empty category list (check: all three sections hide, the page renders, the log shows `[home] no categories from Wix`). Commit fixes.
- [ ] 9. **Review.** A reviewer subagent compares the work with this plan; fix real gaps.
- [ ] 10. **Close out.** Write Result, set `Status: done`, update the index, and propose AGENTS.md edits (storefront data layer deployed, catalog and category tree, the "one external call" rule reworded, Node path).

## Files

- Create (kit, by deploy): `src/wix/storefront/{catalog,catalog-core,cart,cart-core,cart-store,shop-store,product-detail-store}.ts`, `src/hooks/storefront/{useShop,useProductDetail,useCart}.ts`, `src/components/storefront/{CartButton,CartDrawer,FilterPanel,OptionPicker,QuickAdd}.tsx`
- Create (git-ignored): `.seed/store-plan.json`, `.seed/seed-result.json`, `.seed/category-tree.mjs`
- Change: `package.json`, `package-lock.json`, `.gitignore`, `src/pages/index.astro`, `src/data/mock.ts`, `prompts/README.md`, this plan
- Wix (live site): Stores app installed, currency USD, 12 products with 24 images, 11 categories

## Acceptance criteria

- WHEN the Wix dashboard's Products page opens THE STORE SHALL list the 12 Kix sneakers with their prices, compare-at prices, ribbons, 2 colorways with photos, and sizes as variants, all in stock.
- WHEN a shopper opens `/` THE SITE SHALL show the children of Sports under Shop by Category (with category images), the 3 New Arrivals and the 4 Popular products, server-rendered from Wix with live prices.
- WHEN a product has a compare-at price THE CARD SHALL show the price with a labelled struck "was" price and the merchant's "Sale" ribbon. It shall never show a computed percent.
- WHEN the catalog read fails or a curated category is missing THE HOME PAGE SHALL still render, without that section, and log the error on the server.
- WHEN any kit file is deployed THE PROJECT SHALL keep our existing `SiteLayout.astro`, `global.css` and `config.ts` unchanged.

## Verification

- Command output: `deploy.mjs` and `install.mjs` JSON; `npm run check`; `npm run build`; the seed result JSON (created counts, `failures`, `imageFailures`, `choiceImagesLinked`, `preexisting`); the category script output; `read-site.mjs` before and after.
- Images: a contact sheet of the 24 colorway photos, as inspected.
- Pages: `/` at 1440px and 390px on `localhost:4321` (`npx astro dev --port 4321`, Node 24.18), compared with the home design; the forced-error screenshot.
- Wix dashboard: Products and Categories pages (links in the report).

## Risks and open questions

- **Wix AI credits:** ~24 for the photos, more if any image is regenerated. Credits are spent when step 3 runs.
- **AI brand marks:** a generated sneaker can pick up a swoosh-like stripe. Step 4 catches it. Replacing an image takes a changed prompt and a re-run, and the rejected image stays in the gallery until someone deletes it (step 4).
- **Two colorways, two different shoes:** each colorway is a separate text-to-image call, so the two photos may show different shapes. Identical shoe phrases in both prompts reduce the risk; step 4 checks it. If they still differ, stop and ask.
- **Main image:** products get no product-level image, so the main image is the first gallery item, the first colorway. If a product reads back with no main image, step 5 fails loudly. The fix is a re-run of the seed, which re-attaches.
- **Wix sample catalog:** installing Stores adds about a dozen Wix sample products ("Baseball Cap" and others). They aren't in our categories, so the home page won't show them, but the future explore page (all products) will. The owner deletes them in the dashboard.
- **Auto slugs:** the seed doesn't set category or product slugs. Wix derives them from names; steps 5–6 check them.
- **AGENTS.md rule conflict:** "one external call per request" can't hold for SSR catalog pages (home makes 3 kit calls, which is 6 Wix sub-requests; the kit's category page makes more). The 20-sub-request limit is the real constraint. At close-out, propose rewording it to "few external calls per request, in parallel where possible, well under 20".
- **Skill version:** the plugin's `wix-headless-kit` reports newer upstream files. The storefront templates used here are the 1.35.0 ones already in `node_modules`. Upgrading is a separate step.
- **Payments:** until a payment method and a premium plan exist, Wix checkout says "We can't accept online payments." That matters for the cart plan, not this one.

## Result

Filled at close-out.
