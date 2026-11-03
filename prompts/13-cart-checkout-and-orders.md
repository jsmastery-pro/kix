# 13 · Cart page, checkout, design codes on orders, order history and paid-order revenue

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Build the cart page from the attached design using Wix's cart, and send shoppers to Wix's hosted checkout with a thank you page at the end. Let shoppers add a customized shoe to the cart with its design code, using the wix manage skill to add a design code field to the products. Show past orders on the account page, and use the wix app skill to add a backend event that sends every paid order to PostHog with its revenue." (Plus the cart design image.)

## Goal

- A shopper opens `/cart` from the header bag. They see their lines, change quantities, remove lines and apply or remove a promo code, all on Wix's cart. The totals come from Wix's estimate.
- **Checkout** sends them to Wix's hosted checkout. A finished order lands on `/thank-you`, which shows the order. An abandoned checkout returns to `/cart`.
- A shopper who customized a shoe in 3D (plan 12) adds that pair to the cart with a short **design code** (`KIX-D6S0`). The code shows on the cart line, the order, the thank-you page and the account's order history, and links back to the shoe in 3D, so the store owner can see what to make.
- A signed-in member sees their past orders on `/account`.
- Every paid order sends one `order_paid` event to PostHog with its revenue, from a Wix backend event on the live site.

## Out of scope

- A cart drawer. The kit's `CartButton` and `CartDrawer` stay unused, and the bag goes to `/cart`.
- Shop Pay or any other wallet button. Wix's hosted checkout shows the payment methods the owner connects.
- A note to the seller, gift cards, and subscriptions in the cart. The kit supports them, but the design doesn't show them and the catalog has none.
- Order detail pages, reorder, tracking, returns and cancellations.
- Hiding products already in the cart from You Might Also Like (the cart is only known in the browser).
- Real payments. The owner connects them (the links are in the report).
- A `/customize` page, and wishlist or ratings (no data, as in plan 09).

## Decisions

**Answered by you:**
- **Design code: a short color code.** It's `KIX-` plus four characters, one per zone in `ZONES` order (upper, sole, laces, accent):
  - `0`–`9`, `A`–`F`: the `PALETTE` color at that index (`0` White … `D` Navy … `F` Grape).
  - `S`: the stock color, meaning that zone's color in the preset of the line's Color.
  - `-`: the model has no such part.

  Examples:
  - `KIX-D6S0` on Kix Court 1 Retro, Black / Sail: upper Navy, sole Red, laces stock, accent White.
  - `KIX-D6--` on Kix Nightshift High, which has only upper and sole: upper Navy, sole Red.

  **Encoding rules:**
  - Per zone, in this order: `-` when the model lacks the zone; `S` when the shown hex equals the stock hex (case-insensitive, like plan 12's twin-swatch `same()`); else the palette index; else the design can't be encoded (null).
  - A zone the model *has* must be `S` or a palette character. `-` there means the code doesn't fit.
  - A zone the model *lacks* must be `-`.
  - **"Custom"** means at least one character in `0-9A-F`. `KIX-SSSS` (all stock) and `KIX-SS--` (all stock on a 2-zone model) aren't custom, so they add as stock.

  It works signed out and needs no saved design. The palette's order becomes order data, so `PALETTE` is **append-only and capped at 16** (a 17th color needs a `KIX2-` format; noted in `palette.ts`).
- **Release: in the plan.** After every local check passes, step 13 runs one `release --version-type major` (the first event extension needs a major release) and tests the event live.
- **Coupon: I create `KIXTEST` (10% off)** with the wix-manage recipe `references/ecommerce/pricing-promotions/ecom-pricing-create-coupon.md`. You can delete it after.
- **Test order: manual payments.**
  - You turn on manual (offline) payments.
  - I place a test order as the member through the real checkout.
  - I mark it paid as admin with Add Payments (`POST https://www.wixapis.com/ecom/v1/payments/orders/{orderId}/add-payment`, one payment with `amount` = the order total and `regularPaymentDetails.offlinePayment: true`). Wix then recalculates `paymentStatus` asynchronously. If that leaves it unpaid, you press Mark as Paid on the order in the dashboard.

**Design code field (wix-manage).**
- Every one of the 12 Kix sneakers gets one Catalog V3 free-text modifier: `{ name: "Design code", mandatory: false, modifierRenderType: "FREE_TEXT", freeTextSettings: { title: "Design code", maxCharCount: 20 } }`. That's the seed's `buildModifiers` shape.
- It's added with Update Product (`PATCH /stores/v3/products/{id}`). The PATCH sends the product's `revision` and its whole existing `modifiers` array plus this one, following the recipe's full-array rule.
- `mandatory: false` keeps stock adds working, and the kit's `useProductDetail` already sends a filled free-text modifier as `customTextFields[freeTextSettings.key]`.
- The PDP never renders the field. The island sets it.
- The script is `.seed/design-code.mjs` (git-ignored, like `info-sections.mjs`). It runs locally on the CLI site token, is idempotent (it skips a product that already has a modifier titled "Design code"), and takes `--only <slug>` for the spike.

**Product page (plan 12's island).**
- **"Customized" for the cart** means `design.override !== null` and the code of `design.shown` is custom. `override`, not `custom`, catches a loaded design whose stock color can't be picked, even after Reset, since its own colors are still on show.
- **Picking the Color already on show no longer starts over.** Today `select()` calls `design.startOver()` whenever `override` is set (`ProductView.tsx:63-67`), so a shopper who customizes before choosing a Color, then presses Add to Cart and is sent to the Color group, loses the design. The fix: skip `startOver()` when the picked `choiceId` equals `design.base.choiceId` and the design has no own base (`baseOverride`).
- **Add to Cart while customized** needs a picked Color (the kit already blocks the add without one). It computes the code from `design.shown` against the **selected** Color's preset, calls `d.setModifier(designKey, code)`, then `d.add()`. A stock add first clears the field (`setModifier(designKey, '')`), so the kit sends nothing.
- If a zone can't be encoded (a loaded design whose stock color can't be picked keeps colors that are neither palette nor stock), the add is blocked. The status line reads "This design has colors we can't order. Reset a part or pick from the palette."
- If the product has no Design code field, a customized add is blocked with "Custom pairs can't be ordered for this sneaker yet." and reported with `captureError`.
- **The panel note** replaces plan 12's "Add to Cart adds the stock color…". `CustomizePanel` gets a new prop, `cartNote: { kind: 'stock' } | { kind: 'code', code } | { kind: 'unencodable' } | { kind: 'no_field' }`, computed in `ProductView`:
  - `stock` (nothing custom yet): "Add to Cart adds the stock color. Change a part to make it yours."
  - `code`: "Add to Cart adds this design. Design code KIX-D6S0."
  - `unencodable`: the blocked-add text above.
  - `no_field`: "Custom pairs can't be ordered for this sneaker yet."

  The note sits in a polite live region.
- **After an add**, the status line reads "Added to your bag." with a **View bag** link to `/cart`.
- **Deep link `?code=KIX-…&color=<choice name>`:** anyone can open it, signed out included, and the cart, thank-you page and order history use it.
  - **Decoding:** `S` decodes against the **named** Color's preset in `model.presets`, whether or not that Color is in stock.
  - **Loading:** through plan 12's `applyDesign({ baseChoiceId, baseColor, zones })`. It picks the Color when it can, and otherwise keeps the decoded colors as Original. It opens 3D and the panel with an unsaved design.
  - **A Color name that doesn't match:** a code with no `S` decodes against nothing and still opens. A code with an `S` shows "doesn't fit". Both params leave the URL once read. An invalid code, or a part the model doesn't have, shows the frame note "This design code doesn't fit this sneaker." With no model row, it shows plan 12's "3D isn't available…" note. It runs after mount, beside plan 12's `?design=` handling.

**Cart page (the design).**
- Built on the kit's `useCart` in a `CartView` React island (`client:only="react"`, server fallback = skeleton). No cart logic is rewritten. Quantity, remove and coupon call the hook, and errors show `cart.error`.
- **Checkout** uses a new `checkoutUrlWithReturn()` in `src/wix/storefront/checkout.ts`. The kit's `checkoutUrl()` hard-codes both callbacks to `/` and says never to edit it.
  - The new function copies its body exactly (same `getCurrentCart` → `assertCheckoutable` → `createRedirectSession({ ecomCheckout: { checkoutId } })` sequence, the same `cart-core.ts` helpers). Only `callbacks` change: `thankYouPageUrl: ${origin}/thank-you` (Wix appends `orderId`) and `postFlowUrl: ${origin}/cart`.
  - The island keeps its own `checkingOut` flag and shows the error inline.
  - *Raised for your OK:* the kit's hard rules say "checkout only through the shipped cart (`checkout()`)". The alternative keeps `checkout()` and has the home page forward `/?orderId=…` to `/thank-you`. That works, but an abandoned checkout then lands on the home page instead of the cart, and home gains a redirect. I recommend the new function.
- **Shipping row:** "Calculated at checkout" in secondary text, not the design's green FREE (kit hard rule and AGENTS voice rule). The `?` help icon has the tooltip and accessible name "Shipping is worked out at checkout from your address."
- **Tax:** a "Tax · Calculated at checkout" row, unless `cart.taxes` has rows (show them) or `pricesIncludeTax` (no row). Any `cart.fees` show as rows.
- **Discount:** shows `cart.discount` as `−$x` in `--color-success`, labelled with the discount's name when `cart.discounts` has one, else "Discount". It shows only when there is one.
- **Total** is `cart.total`, with a 14px secondary note under it: "Shipping and tax are added at checkout."
- **The OR divider and Shop Pay button are dropped.** They're a real brand's mark (AGENTS brand rule).
- **Perks under the promo box use plan 09's truthful copy:** Truck "Shipping · Calculated at checkout", Package "Returns · Per our store policy", ShieldCheck "Secure Checkout · Hosted by Wix". The design's "Free shipping over $50" and "30-day returns" have no data source.
- **Line text:**
  - The name links to `/products/<slug>` once `line-links.ts` knows the line's slug. Until then, or if the lookup fails, the name is plain text.
  - The "Color: …" description line shows without its label (as in the design). Other lines show as `Label: value`.
  - The Design code line becomes a `ui-badge--custom` "Custom" badge next to the name, plus "Design KIX-D6S0 · See it in 3D" (link: `/products/<slug>?code=…&color=…`).
  - The struck price is `compareAtLinePrice`. A line not `IN_STOCK` shows the kit drawer's buyer copy in `--color-error`, and Checkout is disabled with "Remove or change the items marked above."
- **Recommendations:** You Might Also Like is server-rendered from the `popular` category: 4 `ProductCard size="wide"` cards (plan 09's), tones aqua, peach, coral and periwinkle. "View all" goes to `/category/popular`. No star ratings. If the read fails, the section is hidden and the error logged.
- **States:**
  - **Loading** (`cart === null`): two skeleton lines and a skeleton summary.
  - **Empty:** "Your bag is empty." plus a primary "Find your pair" button to `/shop`. The summary card is hidden; recommendations still show.
  - **Busy:** the steppers, remove and apply are disabled, and the lines dim (`ui-busy`).
  - **Errors:** `cart.error` in a `role="alert"` line under the heading.
  - The kit's `fetchCart` turns a read failure into an empty cart, so a read error shows as empty. That's a known limit.
- **Header:** no nav item is current on `/cart`. The bag count stays live.

**Thank-you page.** There's no design, so it uses design-system primitives. `/thank-you` renders a `ThankYouView` island (`client:only`) that reads `?orderId` and calls `fetchOrder(orderId)`, which is `orders.getOrder` under the shopper's own ambient session. The docs say a visitor or member gets only orders they placed.
- **Shows:** "Thank you" (`ui-page-title`), "Order #10023 is in.", a payment-status badge, the lines (photo, name, color, size, design code with its 3D link, quantity and price), the total, and buttons "Keep shopping" (`/shop`) and, for members, "See your orders" (`/account#orders-title`).
- **Unreadable or missing order:** "Thank you. Your order is in. Your confirmation has the details." plus Keep shopping. It's logged with `captureError(…, 'order_load')`.
- It calls `refreshCart()` so the bag count drops to 0.
- `order_completed { order_id }` is sent once per order (a `sessionStorage` guard, try/catch).
- The page sends the headers `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` (set in `thank-you.astro`; SiteLayout has no noindex prop).

**Account orders.** An **Orders** card (`FormCard`, heading id `orders-title`, full width) sits above Saved Designs.
- **Read** on the server by `src/wix/storefront/member-orders.ts` (server-only):
  - First try `orders.searchOrders` as the member, unelevated.
  - If step 1 shows that's refused, use `auth.elevate(orders.searchOrders)`. That runs only after `fetchCurrentMember()` returned the member, and filters `buyerInfo.memberId $eq member.id`, so the caller check is the filter (AGENTS elevate rule).
  - Sort `_createdDate` DESC, limit 10. Search Orders already hides `PENDING`, `REJECTED` and `INITIALIZED` orders.
- **Each order:** "Order #10023", the date (local time, as plan 12 rewrites it), a status badge, the total, then each line as a 56px thumbnail with "Name × qty · Color · Size · Design KIX-…" (the code links to 3D).
- **Status badges** (from `paymentStatus`, with `status` CANCELED first):
  - Paid: `ui-badge--success`.
  - Not paid or pending: "Payment pending", `ui-badge--limited`.
  - Partially paid, Refunded, Partly refunded and Canceled: `ui-badge--info`.
- **Empty:** "No orders yet." plus "Find your pair".
- **Error:** "We couldn't load your orders. Refresh to try again." with `data-orders-error`, reported in the browser as `order_list`.

**Paid-order event (wix-app).**
- **Files:** a backend event extension scaffolded with `npm run generate` (`wix generate`, `extensionType: EVENT`, folder `order-paid`):
  - `src/extensions/backend/events/order-paid/order-paid.extension.ts`
  - `order-paid.ts`
  - the registration in `src/extensions.ts`.
- **Handler:** `orders.onOrderPaymentStatusUpdated`. It sends only when `order.paymentStatus === 'PAID'` and `previousPaymentStatus !== 'PAID'`. `onOrderApproved` also fires for unpaid offline orders.
- **The request:** one POST to PostHog's capture API (`${PUBLIC_POSTHOG_HOST}/i/v0/e/`; shape confirmed against https://posthog.com/docs/api/capture at build). The body:
  - `api_key`: the public project token, so no new secret.
  - `event: 'order_paid'`.
  - `uuid`: the Wix event's `metadata._id`, so a redelivery is deduplicated.
  - `timestamp`: the event time.
  - `properties: { revenue, currency, order_id, order_number, item_count, customized_count }`. `revenue` is `Number(priceSummary.total.amount)`.
- **`distinct_id`:** the buyer's `memberId` when present, the same ID `identifyMember()` uses, so revenue joins the member's browsing. Otherwise `order_<orderId>` with `$process_person_profile: false`.
- **No personal data:** no email, name, address or contact ID.
- **Failures:** a 5 s timeout. A failure is logged and rethrown, so Wix can retry (deduplicated by `uuid`). It makes 1 sub-request.
- **A second, server-side analytics door.** `track()` is browser-only, so `src/scripts/analytics-server.ts` exports `captureServer<E extends keyof ServerAnalyticsEvents>()`, typed by a `ServerAnalyticsEvents` catalog in `analytics.ts`. *This extends AGENTS' "one `track()` wrapper" rule to one wrapper per runtime, with one catalog file. Say so if you'd rather not.*
- **Env:** the handler reads `PUBLIC_POSTHOG_*` from `astro:env/client`. If that import doesn't work in an event extension (step 10 spike), it falls back to `import.meta.env`, and I stop and ask before adding a server secret.
- **App permission:** the event and the elevated search need `SCOPE.DC-STORES.READ-ORDERS` on the app whose ID is in `wix.config.json`. `wix.config.json` doesn't list scopes, so you check it, and add it if missing, in the app dashboard: `https://manage.wix.com/apps/<appId>/home` → Develop → Permissions, then re-approve on the site. That happens before step 9 when spike 1c shows elevation is needed, else before step 10.

**Analytics (catalog additions; no codes typed by shoppers, no coupon text, no personal data):**
- `product_added_to_cart` gains `customized: boolean`.
- `design_code_opened { product_id }` (`?code=` link).
- `cart_quantity_changed {}`, `cart_line_removed {}`.
- `coupon_submitted { outcome: 'applied' | 'rejected' }`.
- `checkout_started { item_count, customized_count }`, sent with `{ beacon: true }` since the page navigates away right after.
- `checkout_failed { reason }`.
- `order_completed { order_id }` (browser, thank-you).
- `order_paid` (server; above).
- `ErrorArea` gains `cart_update`, `checkout`, `order_load`, `order_list`, `design_code`.

**Phone layout (≤ the existing phone breakpoint):**
- Page inset 16px. The title is 44px. "Continue shopping" moves under the count.
- **Each line is a 2-column grid:** a 112×100 image, then name, color, size, price and was-price stacked. The stepper and Remove row spans the full width under them.
- The summary and promo cards are full width, below the lines. Checkout isn't sticky.
- Recommendations are 2 columns (as `pdp__related-grid` on phones).
- Tap targets are at least 44px.

## Context

- **Read:** `AGENTS.md`; plans 09 and 12; `src/wix/storefront/{cart,cart-core,cart-store,catalog-core,product-detail-store,types}.ts`, `src/hooks/storefront/{useCart,useDesign}.ts`, `ProductView.tsx`, `BagButton.tsx`, `CartDrawer.tsx` (line status copy), `ProductCard.astro`, `src/pages/{account,products/[slug]}.astro`, `src/wix/models/{palette,presets}.ts`, `analytics.ts`, `PostHog.astro`, `global.css` (tokens, `ui-quantity`, `ui-form-card`, `ui-perk-card`, `ui-page-title`, `ui-badge--*`), `site.css`, `.seed/info-sections.mjs`, `scripts/models/models.mjs` (`wix()` token).
- **Skills:** `wix-headless-kit` and the storefront `INSTRUCTIONS.md` (cart contracts, hard rules: totals from the estimate, shipping and tax at checkout, checkout only through the cart's redirect session), `wix-manage` (stores update recipe, coupon recipe), `wix-app` (backend events), `wix-docs`.
- **Wix docs** (installed `@wix/ecom` 1.0.2623, `@wix/redirects` 1.0.132, `@wix/astro` 3.1.0, `@wix/cli` 1.2.2):
  - Create Redirect Session (`thankYouPageUrl` gets `orderId`; `postFlowUrl`): https://dev.wix.com/docs/api-reference/business-management/headless/redirects/create-redirect-session.md
  - Allowed redirect domains: https://dev.wix.com/docs/go-headless/authentication/setup/allow-redirect-uris-and-domains.md
  - Get Order (member or visitor gets only their own): https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/get-order.md
  - Search Orders (`buyerInfo.memberId`, `_createdDate`): https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/search-orders.md
  - Elevate in Astro: https://dev.wix.com/docs/go-headless/authentication/admin/elevate-api-call-permissions-with-the-astro-integration.md
  - Payment Status Updated event: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/payment-status-updated.md
  - Event extension files: https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/extensions/backend/events/event-extension-files-and-code.md
  - Backend extension limits: https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/extensions/backend/about-backend-extensions.md
  - Catalog V3 free-text `customTextFields`: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/e-commerce-integration.md
  - Update Product: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/update-product.md
  - Add Payments: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/add-payments.md
- **Design:** the cart image. Its canvas is 1024px wide, and its content (x 57–992) maps to the header bar's 1310px content box at 1440, so **×1.41**. Every size below is that estimate, tuned in step 11.

## Approach

### Cart page layout at 1440 (estimated ×1.41 from the image)

**Container:** the header bar's box, `width: min(var(--site-wide-max), 100% - 2 * var(--site-wide-inset)); padding-inline: clamp(16px, 2.6vw, 37px)`. The top margin is about 88px (`clamp(32px, 6vw, 88px)`). The page background is the site's.

**Grid:** `.cart` has columns `minmax(0, 742fr) minmax(0, 516fr)` with a 56px gap.

**Left column:**
- **Heading:** "YOUR CART" in a new `ui-page-title--lg` (display, 700, `clamp(44px, 5.6vw, 80px)`, line-height .95).
- **Count:** "3 ITEMS" (`cart__count`: display 600, `clamp(20px, 2.1vw, 30px)`, uppercase, `--color-text-secondary`, 8px below). "1 ITEM" when singular.
- **Lines** start 48px below the count. Each line is a `ui-cart-line`:
  - A grid `306px 1fr`, gap 28px, `padding-block: 36px`, a 1px `--color-border` bottom border (the first line has no top padding, the last no border).
  - **Image:** 306×274, `--radius-sm`, tone background cycling peach, mint, lilac (`ui-tone--*`), product photo contained. The fallback is `ui-photo__fallback`.
  - **Body:** flex column.
    - Top row: name on the left and price on the right.
      - Name: display 700, 26px, uppercase, line-height 1.15.
      - Price: display 700, 30px; was-price below it, 20px, `--color-text-secondary`, struck.
    - Color: display 400, 20px, secondary, 8px gap.
    - Size and other lines: display 500, 20px, black, 12px gap.
    - Design row (custom lines): 16px, secondary, with the "See it in 3D" link underlined.
    - Bottom row (`margin-top: auto`): the stepper on the left and Remove on the right.
  - **Stepper:** a new `ui-quantity--cart` variant at 180×60 (three 60px cells), with `--color-muted-fill` minus and plus cells.
    - Labels: "Decrease quantity of <name>" and "Increase…". The output is `aria-live="polite"`.
    - Minus is disabled at 1. Plus is disabled at `availableQuantity`.
  - **Remove:** `ui-text-button` with no underline, lucide `Trash2` at 20px plus "Remove" (display 500, 20px), and `aria-label` "Remove <name>".

**Right column:**
- **Continue shopping:** right-aligned at the top, display 600 20px uppercase secondary, plus `ArrowRight` 20px, linking to `/shop`.
- The cards start about 40px below it.
- **Order summary card:** `ui-form-card` look (white, border, `--radius-lg`, panel shadow), padding 36px.
  - Title "ORDER SUMMARY": display 700, 40px.
  - Rows: 24px label (secondary) and value (black), 53px pitch.
  - Divider, then Total: "Total" display 600 36px and the value display 700 42px, then the note.
  - Checkout: `ui-button ui-button--primary ui-button--lg ui-button--wide`, label "Checkout" uppercase display. Busy label "Opening checkout…".
- **Promo card:** the same card style, 32px below.
  - Title "PROMO CODE": display 700, 28px.
  - Row: a `ui-field` input (placeholder "Enter promo code", `autocomplete="off"`, label "Promo code" sr-only) plus a black "Apply" button 112px wide, 14px gap.
  - Applied: lucide `Tag` in `--color-success`, "KIXTEST applied!" (success, display 500 20px), and an `X` icon button "Remove code KIXTEST".
  - The error is `ui-status-line--error`.
  - Then a divider, then 3 perk rows (icon 32px; title display 500 20px; text 18px secondary; dividers between).

**Recommendations:** `SectionHeading` "You Might Also Like" (compact, with View all), then a 4-column grid with the `pdp__related-grid` gaps. Margin-top is `--site-section-gap`.

**New primitives** (`global.css`; existing tokens, no new colors):
- `ui-page-title--lg`
- `ui-cart-line` (and `__media`, `__body`, `__top`, `__name`, `__price`, `__meta`, `__design`, `__actions`, `__status`)
- `ui-quantity--cart`
- `ui-summary` (card rows: `__row`, `__total`, `__note`)
- `ui-promo` (`__row`, `__applied`)
- `ui-order-row` (account and thank-you lines)

**Proposed size additions:** none as tokens, since font sizes and paddings live in the primitives today, as `ui-page-title` does.

### Data and modules
- `src/wix/models/design-code.ts` (client-safe):
  - `encodeDesignCode(shown, stockZones, zonesOnModel): string | null`. Null means a zone can't be encoded.
  - `decodeDesignCode(code, stockZones, zonesOnModel): ZoneColors | null`.
  - `isCustomCode(code)`: at least one character in `0-9A-F`.
  - `findDesignCode(descriptionLines): string | null`, matching `/(?:^|[\s:])(KIX-[0-9A-FS-]{4})(?=\s|$)/` on each line. No trailing `\b`, because a code can end in `-`.
  - `designLink(slug, code, colorName)`.
- `src/wix/storefront/checkout.ts`: `checkoutUrlWithReturn()`.
- `src/wix/storefront/orders.ts` (client-safe):
  - The `OrderSummary` DTO: `id`, `number`, `createdDate`, `paymentStatus`, `status`, `total`, `currency`, and `lines: { name, quantity, imageUrl, price, color, size, designCode, productSlug }`.
  - The `toOrder(raw)` mapper and `fetchOrder(id)`.
  - Each line keeps `productId` (`catalogReference.catalogItemId`). `productSlug` is filled by `fetchProductSlugs` (below).
  - Images go through `imgSrc`; money through `formatMoney`.
- `src/wix/storefront/line-links.ts` (client-safe; **added after spike 1e, approved by you**). Wix cart lines carry no product URL (the kit's `productUrl` is always `""`); a line only has `source.catalogReference.catalogItemId`. Two functions:
  - `fetchCartLineProducts(): Map<lineItemId, productId>` reads the current cart once through `currentCartV2.getCurrentCart()`.
  - `fetchProductSlugs(ids): Map<productId, slug>` runs one `productsV3.queryProducts().in("_id", ids)`, the call the kit's `cart.ts` uses for line images.
  - Both results are cached in module scope for the session. `CartView` reads the lines' products only when a line ID is new.
  - Line names and "See it in 3D" link only when a slug is known.
- `src/wix/storefront/member-orders.ts` (server-only; imports `auth` from `@wix/essentials` only if the elevated path is needed): `fetchMemberOrders(memberId, limit)`.

### Sub-requests
- `/cart`: 4 (`fetchCategories` 2 plus one product list 2), to find `popular` and read it. If the categories call fails, the section is hidden.
- `/thank-you`: 0 on the server. The browser makes 1 slug query.
- `/account`: from 2 to 4 (member, then designs and orders in parallel, then one slug query for the orders' products).
- `/cart` in the browser: the kit's reads, plus 1 cart read and 1 slug query when a new line appears.
- The event handler: 1.

## Steps

- [x] 1. **Spikes, before any UI.** The check for each is its printed output.

  **Results:**
  - a. ✅ Customization `2d788cc3-…` was created. The modifier key is `Design code`.
  - b. ✅ Two separate lines. The coded line's `descriptionLines` are `Color: Team Red / White`, `Size: 7`, `Design code: KIX-D6S0`.
  - c. ⏸ The unelevated search returned 200 with 0 orders, since no orders exist yet. It's re-run in step 9.
  - d. ✅ The session was created. Checkout carries `ecom-typ` = `/thank-you` and `home` = `/cart`, and the page loads both lines. It offers "I just want to place a test order".
  - e. ❌ There is no URL on Wix's cart line. You approved `line-links.ts`.
  - a. Add the Design code field to one product (`node .seed/design-code.mjs --only kix-court-1-retro`) and read back the modifier's `freeTextSettings.key`.
  - b. On `localhost:4321`, through the kit's exports from the console:
    - add the same variant twice, once stock and once with a code;
    - read the cart: are there two lines, and what are their `descriptionLines` and `productUrl`?
  - c. As the member, call `searchOrders` unelevated.
  - d. Write `src/wix/storefront/checkout.ts` now, call `checkoutUrlWithReturn()`, and open the redirect to see whether Wix accepts the `localhost:4321` callbacks.
  - e. Record the cart line's `productUrl` format.

  **Stop and ask** if:
  - the coded add merges into the stock line;
  - the field can't be added by Update Product;
  - checkout can't return to localhost. The fallback is testing the return on `npm run preview`.
  - `productUrl` doesn't give the product slug. The 3D links then need a slug lookup this plan didn't approve.
- [x] 2. **The field on all 12.** Run the script for every product, then re-run it. (check: 12 updated, then 12 skipped; `/shop` filters unchanged at 1440 (no new facet); a PDP stock add still works.)
- [ ] 3. **Analytics catalog** additions and `ServerAnalyticsEvents`. (check: `npm run check`.)
- [ ] 4. **Design code on the product page.** Add `design-code.ts`, the palette comment, the add-with-code path, the note, View bag, and the `?code=` link. (check in Chrome:
  - customize Court 1 Retro, then add: the cart line carries the right code;
  - a stock add has no code;
  - `?code=` reopens the same colors signed out;
  - a bad code shows its note;
  - `KIX-SSSS` adds as stock;
  - customizing before choosing a Color, then picking the Color on show, keeps the design;
  - Nightshift High gives a `KIX-xx--` code;
  - a loaded design with an unpickable stock color, after Reset, still adds with its code.)
- [ ] 5. **Checkout function and cart page.** Add `checkout.ts`, `/cart`, `CartView`, the CSS and recommendations. (check: quantity ±, cap, remove, empty state, loading skeleton, a busy dim, an unavailable line blocking Checkout (forced by a temporary status override, reverted), Checkout reaching Wix's checkout page.)
- [ ] 6. **Coupon.** Create `KIXTEST` with the recipe. (check: apply shows the applied row and the discount in the totals; remove restores them; a bad code shows "That code doesn't exist…" and sends `coupon_submitted` `rejected` without the text.)
- [ ] 7. **You turn on manual payments.** I give you the link and wait.
- [ ] 8. **Thank-you page.** Add `orders.ts` and `/thank-you`. (check:
  - as the member, a real checkout of a customized and a stock pair with manual payment lands on `/thank-you?orderId=…`;
  - the order shows with both lines, the code and its 3D link, and "Payment pending";
  - the bag shows 0;
  - a bogus `orderId` and a missing one show the fallback;
  - `order_completed` fires once across a reload.

  **Stop and ask** if Wix's checkout refuses the order ("We can't accept online payments") even with manual payments on. That points to the plan or payment setup, and the fallback is you placing the order from the dashboard's own checkout.)
- [ ] 9. **Account orders.** Add `member-orders.ts` and the Orders card. (check:
  - the test order is listed newest first with its code;
  - the empty state shows (a temporary filter on a fake member ID, reverted);
  - a forced read error shows its text and `$exception`.)
- [ ] 10. **Backend event.** Run `npm run generate -- --params '{"extensionType":"EVENT","folder":"order-paid"}'`, then add the handler and `analytics-server.ts`. You confirm the Read Orders scope in the app dashboard. (check: `npm run check` and `npm run build` pass, and the extension appears in `.wix/build-metadata.json`'s topology.)
- [ ] 11. **Layouts.** Compare `/cart` (full, empty, coupon applied, a custom line) with the design at 1440 and 390 (390 through a same-origin iframe). Use design-system primitives for `/thank-you` and the Orders card. List every difference, fix, repeat. (check: screenshots; no horizontal overflow at 390; tap targets ≥ 44px.)
- [ ] 12. **Checks.** Run `npm run check` and `npm run build`. (check: 0 errors, build Complete, `dist/server` doesn't contain three, and the client bundle has no `elevate`.)
- [ ] 13. **Release and live test.** Run `npm run release -- --version-type major --comment "Cart, checkout, orders, paid-order event (plan 13)"`. Then mark the step-8 test order paid with Add Payments. (check:
  - the release prints the live URL;
  - the order turns Paid in `/account` on the live site;
  - one `order_paid` with `revenue` equal to the order total, `currency`, and `distinct_id` = the member ID is in PostHog. You see it in Activity, since the MCP is unauthorized. The delivery shows in the app dashboard's Webhooks → Logs;
  - a second payment-status update sends nothing. To trigger one, a second test order is placed and left unpaid, then marked paid twice: Add Payments for half the total (PARTIALLY_PAID, no event), then for the rest (PAID, one event).)
- [ ] 14. **Review.** A reviewer subagent compares the work with this plan; fix real gaps.
- [ ] 15. **Close out.** Write the Result, set `Status: done`, update the index, and propose AGENTS.md edits:
  - "Who owns what": cart page, checkout return, the Design code field and format, orders, the event extension and the server analytics door.
  - Remove "Add to Cart doesn't carry a design yet" and "`/cart` 404s".

Each step is committed when its check passes.

## Files

- **Create:**
  - `prompts/13-cart-checkout-and-orders.md`
  - `src/pages/cart.astro`, `src/pages/thank-you.astro`
  - `src/components/storefront/CartView.tsx`, `src/components/storefront/ThankYouView.tsx`
  - `src/wix/storefront/checkout.ts`, `src/wix/storefront/orders.ts`, `src/wix/storefront/member-orders.ts`, `src/wix/storefront/line-links.ts`
  - `src/wix/models/design-code.ts`
  - `src/scripts/analytics-server.ts`, `src/scripts/orders.ts` (account card's browser error report)
  - `src/extensions.ts`, `src/extensions/backend/events/order-paid/{order-paid.extension.ts,order-paid.ts}` (generated, then filled)
  - `.seed/design-code.mjs` (git-ignored)
- **Change:**
  - `src/components/storefront/ProductView.tsx`, `src/components/storefront/CustomizePanel.tsx` (note text)
  - `src/wix/models/palette.ts` (append-only comment)
  - `src/scripts/analytics.ts`
  - `src/pages/account.astro`
  - `src/styles/global.css`, `src/styles/site.css`
  - `src/components/storefront/BagButton.tsx` (comment only)
  - `.wix/` (generated)
  - `prompts/README.md`; `AGENTS.md` at close-out after you OK the edits.
- **Wix:**
  - a Design code modifier on the 12 Kix products;
  - the coupon `KIXTEST`;
  - one test order (marked paid);
  - a major app version released to the live site.

## Acceptance criteria

- WHEN a shopper opens `/cart` THE SITE SHALL show the Wix cart's lines with photo, name, color, size, price, struck price, quantity stepper and Remove, and an order summary whose totals come from Wix's estimate.
- WHEN the shopper changes a quantity, removes a line or applies a valid code THE SITE SHALL update the lines and totals from Wix, and SHALL show Wix's buyer copy when the change is refused.
- WHEN the cart is empty THE SITE SHALL say so with a link to the shop, and WHEN it is loading THE SITE SHALL show skeletons.
- WHEN the shopper presses Checkout THE SITE SHALL open Wix's hosted checkout, and WHEN the order completes THE SITE SHALL show `/thank-you` with that order.
- WHEN a shopper adds a customized shoe THE SITE SHALL add it with its design code, and SHALL show the code, linking to the shoe in 3D, on the cart line, the thank-you page and the account's order history.
- WHEN anyone opens `/products/<slug>?code=<code>` THE SITE SHALL open 3D with that design, or say the code doesn't fit.
- WHEN a signed-in member opens `/account` THE SITE SHALL list only their own orders, newest first.
- WHEN an order's payment status becomes Paid THE SITE SHALL send one `order_paid` event to PostHog with the order's revenue and currency and no personal data.
- THE SITE SHALL NOT show free-shipping, returns-window or wallet-brand claims the store has no data for.

## Verification

- `npm run check` and `npm run build` output; `release` output with the live URL.
- `.seed/design-code.mjs` output (12 updated, then 12 skipped).
- The spike outputs (step 1).
- Chrome on `localhost:4321`:
  - screenshots at 1440 and 390 of `/cart` (full, empty, coupon applied, custom line), `/thank-you` (order and fallback), and `/account` Orders (list, empty, error);
  - the cart JSON showing the coded line.
- The PostHog debug log (or a `posthog.capture` spy) for each new browser event, showing only catalog properties.
- The `order_paid` event in PostHog (your screenshot or check), with the test order's numbers.
- Report which values were estimated from the image (every size above), and the test data left in Wix.

## Risks and open questions

- **Merge of coded and stock lines** of the same variant is undocumented. Step 1 checks it.
- **The checkout return to `localhost`** may not be an allowed domain. The fallback is a preview URL (`npm run preview`; backends stop after 3 days).
- **`getOrder` after checkout** depends on the shopper's session surviving the round trip. It's documented to work for the buyer, but untested here. The fallback copy covers a failure.
- **The event extension** is untested until the live release:
  - `astro:env` and `fetch` inside it;
  - a full order in the payload;
  - major versus minor (the docs disagree; I use major).
- **The app may lack the Read Orders scope.** Adding it is your step in the app dashboard.
- **The release puts every merged change since the last release live,** not just this plan.
- **The palette is now order data.** Reordering or editing `PALETTE` changes what old codes mean. It's guarded by a comment, append-only, max 16.
- **Guest revenue** lands on per-order distinct IDs, not the guest's browsing person.
- **A cart read error shows as an empty cart.** The kit's `fetchCart` swallows it.
- **Cost:** no Wix AI credits and no money. The test order uses manual payment. The test coupon and the order stay in Wix until you delete them.

## Result

Filled at close-out.
